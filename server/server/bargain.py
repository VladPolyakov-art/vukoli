"""Negotiation v2: the bargaining engine (D116, spec docs/features/tough-talk/prd-v2.md and protocol.md section 7).

Code holds every number and every hard rule; the model (p9_bargain) only words the move ("act") that code picked, and a
guard puts the scripted line back when the model's line leaks a number or a budget. Nothing here calls a model, so a whole
call can be finished with the scripted lines alone.

Five scenarios: screening, offer, internship, counteroffer, raise. The state is a superset of the v1 state
(negotiation.new_state), so the v1 classifier, lever grants and step-up rules are reused unchanged.
Randomness is stateless and seeded: Random(f"{seed}|purpose|n"), so a seed + the same user lines give the same call.
"""
from __future__ import annotations

import difflib
import functools
import json
import os
import random
import re
from dataclasses import dataclass, field

from . import negotiation as N
from . import talk
from . import talkcase
from .config import content_dir

VERSION = 2
SCENARIOS = ("screening", "offer", "internship", "counteroffer", "raise")
MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
DATE_RE = re.compile(r"\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|next week|"
                     r"end of (?:the |this )?(?:week|day)|weekend|\d+ (?:days?|hours?)|(?:two|three|four|five|few) days?|"
                     r"by \w+day)\b", re.I)
NOT_NOW = ("RA1", "RA2", "RA8", "IN3", "IN8")
FIXED_ACTS = {"check", "closed_again", "wait_ack", "grant_time", "grant_time_noamount", "note_number", "equity",
              "agree_written", "lever_repeat", "ask_date", "decline_first", "ask_figure", "close_accepted",
              "close_declined", "close_cap", "step_up_grant", "step_up_months_counter", "step_up_ask_criteria",
              "step_up_not_yet", "step_up_detail", "step_up_writing", "step_up_rejected", "restate_offer"}
FINAL_OK = {"concede_final", "say_final", "hold_final", "hold_confirm", "confirm_number", "state_offer"}
NO_MOVE = {"object", "hold", "lever_object", "hold_none", "press_number", "ask_number"}
FINAL_RE = re.compile(r"\b(?:final|last offer|that'?s (?:all|it|my limit|the limit)|best (?:i|we) can do|take it or leave it|"
                      r"deal|agreed)\b", re.I)
MOVE_RE = re.compile(r"\b(?:i can (?:do|offer|move|stretch|go|give|raise)|i'?ll (?:move|raise|offer|give)|let'?s say)\b", re.I)
# lever_object asks why the lever matters; the model must not turn it into a refusal ("We don't offer sign-on bonuses").
REFUSE_RE = re.compile(r"\b(?:(?:do|does|can|wo|is|are)n[’']?t|do not|does not|cannot|can not|will not|is not|are not) "
                       r"(?:offer|do|give|provide|have|available|possible|something)\b|\bnot (?:something|possible|available|an option)\b|"
                       r"\bno (?:sign[- ]on|bonus|bonuses)\b", re.I)


@functools.lru_cache(maxsize=None)
def data() -> dict:
    return json.loads((content_dir() / "bargain.json").read_text(encoding="utf-8"))


def check_delay() -> float:
    try:
        return max(0.0, float(os.environ.get("IC_CHECK_DELAY_S", "4")))
    except ValueError:
        return 4.0


def rnd(st: dict, purpose: str, n: int | str = 0) -> random.Random:
    return random.Random(f"{st['seed']}|{purpose}|{n}")


def scenario_info(sid: str) -> dict:
    return next(s for s in data()["scenarios"] if s["id"] == sid)


def public_content() -> dict:
    d = data()
    return {"scenarios": d["scenarios"], "leave_reasons": d["leave_reasons"],
            "money_talk": {"style_by_strictness": d["money_talk"]["style_by_strictness"],
                           "extra_minutes": d["money_talk"]["extra_minutes"], "max_user_turns": d["money_talk"]["max_user_turns"]},
            "check_s": 4, "course": d["course"]}


def is_v2(st: dict | None) -> bool:
    return bool(st) and st.get("version") == VERSION


@dataclass
class BReply(N.Reply):
    objection: dict | None = None
    check: bool = False
    came_back: bool = False
    tails: list[str] = field(default_factory=list)
    vars: dict = field(default_factory=dict)

    @property
    def act(self) -> str:
        return self.move


def _up(r: N.Reply, **kw) -> BReply:
    fields = {k: getattr(r, k) for k in ("move", "amount", "lever_text", "numbers", "extra", "closing", "final", "now", "later",
                                         "months", "time_text")}
    fields["pressure"] = []
    fields.update(kw)
    return BReply(**fields)


# ---------- state ----------

def unit_of(ceiling: float) -> int:
    return 250 if ceiling >= 20000 else 50


def _round(v: float, unit: int) -> int:
    return int(N.round_near(v, unit))


def _draw_owed(st: dict) -> int:
    s = data()["styles"][st["style"]]
    lo, hi = s["obj"]
    if lo == hi:
        return lo
    return hi if rnd(st, "owed", st["concessions"] + 100 * st["owed_draws"]).random() < s["obj_p2"] else lo


def new_state(form: dict, style: str, surprise: bool = False) -> dict:
    """The call as it starts. `form` = the validated `negotiate` block (ws.parse_negotiate)."""
    sc = form.get("scenario") or "offer"
    s = data()["styles"][style]
    seed = form.get("seed")
    if seed is None:
        seed = random.randrange(0, 2_000_000_000)
    base_form = dict(form)
    if sc == "counteroffer":
        base_form.update(target=form["new_offer"], job_low=form["current_pay"], job_high=form["new_offer"], has_real_offer=True)
    elif sc == "raise":
        base_form.update(target=form["ask"], job_low=form["current_pay"], job_high=form["ask"])
    st = N.new_state(base_form, style, surprise)
    ceiling, floor = st["ceiling"], st["floor"]
    unit = unit_of(ceiling)
    st["step"] = unit
    reach = s["reach"]
    if sc == "raise":
        opening, reach = floor, s["raise_now"]
    elif sc == "screening":
        opening = floor
    else:
        opening = int(N.clamp(_round(floor + s["opening_frac"] * (ceiling - floor), unit), floor, ceiling))
    reach_cap = _round(opening + reach * (ceiling - opening), unit)
    reach_cap = int(N.clamp(reach_cap, opening, ceiling))
    gap = reach_cap - opening
    n = s["max_conc"] if gap >= unit else 0
    weights = [s["decay"] ** i for i in range(n)]
    plan, acc = [], 0
    for i, w in enumerate(weights):
        amt = max(unit, _round(gap * w / sum(weights), unit))
        if i == n - 1 or acc + amt > gap:
            amt = gap - acc
        if amt <= 0:
            break
        plan.append(amt)
        acc += amt
    rng = random.Random(f"{seed}|setup")
    st.update(version=VERSION, scenario=sc, seed=int(seed), opening=opening, reach_cap=reach_cap, step=unit,
              current_pay=form.get("current_pay"), new_offer=form.get("new_offer"), leave_reason=form.get("leave_reason"),
              ask=form.get("ask"), review_month=form.get("review_month"), conc_plan=plan, max_conc=len(plan),
              concessions=0, owed=1, owed_draws=0, pending_obj=None, objections_used=[], patience=s["patience"],
              patience_max=s["patience"], unanswered=0, min_final_turn=s["min_final"] + rng.randint(0, 1),
              min_note=s["min_note"], final_reason=None, lever_pending=None, lever_ask=None, asked_date=False,
              range_asked=0, range_given=False, used_ideas=[], guard_reasons=[], user_concessions=[], recent=[],
              check={"used": False, "pending": False, "result": None, "turn": None},
              check_at=(rng.randint(1, 2) if len(plan) >= 3 else (1 if len(plan) == 2 else None)),
              deadline={"turn_planned": rng.randint(*s["deadline"]), "said": False, "turn": None, "asked_time": False},
              cap=(data()["caps"]["screening_cap"] if sc == "screening" else data()["caps"]["turn_cap"]),
              phase="expectations")
    st["round_cap"] = len(plan)
    talkcase.init(st, form.get("prep"))
    st["owed"] = _draw_owed(st)
    st["deck"] = _build_deck(st)
    st["deck_pos"] = 0
    lv = st["levers"]
    lv["title"]["available"] = (sc != "offer") or style == "firm"
    lv["review"]["available"] = style != "tight" and sc == "offer"
    lv["training"] = {"given": False, "value": max(unit, int(ceiling * 0.02 // 50 * 50))}
    lv["scope"] = {"given": False, "value": "a bigger scope"}
    lv["sign_on"]["cap_pct"] = s["sign_on_pct"]
    lv["sign_on"]["cap"] = int(ceiling * s["sign_on_pct"] / 100 // 50 * 50)
    if sc in ("internship", "raise"):
        st["offer"] = opening
        st["phase"] = "bargaining"
        st["offer_path"] = [{"turn": 0, "offer": opening, "label": "Standard junior offer" if sc == "internship" else "Current pay"}]
    if sc == "raise":
        st["offer"] = form["current_pay"]
        st["opening"] = form["current_pay"]
    return st


def _build_deck(st: dict) -> list[str]:
    rows = [o for o in data()["objections"] if o["scenario"] == st["scenario"] and "cond" not in o]
    if st["review_month"] is None:
        rows = [o for o in rows if "{month}" not in o["line"]]
    mine = [o["id"] for o in rows if st["style"] in o["styles"]]
    rest = [o["id"] for o in rows if st["style"] not in o["styles"]]
    rnd(st, "deck", "a").shuffle(mine)
    rnd(st, "deck", "b").shuffle(rest)
    return mine + rest


# ---------- small helpers ----------

def fmt(st: dict, value: int | None) -> str:
    return talk.money(value, st["currency"])


def _norm(text: str) -> str:
    return " ".join((text or "").split())


def _close(st: dict, outcome: str) -> None:
    st["outcome"], st["phase"] = outcome, "closed"


def _answered(po: dict, cls: N.Cls, text: str) -> bool:
    """Did the user's line answer the objection? By code: a reason word, one of the objection's answer words, or a long line."""
    low = text.lower()
    words = len(text.split())
    if cls.justified or cls.reasons:
        return True
    if words >= 4 and any(w in low for w in po.get("answer_words", [])):
        return True
    return words >= 12


def _objection_by_id(oid: str) -> dict | None:
    return next((o for o in data()["objections"] if o["id"] == oid), None)


def _raise_objection(st: dict, turn: int, ask: int | None = None, for_: str = "base") -> BReply:
    """Mike voices one concern. Debt `owed` goes down by one; the next user line is checked against it."""
    d = data()
    obj = None
    if ask and ask > st["ceiling"] and st["scenario"] != "raise":
        obj = next((o for o in d["objections"] if o["scenario"] == st["scenario"] and o.get("cond") == "over_ceiling"
                    and o["id"] not in {u["id"] for u in st["objections_used"]}), None)
    used = {u["id"] for u in st["objections_used"]}
    if obj is None and st.get("line_has_reason"):
        # The line already gave a reason: "I'd need a reason" next would sound deaf. Bring a later objection forward instead.
        deck, pos = st["deck"], st["deck_pos"]
        later = next((i for i in range(pos, len(deck)) if deck[i] not in used
                      and not (_objection_by_id(deck[i]) or {}).get("asks_reason")), None)
        if later is not None and later != pos:
            deck[pos], deck[later] = deck[later], deck[pos]
    while obj is None and st["deck_pos"] < len(st["deck"]):
        cand = st["deck"][st["deck_pos"]]
        st["deck_pos"] += 1
        if cand not in used:
            obj = _objection_by_id(cand)
    month = MONTHS[st["review_month"]] if st.get("review_month") else "the next review"
    if obj is not None:
        line, idea = obj["line"].replace("{month}", month), obj["idea"].replace("{month}", month)
        row = dict(id=obj["id"], line=line, idea=idea, answer_words=obj.get("answer_words", []), tag=obj.get("tag"))
    else:
        fb = d["fallback_objection"][st["style"]]
        n = len(st["objections_used"])
        row = dict(id=f"FB{n}", line=fb[n % len(fb)], idea="you need a bit more to justify a move", answer_words=[], tag="process")
    st["objections_used"].append({"id": row["id"], "turn": turn, "line": row["line"], "answered": None,
                                  "answer_quote": None})
    st["pending_obj"] = dict(row, for_=for_)
    st["owed"] = max(0, st["owed"] - 1)
    st["used_ideas"].append(row["idea"])
    return BReply("object", amount=st["offer"], objection=row)


def _settle_pending(st: dict, cls: N.Cls, text: str) -> bool | None:
    """Mark the pending objection answered or not (first verdict stays if it was answered)."""
    po = st["pending_obj"]
    if not po:
        return None
    ok = _answered(po, cls, text)
    rec = next((r for r in reversed(st["objections_used"]) if r["id"] == po.get("id")), st["objections_used"][-1])
    if rec["answer_quote"] is None or not rec["answered"]:
        rec["answer_quote"] = talk.quote(text)
        rec["answered"] = bool(ok)
    return ok


def _held(st: dict, turn: int, offer: int | None, asked: int | None, text: str, why: str) -> None:
    N._held(st, turn, offer, asked, text, why)


def _finalise(st: dict, why: str) -> None:
    st["final"], st["phase"], st["final_reason"] = True, "final", why


def _lever_list(st: dict) -> list[str]:
    return scenario_info(st["scenario"])["levers"]


def lever_state(st: dict, lever: str) -> str:
    """"ok" | "deferred" (after base is final) | "no"."""
    if lever not in _lever_list(st) or lever == "equity":
        return "no"
    lv = st["levers"].get(lever)
    if lv is None or lv.get("given"):
        return "no"
    style = st["style"]
    if lever in ("training", "scope"):
        return "ok"
    if lever == "remote" and st["scenario"] in ("counteroffer", "raise"):
        return "ok" if style != "tight" else "no"
    if lever in ("title",):
        return "ok" if lv.get("available") else "no"
    if lever == "step_up":
        return "ok"
    if N.lever_available(st, lever):
        return "ok"
    settled = st["final"] or st["levers"]["step_up"]["given"]        # an agreed step-up settles base too
    if lever in ("sign_on", "perf_bonus") and style == "firm" and settled:
        return "ok"
    if lever in ("sign_on", "perf_bonus") and style != "friendly" and not settled:
        return "deferred"
    return "no"


def _next_lever(st: dict) -> str | None:
    order = N.LEVER_ORDER[st["style"]] + ("training", "scope")
    return next((l for l in order if l in _lever_list(st) and lever_state(st, l) == "ok" and l != "step_up"), None)


def _grant(st: dict, lever: str, justified: bool, asked: int | None = None) -> tuple[str, list[int]]:
    lv = st["levers"][lever]
    if lever == "training":
        lv["given"] = True
        return f"a training budget of {fmt(st, lv['value'])}", [lv["value"]]
    if lever == "scope":
        lv["given"] = True
        return "a bigger scope on your next project", []
    if lever == "title" and st["scenario"] == "internship":
        lv.update(given=True, value="mid-level")
        return "a mid-level title instead of junior", []
    words, _ = N._grant(st, lever, justified, asked)
    return words, N._lever_numbers(st, lever)


def lever_value_text(st: dict, lever: str) -> str:
    lv = st["levers"][lever]
    if lever == "training":
        return talk.money(lv["value"], st["currency"])
    if lever == "scope":
        return "bigger scope"
    if lever == "title" and st["scenario"] == "internship":
        return "mid-level title"
    return N.lever_value_text(st, lever)


def _give_lever(st: dict, lever: str, justified: bool, turn: int, text: str, by: str, cause: str, asked: int | None = None) -> BReply:
    words, nums = _grant(st, lever, justified, asked)
    st["moves"].append({"turn": turn, "move": "give_lever", "offer_before": st["offer"], "offer_after": st["offer"],
                        "cause": cause, "quote": talk.quote(text), "lever": lever, "by": by})
    st["lever_pending"] = None
    return BReply("give_lever", amount=st["offer"], lever_text=words, numbers=nums)


def _extras(st: dict) -> str:
    parts = []
    su = st["levers"]["step_up"]
    if su["given"]:
        goals = " tied to the goals" if su["criteria_asked"] else ""
        parts.append(f"rising to {fmt(st, su['later_amount'])} after {su['after_months']} months{goals}")
    lv = st["levers"]
    names = {"sign_on": "a sign-on bonus of {v}", "perf_bonus": "a yearly performance bonus {v}", "review": "a salary review {v}",
             "pto": "{v} of extra time off", "remote": "{v} remote", "title": "a {v}", "training": "a training budget of {v}",
             "scope": "a {v}"}
    for lever, tmpl in names.items():
        if lv.get(lever, {}).get("given"):
            parts.append(tmpl.format(v=lever_value_text(st, lever)))
    return (", " + ", ".join(parts)) if parts else ""


# ---------- the engine ----------

INTENTS = ("accept", "decline", "counter", "step_up", "raise_at_date", "lever_ask", "ask_time", "ask_writing", "ask_range",
           "deflect", "other")
INTENT_LEVERS = ("sign_on", "perf_bonus", "review", "pto", "remote", "title", "equity", "package", "scope", "training")
# A dated raise said in free words ("at the next review", "in six months", "next year"): the v1 pattern misses most of them.
DATE_STEP_RE = re.compile(r"\b(?:at|by|before|for|on|after|during)\s+(?:the\s+|my\s+)?(?:next|upcoming|following|coming)\s+(?:\w+\s+)?review\b|"
                          r"\bnext (?:review|cycle|quarter|year)\b|\bwhen (?:my|the) (?:next )?review\b|\bin (?:\d+|a few|two|three|four|five|six|"
                          r"seven|eight|nine|ten|twelve) months?\b|\bin (?:a|one) year\b|\bat the (?:\w+[- ])?mark\b", re.I)
LETS_DO_RE = re.compile(r"\b(?:let'?s do (?:that|it)|that works|sounds (?:good|great|fair)|i'?ll take (?:it|that)|i accept|deal|agreed|"
                        r"happy with that|we have a deal)\b", re.I)


AGREE_START_RE = re.compile(r"^\W*(?:great|okay|ok|perfect|fine|yes|yeah|sure|wonderful|excellent|thank(?:s| you))\b", re.I)


def _agrees(text: str) -> bool:
    return bool(LETS_DO_RE.search(text) or AGREE_START_RE.search(text)) and not N.NEGATED.search(text)


def validate_intent(raw, text: str) -> dict | None:
    """The model's reading of one user line, checked by code: enum intent, amounts that really are in the line."""
    if not isinstance(raw, dict) or raw.get("intent") not in INTENTS:
        return None
    present = {a.value for a in N.parse_amounts(text)}
    amounts = []
    for v in raw.get("amounts") or []:
        if isinstance(v, (int, float)) and not isinstance(v, bool) and int(v) in present and int(v) not in amounts:
            amounts.append(int(v))
    months = raw.get("months")
    months = months if isinstance(months, int) and not isinstance(months, bool) and 1 <= months <= 36 else None
    lever = raw.get("lever") if raw.get("lever") in INTENT_LEVERS else None
    return {"intent": raw["intent"], "amounts": amounts, "months": months, "criteria": raw.get("criteria_named") is True,
            "writing": raw.get("in_writing_asked") is True, "lever": lever}


def _bucket(months: int | None, text: str) -> int:
    if months:
        return 3 if months <= 4 else 6
    return N._months(text)


def _date_step(st: dict, cls: N.Cls, text: str) -> N.Cls:
    """A line with a later number and a date word is a step-up, whatever the old keywords said."""
    ref = st["offer"]
    valid = sorted(a.value for a in cls.amounts if 0.3 * ref <= a.value <= 3 * ref)
    if valid and max(valid) > ref and DATE_STEP_RE.search(text) and cls.kind in ("counter", "other", "lever_ask", "ask_written"):
        cls.kind, cls.later = "step_up", valid[-1]
        cls.now = valid[0] if len(valid) > 1 and valid[0] > 0 else ref
        cls.months = N._months(text)
        cls.amount = None
    return cls


def classify(st: dict, text: str, intent: dict | None = None) -> N.Cls:
    """What the user's line is: the v1 keyword reading, widened for free phrasing, then the model's intent on top (validated)."""
    cls = N.classify(text, st)
    offered = st["offer"] is not None
    if offered:
        cls = _date_step(st, cls, text)
        if cls.kind in ("ask_written", "step_up_detail") and _agrees(text):
            cls.kind, cls.writing = "accept", True              # "Let's do that, please send it in writing"
    if not intent:
        return cls
    k, ref = intent["intent"], (st["offer"] or st["target"])
    valid = [a for a in intent["amounts"] if 0.3 * ref <= a <= 3 * ref]
    cls.writing = cls.writing or intent["writing"]
    cls.criteria = cls.criteria or intent["criteria"]
    if k == "other":
        return cls
    if k in ("ask_range", "deflect") and cls.kind == "lever_ask" and (cls.lever in ("review", "package") or not intent["lever"]):
        cls.kind = "ask_range"                       # "What does the review process look like?" / "could you share the range": a question, not an ask
        return cls
    if k in ("step_up", "raise_at_date"):
        if offered and valid and max(valid) > st["offer"]:
            vals = sorted(valid)
            cls.kind, cls.later, cls.amount = "step_up", vals[-1], None
            cls.now = vals[0] if len(vals) > 1 and vals[0] > st["offer"] else st["offer"]
            cls.months = _bucket(intent["months"], text)
        elif offered and (st["levers"]["step_up"]["given"] or st["levers"]["step_up"]["pending"]):
            cls.kind = "step_up_detail"
        return cls
    if k == "accept":
        if offered and not any(v != st["offer"] for v in valid) and not N.NEGATED.search(text):
            cls.kind = "accept"
        return cls
    if k == "decline":
        cls.kind = "decline"
    elif k == "counter" and cls.kind != "step_up":
        rising = [v for v in valid if v != st["offer"]]
        if rising:
            cls.kind, cls.amount = "counter", rising[0]
    elif k == "lever_ask":
        lever = intent["lever"] or cls.lever or N.lever_in(text)
        rising = [v for v in valid if st["offer"] is not None and v > st["offer"]]
        if rising and not (cls.lever or N.lever_in(text)):
            cls.kind, cls.amount = "counter", rising[0]     # "...the scope this role describes, so 98,000": a counter, not a scope ask
        elif lever and lever != "step_up":
            cls.kind, cls.lever = "lever_ask", lever
            small = [a.value for a in cls.amounts if a.value >= 50]
            cls.lever_amount = small[0] if small else None
    elif k == "ask_time":
        cls.kind = "ask_time"
    elif k == "ask_writing":
        if cls.kind not in ("accept", "step_up"):
            cls.kind = "ask_written"
            if offered and _agrees(text):
                cls.kind, cls.writing = "accept", True        # "Sounds good, email me the details"
    elif k in ("ask_range", "deflect"):
        if cls.kind in ("other", "ask_range"):
            cls.kind = "ask_range"
    return cls


def _restated_step_up(st: dict, cls: N.Cls, text: str) -> None:
    """The step-up is already agreed and the line only repeats it ("92,500 with the step-up to 98,000 is fine. Can we add
    the sign-on?"): read what is new in the line — another lever, an acceptance or a detail — not a second step-up."""
    su = st["levers"]["step_up"]
    if cls.kind != "step_up" or not su["given"] or cls.later not in (None, su["later_amount"]):
        return
    lever = N.lever_in(text)
    if lever and lever not in ("step_up", "review"):
        cap = 0.3 * (st["offer"] or st["target"])
        small = [a.value for a in cls.amounts if 50 <= a.value <= cap]
        cls.kind, cls.lever, cls.lever_amount, cls.later, cls.now = "lever_ask", lever, (small[0] if small else None), None, None
    elif (N.STRONG_ACCEPT.search(text) or _agrees(text)) and not N.NEGATED.search(text):
        cls.kind = "accept"
    else:
        cls.kind = "step_up_detail"


def step(st: dict, text: str, intent: dict | None = None) -> BReply:
    """One user turn. Changes `st` in place (pass a copy if the reply may be thrown away) and returns the act Mike makes."""
    st["user_turns"] += 1
    turn = st["user_turns"]
    if st["phase"] == "closed":
        return BReply("closed_again", closing=True)
    text = _norm(text)
    cls = classify(st, text, intent)
    _restated_step_up(st, cls, text)
    repeat = talkcase.track(st, text, cls)
    if repeat:                                       # D118: the same reason again is not a new reason
        cls.justified, cls.new_reason, cls.reasons = False, False, []
    pending_before = st["pending_obj"]
    if st["pending_obj"] and cls.kind == "accept" and not N.STRONG_ACCEPT.search(text) and len(text.split()) > 6:
        cls.kind = "other"                           # "Yes, because I led..." answers the objection, it does not accept
    if st["check"]["pending"] and cls.kind == "accept" and not N.STRONG_ACCEPT.search(text):
        cls.kind = "pause"                           # "Sure, take your time" while Mike checks is not an acceptance
    if cls.kind == "accept" and cls.justified and len(text.split()) > 12 and not N.STRONG_ACCEPT.search(text):
        cls.kind = "other"                           # a long line that gives reasons answers Mike, it does not close the call
    st["turns"].append({"turn": turn, "text": text, "cls": cls.kind})
    st["line_has_reason"] = bool(cls.justified or cls.reasons)
    N._signals(st, cls, text, turn)
    if (repeat and st["repeats"] >= 2 and not st["repeat_noticed"] and st["offer"] is not None and not st["final"]
            and not st["check"]["pending"] and cls.kind in ("counter", "other")):
        reply = _notice_repeat(st, turn)
    else:
        reply = _dispatch(st, cls, text, turn)
    _fill_reply(st, pending_before, cls, text, turn)
    if st["phase"] != "closed" and st["user_turns"] >= st["cap"]:
        _close(st, "turn_cap")
        reply = BReply("close_cap", amount=st["offer"], closing=True)
    reply.closing = reply.closing or st["phase"] == "closed"
    reply.final = st["final"]
    _deadline(st, reply, turn)
    st["last_move"] = reply.move
    return reply


def _notice_repeat(st: dict, turn: int) -> BReply:
    """D118: Mike says, once, that he has heard this reason already (counted as objection RP1)."""
    st["repeat_noticed"] = True
    d = data()
    line = _pick(st, d["repeat_noticed"][st["style"]], "repeat_noticed")
    row = dict(id="RP1", line=line, idea=d["repeat_noticed_idea"], tag="process",
               answer_words=["result", "led", "built", "shipped", "launched", "cut", "reduced", "increased", "grew", "saved",
                             "%", "percent", "third", "half", "offer", "range", "market", "bonus", "step-up", "review"])
    st["objections_used"].append({"id": "RP1", "turn": turn, "line": line, "answered": None, "answer_quote": None})
    st["pending_obj"] = dict(row, for_="base")
    st["used_ideas"].append(row["idea"])
    return BReply("object", amount=st["offer"], objection=row)


def _fill_reply(st: dict, pending_before: dict | None, cls: N.Cls, text: str, turn: int) -> None:
    """Every objection gets the user's next line as its reply, even when the engine moved on without settling it."""
    for rec in st["objections_used"]:
        if rec["answer_quote"] is None and rec["turn"] < turn:
            rec["answer_quote"] = talk.quote(text)
            rec["answered"] = bool(_answered(pending_before or {"answer_words": []}, cls, text))


def _deadline(st: dict, reply: BReply, turn: int) -> None:
    d = st["deadline"]
    if reply.closing or d["said"] or turn < d["turn_planned"] or reply.check or reply.move in ("wait_ack", "ask_date", "closed_again"):
        return
    if st["scenario"] != "screening" and st["offer"] is None:
        return
    d.update(said=True, turn=turn)
    reply.tails.append("deadline")


def _time(st: dict, turn: int, text: str) -> BReply:
    if not st["asked_date"] and not DATE_RE.search(text):
        st["asked_date"] = True
        return BReply("ask_date", amount=st["offer"])
    if st["deadline"]["said"]:
        st["deadline"]["asked_time"] = True
    _close(st, "time")
    return BReply("grant_time" if st["offer"] is not None else "grant_time_noamount", amount=st["offer"], closing=True,
                  time_text=data()["styles"][st["style"]]["time_text"])


def _dispatch(st: dict, cls: N.Cls, text: str, turn: int) -> BReply:
    kind = cls.kind
    chk = st["check"]
    if chk["pending"]:
        if cls.kind == "counter" and cls.amount and st["last_counter"] and cls.amount < st["last_counter"]:
            st["user_concessions"].append({"turn": turn, "from": st["last_counter"], "to": cls.amount, "quote": talk.quote(text)})
            N._flag(st, "moved_during_check")
            st["last_counter"] = cls.amount
        if kind in ("accept", "decline", "ask_time", "ask_written"):
            come_back(st, turn, text)                     # the result is applied; the user's line is handled at the new offer
        else:
            r = come_back(st, turn, text)
            r.came_back = True
            return r
    if st["asked_date"] and st["last_move"] == "ask_date" and DATE_RE.search(text) and not cls.amounts:
        return _time(st, turn, text)
    if kind == "ask_written" and st["offer"] is not None and st["scenario"] != "screening":
        N._sig(st, "in_writing_asked", turn, text)
        if st["levers"]["step_up"]["given"]:
            st["levers"]["step_up"]["in_writing"] = True
        return BReply("agree_written", amount=st["offer"])
    if kind in ("ask_time", "ask_written"):
        if st["offer"] is None and kind == "ask_written" and st["scenario"] != "screening":
            kind = "other"
        else:
            N._sig(st, "asked_time", turn, text)
            return _time(st, turn, text)
    if kind == "decline":
        st["declines"] += 1
        if st["declines"] >= 2:
            _close(st, "declined")
            return BReply("close_declined", closing=True)
        return BReply("decline_first", amount=st["offer"])
    if st["scenario"] == "screening":
        return _screening(st, cls, text, turn)
    if st["offer"] is None:
        return _expectations(st, cls, text, turn)
    if kind == "accept":
        if (st["counters"] == 0 and st["user_first_number"] is None and not st["asks"]
                and not any(m["move"] in ("concede", "give_lever", "step_up") for m in st["moves"])):
            N._sig(st, "accepted_first_offer", turn, text)
        lp = st["lever_pending"]
        # "Let's do that" after a title / bonus was discussed takes it; "I accept: 88,750 and 98,000 later" restates the
        # terms without it, so the lever is dropped, not handed over.
        restates_without = bool(cls.amounts) and N.lever_in(text) != lp
        if lp and lp != "step_up" and lever_state(st, lp) == "ok" and not restates_without:
            _give_lever(st, lp, True, turn, text, "ask", f"lever_ask:{lp}")
        st["lever_pending"] = None
        reply = BReply("close_accepted", amount=st["offer"], closing=True)
        if cls.writing:
            N._sig(st, "in_writing_asked", turn, text)
            if st["levers"]["step_up"]["given"]:
                st["levers"]["step_up"]["in_writing"] = True
            reply.tails.append("agree_written")
        _close(st, "accepted")
        return reply
    if kind == "counter":
        return _counter(st, cls, text, turn, None)
    if kind == "step_up":
        return _step_up(st, cls, text, turn)
    if kind == "step_up_detail":
        return _up(N._step_up_detail(st, cls, text, turn))
    if kind == "lever_ask":
        return _lever(st, cls, text, turn)
    if kind == "pause":
        return BReply("wait_ack", amount=st["offer"])
    po = st["pending_obj"]
    if po and kind in ("other", "ask_range"):
        if po.get("for_") == "step_up" and st["lever_ask"]:
            la = st["lever_ask"]
            c2 = N.Cls("step_up", later=la["later"], now=la["now"], months=la["months"], justified=cls.justified or True,
                       criteria=True, reasons=cls.reasons, writing=cls.writing, new_reason=cls.new_reason)
            if _settle_pending(st, cls, text):
                st["pending_obj"] = None
                return _step_up(st, c2, text, turn)
            return _unanswered(st, turn, st["offer"], text)
        if po.get("for_") == "base":
            return _counter(st, cls, text, turn, st["last_counter"] or st["user_anchor"] or st["target"])
    if st["lever_pending"] and kind in ("other", "ask_range") and st["lever_pending"] in st["levers"]:
        lever = st["lever_pending"]
        if len(text.split()) >= 5:
            return _give_lever(st, lever, True, turn, text, "ask", f"lever_ask:{lever}")
    if kind == "ask_range":
        return BReply("deflect_range", amount=st["offer"])
    if cls.attempted_amount and st["figure_asked"] < 1:
        st["figure_asked"] += 1
        return BReply("ask_figure", amount=st["offer"])
    return BReply("answer_other", amount=st["offer"])


def _expectations(st: dict, cls: N.Cls, text: str, turn: int) -> BReply:
    """No base on the table yet (offer, counteroffer): the user's first line decides how Mike opens."""
    sc = st["scenario"]
    if sc == "counteroffer":
        n = cls.amount if cls.kind == "counter" else None
        st["user_first_number"] = n
        st["reason_text"] = talk.quote(text)
        st["asks"].append(N._ask(cls, n, None, text, turn))
        st["offer"], st["phase"] = st["opening"], "bargaining"
        N._path(st, turn, "Mike's first counter")
        N._record(st, turn, "state_offer", None, text, "opening")
        return BReply("state_offer", amount=st["offer"])
    reply = N._expectations(st, cls, text, turn)
    st["pressure_used"], st["last_pressure"] = [], None
    st["phase"] = "bargaining" if st["offer"] is not None else st["phase"]
    return _up(reply)


def _register_ask(st: dict, cls: N.Cls, text: str, turn: int) -> int:
    a = cls.amount
    st["counters"] += 1
    prev = st["last_counter"]
    if prev and a < prev:
        st["user_concessions"].append({"turn": turn, "from": prev, "to": a, "quote": talk.quote(text)})
    st["user_anchor"] = max(st["user_anchor"] or 0, a)
    if st["offer"] and a >= st["offer"] * 1.03:
        N._sig(st, "counter_above_offer", turn, text)
    if a % 1000 != 0:
        N._sig(st, "precise_number", turn, text)
    st["asks"].append(N._ask(cls, a, None, text, turn))
    if cls.also_lever:
        N._sig(st, "asked_package", turn, text)
    st["same_streak"] = st["same_streak"] + 1 if prev and abs(a - prev) <= 0.01 * prev and not cls.new_reason else 0
    st["last_counter"] = a
    return a


def _counter(st: dict, cls: N.Cls, text: str, turn: int, repeat_ask: int | None) -> BReply:
    """The user asks for more base (a new number, or an answer to the objection with the ask unchanged)."""
    a = _register_ask(st, cls, text, turn) if repeat_ask is None else repeat_ask
    before = st["offer"]
    if a <= before:
        N._flag(st, "countered_below_offer")
        _held(st, turn, before, a, text, "below_offer")
        st["pending_obj"] = None
        return BReply("hold_confirm", amount=before)
    if st["final"]:
        _held(st, turn, before, a, text, "base_final")
        lever = _next_lever(st)
        if lever:
            return _give_lever(st, lever, True, turn, text, "offered", "offered_when_final")
        return BReply("hold_final", amount=before)
    if st["pending_obj"]:
        if not _settle_pending(st, cls, text):
            return _unanswered(st, turn, a, text)
        st["pending_obj"] = None
        st["patience"] = st["patience_max"]
    if st["concessions"] >= st["max_conc"] or st["reach_cap"] - before < st["step"]:
        return _no_room(st, turn, a, text)                  # nothing left to trade: no more objections to collect first
    if st["owed"] > 0:
        return _raise_objection(st, turn, a)
    return _concede(st, cls, text, turn, a)


def _unanswered(st: dict, turn: int, asked: int | None, text: str) -> BReply:
    st["patience"] = max(0, st["patience"] - 1)
    st["unanswered"] += 1
    before = st["offer"]
    _held(st, turn, before, asked, text, "no_reason")
    if st["patience"] <= 0 and turn >= st["min_final_turn"] and before is not None and not st["final"]:
        st["pending_obj"] = None
        _finalise(st, "patience")
        return BReply("say_final", amount=before)
    return BReply("hold", amount=before, objection=st["pending_obj"])


def _concede(st: dict, cls: N.Cls, text: str, turn: int, a: int) -> BReply:
    before, k = st["offer"], st["concessions"]
    if k >= st["max_conc"] or st["reach_cap"] - before < st["step"]:
        return _no_room(st, turn, a, text)
    if _check_due(st):
        return _start_check(st, turn)
    goal = min(a, st["ceiling"], st["reach_cap"])
    new = min(before + st["conc_plan"][k], goal)
    st["offer"] = int(new)
    st["concessions"] = k + 1
    st["round"] += 1
    st["owed_draws"] += 1
    st["owed"] = _draw_owed(st)
    st["patience"] = st["patience_max"]
    cause = "competing_offer" if "competing_offer" in cls.reasons and cls.new_reason else "justified_counter"
    N._path(st, turn, "After your counter")
    N._record(st, turn, "concede", before, text, cause)
    last = st["concessions"] >= st["max_conc"] or st["offer"] >= st["reach_cap"]
    if last and turn >= st["min_final_turn"]:
        _finalise(st, "schedule")
        return BReply("concede_final", amount=st["offer"])
    return BReply("concede", amount=st["offer"])


def _no_room(st: dict, turn: int, a: int, text: str) -> BReply:
    """Base cannot move any more. Before `min_final_turn` Mike keeps objecting; after it he says so."""
    before = st["offer"]
    if turn >= st["min_final_turn"]:
        _held(st, turn, before, a, text, "base_final")
        _finalise(st, "schedule")
        return BReply("say_final", amount=before)
    st["owed"] = 1
    return _raise_objection(st, turn, a)


# ---------- the check ("let me check with the hiring manager") ----------

def _check_due(st: dict) -> bool:
    s = data()["styles"][st["style"]]
    return (not st["check"]["used"] and st["check_at"] is not None and st["concessions"] == st["check_at"]
            and not st["final"] and st["scenario"] != "screening" and (s["check_frac"] > 0 or s["check_kind"] == "lever"))


def _start_check(st: dict, turn: int) -> BReply:
    st["check"] = {"used": True, "pending": True, "result": None, "turn": turn}
    st["pending_obj"] = None
    return BReply("check", amount=st["offer"], check=True)


def come_back(st: dict, turn: int | None = None, text: str = "") -> BReply:
    """Mike is back from checking. Called by the server timer (no user line) or by the user's next line."""
    turn = turn or st["user_turns"]
    chk = st["check"]
    chk["pending"] = False
    s = data()["styles"][st["style"]]
    before, k = st["offer"], st["concessions"]
    goal = st["last_counter"] or st["ceiling"]
    if goal <= before:
        goal = st["ceiling"]
    if s["check_kind"] == "base" and k < st["max_conc"] and st["reach_cap"] - before >= st["step"]:
        extra = _round(s["check_frac"] * (st["reach_cap"] - st["opening"]), st["step"])
        new = min(before + st["conc_plan"][k] + extra, goal, st["reach_cap"])
        if new > before:
            st["offer"], st["concessions"] = int(new), k + 1
            st["round"] += 1
            st["owed_draws"] += 1
            st["owed"] = max(1, _draw_owed(st))
            st["patience"] = st["patience_max"]
            chk["result"] = {"kind": "base", "from": before, "to": int(new), "lever": None}
            N._path(st, turn, "After Mike checked")
            N._record(st, turn, "concede", before, text or "(waiting)", "check")
            return BReply("come_back", amount=int(new), came_back=True)
    st["concessions"] = min(st["max_conc"], k + 1)          # the check spent this slot of the schedule, whatever came back
    lever = _next_lever(st) or next((l for l in ("sign_on", "perf_bonus", "training", "scope", "remote") if l in _lever_list(st)
                                      and st["levers"].get(l) and not st["levers"][l].get("given")), None)
    st["owed"] = max(1, st["owed"])
    if lever:
        words, nums = _grant(st, lever, True)
        chk["result"] = {"kind": "lever", "from": before, "to": before, "lever": lever}
        st["moves"].append({"turn": turn, "move": "give_lever", "offer_before": before, "offer_after": before, "cause": "check",
                            "quote": talk.quote(text or "(waiting)"), "lever": lever, "by": "offered"})
        return BReply("come_back_lever", amount=before, lever_text=words, numbers=nums, came_back=True)
    chk["result"] = {"kind": "none", "from": before, "to": before, "lever": None}
    return BReply("come_back_none", amount=before, came_back=True)


# ---------- levers and the step-up ----------

def _lever(st: dict, cls: N.Cls, text: str, turn: int) -> BReply:
    lever = cls.lever
    st["asks"].append(N._ask(cls, None, lever, text, turn))
    if lever == "equity":
        return BReply("equity", amount=st["offer"])
    if lever == "package":
        pick = _next_lever(st)
        if pick is None:
            return BReply("lever_unavailable", amount=st["offer"])
        lever = pick
    if st["levers"].get(lever, {}).get("given"):
        return BReply("lever_repeat", amount=st["offer"])
    state = lever_state(st, lever)
    if state == "deferred":
        return BReply("lever_deferred", amount=st["offer"])
    if state != "ok":
        return BReply("lever_unavailable", amount=st["offer"])
    if st["lever_pending"] != lever:
        st["lever_pending"] = lever
        return BReply("lever_object", amount=st["offer"])
    return _give_lever(st, lever, cls.justified or True, turn, text, "ask", f"lever_ask:{lever}", cls.lever_amount)


def _step_up(st: dict, cls: N.Cls, text: str, turn: int) -> BReply:
    su = st["levers"]["step_up"]
    if su["given"]:
        return BReply("lever_repeat", amount=st["offer"])
    if st["lever_pending"] != "step_up":
        N._sig(st, "step_up_asked", turn, text)
        st["asks"].append(N._ask(cls, cls.later, "step_up", text, turn))
        st["user_anchor"] = max(st["user_anchor"] or 0, cls.later or 0)
        st["lever_pending"] = "step_up"
        st["lever_ask"] = {"later": cls.later, "now": cls.now, "months": cls.months}
        return _raise_objection(st, turn, None, for_="step_up")
    if st["pending_obj"]:
        if not _settle_pending(st, cls, text):
            return _unanswered(st, turn, st["offer"], text)
        st["pending_obj"] = None
        st["patience"] = st["patience_max"]
    saved_final = st["final"]
    if st["scenario"] in ("raise", "internship", "counteroffer") and st["style"] == "tight":
        st["final"] = True                                    # a dated step-up is the way in these calls, even for Tight
    before_offer = st["offer"]
    r = N._step_up(st, cls, text, turn) if cls.kind == "step_up" else N._step_up_detail(st, cls, text, turn)
    st["final"] = saved_final
    if st["offer"] > max(before_offer, st["reach_cap"]):       # the v1 "now" lift never goes past the reach cap
        st["offer"] = int(max(before_offer, st["reach_cap"]))
        su["now_amount"] = st["offer"]
        r.amount = r.now = st["offer"]
        r.numbers = [st["offer"], su["later_amount"], su["after_months"]]
    if su["given"]:
        st["lever_pending"] = None
        st["owed"] = max(st["owed"], 1)
    return _up(r)


# ---------- screening (no offer: Mike only wants a number) ----------

def _band_of(st: dict, n: int) -> str:
    if n < st["floor"]:
        return "below"
    return "above" if n > st["ceiling"] else "inside"


def _screening(st: dict, cls: N.Cls, text: str, turn: int) -> BReply:
    style = st["style"]
    ask_range = bool(N.ASK_RANGE.search(text)) and not cls.amount
    if ask_range:
        st["range_asked"] += 1
        N._sig(st, "asked_range", turn, text)
        allowed = (style == "friendly" and st["range_asked"] >= 1) or (style == "firm" and st["range_asked"] >= 2)
        if allowed and st["job_low"]:
            st["range_given"] = True
            return BReply("share_range", numbers=[st["job_low"], st["job_high"]], vars={"low": st["job_low"], "high": st["job_high"]})
        return BReply("deflect_range")
    if cls.kind == "pause":
        return BReply("wait_ack")
    n = cls.amount if cls.kind == "counter" else None
    po = st["pending_obj"]
    if n is None and po and st["user_first_number"] is not None:
        n = st["last_counter"]
    if n is None and cls.kind != "counter" and st["user_first_number"] is None:
        st["pressed"] += 1
        if st["pressed"] > 3:
            _close(st, "turn_cap")
            return BReply("close_cap", closing=True)
        return BReply("press_number")
    if n is None:
        return BReply("answer_other")
    if cls.kind == "counter":
        if st["user_first_number"] is None:
            st["user_first_number"], st["first_turn"] = n, turn
            st["vs_band"] = _band_of(st, n)
            if st["range_asked"] == 0:
                N._flag(st, "no_range_asked")
        _register_ask(st, cls, text, turn)
        if n < st["floor"] and turn >= 1 and st["vs_band"] == "below" and "named_below_opening" not in st["flags"]:
            N._flag(st, "named_below_opening")
            _close(st, "noted")
            return BReply("take_lower", closing=True, vars={"amount": n}, tails=["note_number"])
    if po:
        if not _settle_pending(st, cls, text):
            r = _unanswered(st, turn, n, text)
            if st["patience"] <= 0 and turn >= st["min_note"]:
                _close(st, "noted")
                return BReply("note_number", closing=True, vars={"amount": n})
            r.move = "hold_none" if r.move == "hold" else r.move
            return r
        st["pending_obj"] = None
        st["patience"] = st["patience_max"]
    if st["owed"] > 0 or turn < st["min_note"]:
        st["owed"] = max(st["owed"], 1) if turn < st["min_note"] else st["owed"]
        return _raise_objection(st, turn, n)
    _close(st, "noted")
    return BReply("note_number", closing=True, vars={"amount": n})


# ---------- lines ----------

class _Safe(dict):
    def __missing__(self, key):
        return ""


def _pick(st: dict, options: list[str], act: str) -> str:
    recent = {r.lower() for r in st["recent"][-4:]}
    pool = [o for o in options if o.lower() not in recent] or options
    return pool[rnd(st, "line", f"{st['user_turns']}|{act}").randrange(len(pool))]


def _table(st: dict, act: str) -> dict | None:
    lines = data()["lines"]
    return lines.get(st["scenario"], {}).get(act) or lines["*"].get(act)


def _variants(table: dict, style: str, amount_none: bool) -> list[str]:
    if amount_none and "none" in table:
        return table["none"]
    return table.get(style) or table.get("*") or next(iter(table.values()))


def scripted_line(st: dict, reply: BReply, name: str = "", base_only: bool = False) -> str:
    """The fixed line for an act: no model, or the model's line failed the guard. `base_only` leaves off the tail."""
    act = reply.move
    table = _table(st, act)
    if table is None:
        table = _table(st, "answer_other")
        act = "answer_other"
    options = _variants(table, st["style"], reply.amount is None and "amount" not in reply.vars)
    template = _pick(st, options, act)
    if "{num}" in template and reply.amount is None:
        template = _pick(st, _variants(_table(st, "answer_other_none"), st["style"], False), "answer_other_none")
    v = reply.vars
    su = st["levers"]["step_up"]
    values = _Safe(num=fmt(st, reply.amount), lever=reply.lever_text or "", role=st["role"], hi=f"Hi {name}." if name else "Hi.",
                   time=reply.time_text, now=fmt(st, reply.now), later=fmt(st, reply.later),
                   when=f"after {reply.months} months" if reply.months else "", goals=" and the goals" if su["criteria_asked"] else "",
                   extras=_extras(st) if act == "close_accepted" else "", amount=fmt(st, v.get("amount")),
                   low=fmt(st, v.get("low")), high=fmt(st, v.get("high")), month=MONTHS[st["review_month"]] if st.get("review_month") else "")
    text = template.format_map(values)
    if act in ("step_up_grant", "step_up_months_counter") and su["criteria_asked"]:
        text = re.sub(r"\s*[^.!?]*\?$", "", text)       # goals already named: don't ask for them again
    if reply.move == "object" and reply.objection and reply.objection.get("line"):
        text = reply.objection["line"]
    if reply.move == "check":
        text = _pick(st, data()["check_lines"][st["scenario"]][st["style"]], "check")
    return text if base_only else with_tail(st, text, reply)


def with_tail(st: dict, line: str, reply: BReply) -> str:
    """The line plus its scripted tail; a tail that repeats "in writing" after the line already said it is dropped."""
    parts = [line]
    for t in tail(st, reply):
        if "writing" in t.lower() and "writing" in " ".join(parts).lower():
            continue
        parts.append(t)
    return " ".join(parts)


def tail(st: dict, reply: BReply) -> list[str]:
    """Scripted sentences that always follow the act: the step-up in-writing line, the deadline, the noted number."""
    out = []
    for k in reply.extra:
        key = "step_up_writing_raise" if st["scenario"] == "raise" and k == "step_up_writing" else k
        su = st["levers"]["step_up"]
        t = _pick(st, _variants(_table(st, key), st["style"], False), key)
        out.append(t.format_map(_Safe(later=fmt(st, su["later_amount"]), when=f"after {su['after_months']} months",
                                      goals=" and the goals" if su["criteria_asked"] else "")))
    for k in reply.tails:
        if k == "deadline":
            out.append(_pick(st, data()["deadline_lines"][st["scenario"]][st["style"]], "deadline"))
        elif k == "agree_written":
            if reply.move == "close_accepted":
                continue                                  # the closing line already promises the letter
            out.append(_pick(st, _variants(_table(st, "agree_written"), st["style"], False), "agree_written"))
        elif k == "note_number":
            t = _pick(st, _variants(_table(st, "note_number"), st["style"], False), "note_number")
            out.append(t.format_map(_Safe(amount=fmt(st, reply.vars.get("amount")))))
    return out


def opening_line(st: dict, name: str = "") -> str:
    table = data()["lines"][st["scenario"]]["opening"]
    t = table.get(st["style"]) or table.get("*")
    return t[0].format_map(_Safe(hi=f"Hi {name}." if name else "Hi.", role=st["role"], num=fmt(st, st["offer"] if st["scenario"] == "internship" else st["opening"])))


def restate_line(st: dict) -> str:
    table = data()["lines"][st["scenario"]].get("restate_offer") or data()["lines"]["*"]["restate_offer"]
    if st["scenario"] in ("raise", "counteroffer", "screening") and st["offer"] is None:
        return table["none"][0] if "none" in table else table["*"][0]
    if st["offer"] is None or st["scenario"] == "screening":
        return table.get("none", table["*"])[0]
    return table["*"][0].format_map(_Safe(num=fmt(st, st["offer"])))


def closed_line(st: dict) -> str:
    return data()["lines"]["*"]["closed_again"]["*"][0]


def said(st: dict, reply: BReply, line: str) -> None:
    """Remember what Mike actually said (for the repetition guard, the model's RECENT and the debrief)."""
    st["recent"] = (st["recent"] + [line])[-6:]
    if reply.objection and st["objections_used"]:
        st["objections_used"][-1]["line"] = line


# ---------- model side ----------

def numbers_allowed(reply: BReply) -> list[int]:
    out = [reply.amount, reply.now, reply.later, reply.months, *reply.numbers]
    return [x for x in out if x is not None]


def guard_ok(st: dict, reply: BReply, line: str) -> tuple[bool, str]:
    """(ok, reason). Replaces the line only on a number or budget leak, a premature "final", a wrong move or a repeat."""
    if not line.strip():
        return False, "empty"
    if not N.guard_ok(line, numbers_allowed(reply)):
        return False, "number"
    if reply.move not in FINAL_OK and FINAL_RE.search(line):
        return False, "final"
    if reply.move in NO_MOVE and MOVE_RE.search(line):
        return False, "move"
    if reply.move == "lever_object" and REFUSE_RE.search(line):
        return False, "refusal"
    for r in st["recent"][-3:]:
        if difflib.SequenceMatcher(None, line.lower(), r.lower()).ratio() >= 0.8:
            return False, "repeat"
    return True, ""


def model_input(st: dict, reply: BReply, last_user_line: str) -> dict:
    d = data()
    sc = scenario_info(st["scenario"])
    brief = d["act_brief"].get(reply.move, "Answer briefly and stay on the topic.")
    return {"scenario_name": sc["name"], "mike_role": sc["mike_role"], "role": st["role"],
            "style_manner": d["styles"][st["style"]]["manner"], "act": reply.move, "act_brief": brief,
            "amount_to_say": fmt(st, reply.amount) if reply.amount is not None else "",
            "lever_to_say": reply.lever_text or "",
            "objection_idea": (reply.objection or {}).get("idea", "") if reply.move in ("object", "hold") else "",
            "recent": " | ".join(st["recent"][-2:]) or "(none)", "last_user_line": last_user_line[:400]}


# ---------- hints ----------

def _primary_hint(st: dict, spoken: list[dict] | None = None) -> str:
    sc = st["scenario"]
    if st["check"]["pending"]:
        return "O2"
    if st.get("repeats", 0) >= 2 and not st["final"] and st["offer"] is not None:
        su = st["levers"]["step_up"]
        if not (su.get("given") or su.get("pending")) and st["scenario"] != "screening":
            return "N9"                                # D118: stuck on one reason → trade
        return "N6"
    if st["pending_obj"]:
        return talkcase.objection_card(st["pending_obj"].get("id"))
    if st.get("last_move") == "lever_object":
        return "X6"
    asked_levers = {a.get("lever") for a in st["asks"]}
    if sc == "screening" and st["user_first_number"] is None:
        return "S2" if st["last_move"] == "press_number" else "S1"
    if sc == "raise":
        if not st["asks"]:
            return "R1"
        last = st["objections_used"][-1]["id"] if st["objections_used"] else None
        if last in NOT_NOW and "step_up" not in asked_levers:
            return "R2"
    if sc == "counteroffer":
        if st["offer"] is None or not st["asks"]:
            return "C1"
        if st["offer"] is not None and not st["final"]:
            return "C2"
    if sc == "internship" and "title" not in asked_levers and not any(re.search(r"\blevel|title|mid", a.get("quote", ""), re.I) for a in st["asks"]):
        return "I1"
    return N._primary_hint(st, spoken)


_NEAR = {"screening": ("S1", "N2", "S2", "N1"), "raise": ("R1", "R2"), "counteroffer": ("C1", "C2"), "internship": ("I1",)}


def hint_ranking(st: dict, spoken: list[dict] | None = None) -> list[str]:
    first = _primary_hint(st, spoken)
    near = _NEAR.get(st["scenario"], ())
    if st["phase"] == "expectations" and st["scenario"] != "screening":
        near = ("N2", "N1", "N3", *near)
    extra = ["O1"] if first.startswith("X") else []
    return N.drop_just_done(st, list(dict.fromkeys([first, *extra, *near, *N._GENERIC_HINTS])))


def pick_hint(st: dict, spoken: list[dict] | None = None, exclude=()) -> str:
    ranked = hint_ranking(st, spoken)
    return next((c for c in ranked if c not in exclude), ranked[0])


def hints_shown_now(st: dict) -> list[str]:
    return N.hints_shown_now(st)


def card_example(cid: str, st: dict | None) -> str:
    base = talk.card(cid)["example"]
    if not st:
        return base
    m = lambda v: talk.money(v)           # noqa: E731
    if cid == "S2":
        t = st["target"]
        return f"Based on the scope, I'm looking at {m(t)} to {m(int(round(t * 1.1 / 1000) * 1000))}."
    if cid in ("R1", "R2") and st.get("ask"):
        month = MONTHS[st["review_month"]] if st.get("review_month") else "June"
        if cid == "R1":
            return f"Since last review I led the migration and cut support tickets by a third. I'm asking for {m(st['ask'])}."
        return f"What would I need to show by the {month} review for a raise to {m(st['ask'])}? Could you confirm it by email?"
    if cid in ("O1", "O2", "S1", "I1", "C1", "C2"):
        return base
    if cid.startswith("X"):                            # D118: fill the objection card from the prepared case
        un = talkcase.unused_results(st)
        if un:
            mid = un[0][:1].lower() + un[0][1:] if not un[0][:2].isupper() else un[0]
            base = base.replace("[your result]", mid).replace("[A result with a number]", un[0][:1].upper() + un[0][1:])
        anchor = st.get("user_anchor") or st.get("ask") or st.get("target")
        if anchor:
            base = base.replace("[your number]", m(anchor))
        return base
    return N.card_example(cid, st)


# ---------- debrief ----------

REASON_RE = {"money": r"pay|salary|money|compensation|paid", "growth": r"grow|learn|career|promot|path|develop",
             "manager": r"manager|boss|lead|supervis", "remote": r"remote|home|hybrid|commut", "other": r"because|reason|why"}
NOT_NOW_NOTE = "Mike used a deadline; real recruiters may or may not."


def _say_v2(st: dict) -> list[tuple[str, str, str | None]]:
    """(id, card, quote) for the v2 moments that happened, most useful first."""
    out = []
    sc = st["scenario"]
    unanswered = next((o for o in st["objections_used"] if o["answered"] is False and o["answer_quote"]), None)
    if unanswered:
        out.append(("answer_objection", "O1", unanswered["answer_quote"]))
    if "moved_during_check" in st["flags"]:
        out.append(("no_wait_check", "O2", (st["user_concessions"][-1]["quote"] if st["user_concessions"] else None)))
    if sc == "screening":
        if st.get("vs_band") == "below":
            out.append(("number_below_band", "S2", st["asks"][0]["quote"] if st["asks"] else None))
        if "no_range_asked" in st["flags"]:
            out.append(("asked_no_range", "S1", st["asks"][0]["quote"] if st["asks"] else None))
    if sc == "internship" and not any(a.get("lever") == "title" or re.search(r"\blevel|title|mid", a.get("quote", ""), re.I) for a in st["asks"]):
        out.append(("no_level_ask", "I1", None))
    if sc == "counteroffer":
        if not _reason_named(st):
            out.append(("no_reason_named", "C1", st.get("reason_text")))
        if st["outcome"] in ("accepted", "time") and "in_writing_asked" not in st["signals"] and "asked_time" not in st["signals"]:
            out.append(("no_writing_counter", "C2", None))
    if sc == "raise":
        if not any(a["justified"] for a in st["asks"]):
            out.append(("raise_no_results", "R1", st["asks"][0]["quote"] if st["asks"] else None))
        if (any(o["id"] in NOT_NOW for o in st["objections_used"]) and not st["levers"]["step_up"]["given"]
                and "step_up_asked" not in st["signals"]):
            out.append(("raise_no_date", "R2", None))
    return out


def _reason_named(st: dict) -> bool:
    txt = st.get("reason_text") or ""
    return bool(re.search(REASON_RE.get(st.get("leave_reason") or "other", REASON_RE["other"]), txt, re.I))


SAY_TITLE = {"answer_objection": "You did not answer Mike's concern", "no_wait_check": "You lowered your ask while Mike was checking",
             "asked_no_range": "You named a number before asking for the range", "number_below_band": "Your number was below the band",
             "no_level_ask": "You did not ask for the level", "no_reason_named": "You did not say why you are leaving",
             "no_writing_counter": "The counter was not put in writing", "raise_no_results": "You asked for a raise without results",
             "raise_no_date": "You left with no date or goals"}
SAY_WHAT = {"answer_objection": "Mike raised a concern and your next line did not answer it.",
            "no_wait_check": "Mike went to check and you moved your number before he came back."}


def _verdict(st: dict, base: dict) -> str:
    sc, cur = st["scenario"], st["currency"]
    sm = base["summary"]
    if sc == "screening":
        n = st["user_first_number"]
        if n is None:
            return "You did not name a number, so Mike had nothing to note."
        band = {"inside": "inside", "above": "above", "below": "below"}[st["vs_band"]]
        return f"The first number you named was {talk.money(n, cur)}, {band} the band Mike used."
    if st["offer"] is None:
        return "No base was on the table when the practice ended."
    if sc == "counteroffer":
        return (f"Mike's counter moved from {talk.money(st['opening'], cur)} to {talk.money(st['offer'], cur)}. "
                "Vukoli does not say whether to stay or leave.")
    if sc == "raise":
        gain = st["offer"] - st["opening"]
        return (f"Your base moved by {talk.money(gain, cur)} to {talk.money(st['offer'], cur)}." if gain > 0
                else "Your base did not move.") + (f" {base['deal']['line']}." if base.get("deal") else "")
    return base["verdict"]


def debrief(st: dict) -> dict:
    sc = st["scenario"]
    cur = st["currency"]
    base = N.debrief(st)
    objections = [{"id": o["id"], "turn": o["turn"], "mike_line": o["line"], "user_reply": o["answer_quote"],
                   "answered": bool(o["answered"]), "may_be_wrong": True} for o in st["objections_used"]]
    mike = [{"turn": m["turn"], "from": m["offer_before"], "to": m["offer_after"], "quote": m["quote"]}
            for m in st["moves"] if m["offer_before"] is not None and m["offer_after"] != m["offer_before"] and m["cause"] != "opening"]
    you = [dict(u) for u in st["user_concessions"]]
    chk = None
    if st["check"]["used"]:
        chk = {"used": True, "turn": st["check"]["turn"], "result": st["check"]["result"]}
    dl = st["deadline"]
    deadline = {"said": True, "turn": dl["turn"], "asked_time": dl["asked_time"], "label": NOT_NOW_NOTE} if dl["said"] else None
    sm = base["summary"]
    asked_levers = {a.get("lever") for a in st["asks"]}
    results_named = any(a["justified"] for a in st["asks"])
    if sc == "screening":
        section = {"first_number": st["user_first_number"], "first_turn": st.get("first_turn"), "vs_band": st.get("vs_band"),
                   "asked_range": st["range_asked"] > 0, "got_range": st["range_given"],
                   "range_given": {"low": st["job_low"], "high": st["job_high"]} if st["range_given"] else None,
                   "revealed_current": "revealed_current" in st["flags"], "tied_to_scope": any("scope" in a.get("quote", "").lower() for a in st["asks"]),
                   "flexible_on_package": "asked_package" in st["signals"]}
        sm.update(opening=None, final_offer=None, captured_pct=None, captured_now_pct=None, position_pct=None)
        base["no_offer"] = True
    elif sc == "internship":
        lvl = "title" in asked_levers or any(re.search(r"\blevel|title|mid", a.get("quote", ""), re.I) for a in st["asks"])
        section = {"level_asked": lvl, "level_won": bool(st["levers"]["title"].get("given")),
                   "step_up_line": (base["deal"] or {}).get("line"), "results_named": results_named}
    elif sc == "counteroffer":
        section = {"reason_named": _reason_named(st), "reason": st["leave_reason"], "counter_matched": bool(st["offer"] and st["offer"] >= st["new_offer"]),
                   "counter_in_writing": "in_writing_asked" in st["signals"] or st["outcome"] == "time",
                   "time_asked": "asked_time" in st["signals"], "unwritten_promise_accepted": st["outcome"] == "accepted" and "in_writing_asked" not in st["signals"],
                   "deadline_accepted": bool(dl["said"] and not dl["asked_time"]),
                   "decision": {"accepted": "stay", "declined": "leave", "time": "time"}.get(st["outcome"]),
                   "note": "Vukoli does not say whether to stay or leave."}
    elif sc == "raise":
        su = st["levers"]["step_up"]
        gain = (st["offer"] - st["opening"]) if st["offer"] is not None else 0
        section = {"asked": st["ask"], "current": st["current_pay"],
                   "raise_now": {"amount": gain, "pct_of_current": round(100 * gain / st["current_pay"], 1)} if gain > 0 else None,
                   "dated": ({"amount": su["later_amount"], "after_months": su["after_months"], "criteria": su["criteria_asked"],
                              "in_writing": su["in_writing"]} if su["given"] else None),
                   "results_named": results_named, "other_levers": [l for l in ("title", "scope", "perf_bonus", "training") if st["levers"].get(l, {}).get("given")],
                   "threat_without_offer": "competing_offer_no_flag" in st["signals"],
                   "captured_now_pct": sm.get("captured_now_pct"), "captured_later_pct": sm.get("captured_later_pct")}
    else:
        section = {"level_asked": False}
    v2 = _say_v2(st)
    say = []
    cards = list(base["cards"])
    for key, cid, quote in v2[:3]:
        c = talk.card(cid)
        say.append({"id": key, "title": SAY_TITLE[key], "what_happened": SAY_WHAT.get(key, c["rule"]), "you_said": quote,
                    "try": card_example(cid, st), "why": c["evidence"], "card_id": cid})
        cards.append(cid)
    say += base["say_it_better"][: max(0, 3 - len(say))]
    outcome_label = dict(N.OUTCOME_LABEL, noted="Mike noted your number", accepted="You accepted" if sc != "counteroffer" else "You chose to stay",
                         declined="You declined" if sc != "counteroffer" else "You chose to leave")
    band_text = (f"Mike's band was {talk.money(st['floor'])} to {talk.money(st['ceiling'], cur)}." if sc == "screening"
                 else base["hidden_range"]["text"])
    base.update(version=VERSION, scenario=sc, scenario_name=scenario_info(sc)["name"], objections=objections,
                who_moved={"mike": mike, "you": you, "mike_total": sum(m["to"] - m["from"] for m in mike),
                           "you_total": sum(y["from"] - y["to"] for y in you)},
                check=chk, deadline=deadline, section=section, say_it_better=say, cards=list(dict.fromkeys(cards)),
                outcome_label=outcome_label.get(st["outcome"] or "ended", outcome_label[None]),
                verdict=_verdict(st, base), hidden_range={"floor": st["floor"], "ceiling": st["ceiling"], "text": band_text})
    base["pressure_notes"] = [NOT_NOW_NOTE] if dl["said"] else []
    base["homework"] = talkcase.homework(st)
    base["repeats"] = {"count": st["repeats"] + 1, "quote": st.get("repeat_quote")} if st.get("repeats") else None
    base["case"] = st.get("case")
    for lw in base["levers_won"]:
        lw["value"] = lever_value_text(st, lw["lever"])
    base["missed_levers"] = [x for x in base["missed_levers"] if x["lever"] in _lever_list(st)]
    return base
