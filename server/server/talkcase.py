"""D118: the person's prepared case (results, reason, fallbacks), repeat detection, the 5-step strip and the debrief
homework. Code only; spec docs/features/tough-talk/prd-v3-prep.md."""
from __future__ import annotations

import difflib
import re

from . import talk

FALLBACKS = ("step_up", "sign_on", "review", "remote", "title", "part_now", "dated_raise")
FALLBACK_LABEL = {"step_up": "a step-up after probation", "sign_on": "a sign-on bonus", "review": "an earlier review",
                  "remote": "remote days", "title": "a title", "part_now": "a part of the raise now",
                  "dated_raise": "a dated raise"}
MAX_RESULTS, MAX_TEXT = 3, 200
STOP = set("""about after again also because been being could didn does doing done from have having here into just know
like look looking make more much need only over really said says same still that than thanks thank that's their them then
there these they thing think thinking this those very want were what when where which while will with would your you're
i'm i've it's we're don't based work aiming asking target dollars thousand hundred sixty fifty seventy eighty ninety forty
okay well mike sure right good great""".split())
REASON_MARK = re.compile(r"\b(because|based on|since|given|as i|thanks to)\b", re.I)
RESULT_RE = re.compile(r"\d+(?:\.\d+)?\s?(?:%|percent\b|x\b)|\bby (?:a |one )?(?:third|half|quarter)\b|\b(?:doubled|tripled|halved)\b",
                       re.I)
NUMWORD = re.compile(r"[$€£]?\d[\d,. ]*(?:k\b)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|"
                     r"sixty|seventy|eighty|ninety|hundred|thousand|dollars?|euros?|pounds?)\b", re.I)
REPEAT_SIM = 0.62


def parse_prep(block) -> dict | None:
    """The optional `negotiate.prep` block. Bad parts are dropped, never an error: prep is a help, not a gate."""
    if not isinstance(block, dict):
        return None
    results = [" ".join(str(r).split())[:MAX_TEXT] for r in (block.get("results") or []) if isinstance(r, str) and r.strip()]
    reason = block.get("reason") if isinstance(block.get("reason"), str) else ""
    fallbacks = [f for f in (block.get("fallbacks") or []) if f in FALLBACKS]
    return {"course": block.get("course") is True, "results": results[:MAX_RESULTS], "reason": " ".join(reason.split())[:MAX_TEXT],
            "fallbacks": list(dict.fromkeys(fallbacks))}


def init(st: dict, prep: dict | None) -> None:
    st["case"] = prep
    st.setdefault("case_used", [])
    st.setdefault("reason_lines", [])
    st.setdefault("repeats", 0)
    st.setdefault("repeat_quote", None)
    st.setdefault("repeat_noticed", False)
    st.setdefault("said_words", [])


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z']{3,}", text.lower()) if w not in STOP}


def _bare(text: str) -> str:
    return " ".join(NUMWORD.sub(" ", text.lower()).split())


def is_reason_line(text: str, cls=None) -> bool:
    return len(text.split()) >= 6 and bool(REASON_MARK.search(text) or (cls is not None and cls.justified))


def track(st: dict, text: str, cls=None) -> bool:
    """Note which case results the line used and whether it repeats an earlier reason. True = a repeat."""
    init(st, st.get("case"))
    words = _words(text)
    for i, r in enumerate((st.get("case") or {}).get("results") or []):
        if i not in st["case_used"] and (len(words & _words(r)) >= 2 or (RESULT_RE.search(r) and RESULT_RE.search(text)
                                                                         and len(words & _words(r)) >= 1)):
            st["case_used"].append(i)
    seen = set(st.setdefault("said_words", []))
    st["said_words"] = sorted(seen | words)
    if not is_reason_line(text, cls):
        return False
    earlier = st["reason_lines"]
    new_words = words - seen
    sim = max((difflib.SequenceMatcher(None, _bare(text), _bare(e["text"])).ratio() for e in earlier), default=0.0)
    repeat = bool(earlier) and not RESULT_RE.search(text) and (sim >= REPEAT_SIM or len(new_words) <= 1)
    earlier.append({"turn": st.get("user_turns"), "text": text})
    if repeat:
        st["repeats"] += 1
        st["repeat_quote"] = st["repeat_quote"] or talk.quote(earlier[0]["text"])
    return repeat


def unused_results(st: dict) -> list[str]:
    case = st.get("case") or {}
    return [r for i, r in enumerate(case.get("results") or []) if i not in (st.get("case_used") or [])]


def hint_context(st: dict) -> str:
    """The case block for the hint prompt (p11)."""
    case = st.get("case")
    lines = []
    if case and (case.get("results") or case.get("reason") or case.get("fallbacks")):
        un = unused_results(st)
        used = [r for i, r in enumerate(case.get("results") or []) if i in (st.get("case_used") or [])]
        lines.append("RESULTS NOT SAID YET: " + ("; ".join(un) if un else "none left, move to a trade"))
        if used:
            lines.append("RESULTS ALREADY SAID: " + "; ".join(used))
        if case.get("reason"):
            lines.append("WHY THIS NUMBER: " + case["reason"])
        if case.get("fallbacks"):
            lines.append("WHAT ELSE WOULD WORK: " + ", ".join(FALLBACK_LABEL[f] for f in case["fallbacks"]))
    else:
        lines.append("THEIR CASE: not prepared. Use a placeholder like [a result with a number, e.g. cut onboarding drop-off by a third].")
    if st.get("repeats"):
        lines.append(f"THEY KEEP REPEATING: \"{st.get('repeat_quote') or ''}\". Do not say that reason again.")
    return "\n".join(lines)


def talk_step(st: dict) -> int | None:
    """The 5-step strip (only when the course was taken): 1 number · 2 reason · 3 objection · 4 trade · 5 writing."""
    if not (st.get("case") or {}).get("course"):
        return None
    lev = st.get("levers") or {}
    su = lev.get("step_up") or {}
    if st.get("outcome") == "accepted" or su.get("in_writing") or "in_writing_asked" in (st.get("signals") or []):
        return 5
    if st.get("final") or su.get("pending") or su.get("given") or any(
            isinstance(v, dict) and (v.get("given") or v.get("pending")) for k, v in lev.items() if k != "step_up"):
        return 4
    if st.get("pending_obj"):
        return 3
    if st.get("asks"):
        return 2
    return 1


# ---------- debrief homework ----------

def _user_texts(st: dict) -> list[str]:
    return [t["text"] for t in st.get("turns", []) if t.get("text")]


def homework(st: dict) -> list[dict]:
    sc = st.get("scenario", "offer")
    texts = _user_texts(st)
    out: list[dict] = []
    if not any(RESULT_RE.search(t) for t in texts) and not st.get("case_used"):
        out.append({"id": "results", "text": "Write down 2–3 results with a number: what you did and what changed.",
                    "quote": None, "card_id": "X3"})
    if st.get("repeats"):
        n = st["repeats"] + 1
        out.append({"id": "repeated", "text": f"You gave the same reason {n} times. Bring a new fact each time Mike pushes back.",
                    "quote": st.get("repeat_quote"), "card_id": "X3"})
    reason_found = any(re.search(r"market|range|job post|research|scope|responsib|other offer|another offer|competing", t, re.I)
                       for t in texts)
    if sc in ("offer", "screening", "internship") and not reason_found:
        out.append({"id": "market", "text": "Find the range for this role: two or three job posts or a salary site.",
                    "quote": None, "card_id": "N1"})
    stuck = bool(st.get("final")) or st.get("check", {}).get("result") == "no_change"
    traded = any(a.get("lever") for a in st.get("asks", [])) or bool((st.get("levers") or {}).get("step_up", {}).get("pending")
                                                                     or (st.get("levers") or {}).get("step_up", {}).get("given"))
    if stuck and not traded:
        out.append({"id": "trade", "text": "Pick what you'd take if base is stuck: a step-up after probation, a sign-on bonus or an earlier review.",
                    "quote": None, "card_id": "N9"})
    un = next((o for o in st.get("objections_used", []) if o.get("answered") is False), None)
    if un:
        out.append({"id": "objection", "text": f"Prepare one answer to: \"{un['line']}\"", "quote": un.get("answer_quote"),
                    "card_id": objection_card(un["id"])})
    if sc == "raise":
        out.append({"id": "raise_criteria", "text": "Ask your lead for the criteria for the next level, and collect results since your last raise.",
                    "quote": None, "card_id": "R2"})
    elif sc == "counteroffer":
        out.append({"id": "why_leaving", "text": "Write down why you started looking.", "quote": None, "card_id": "C1"})
    if st.get("outcome") == "accepted" and "in_writing_asked" not in (st.get("signals") or []):
        out.append({"id": "writing", "text": "Ask for every promise in writing.", "quote": None, "card_id": "N10"})
    if not st.get("case"):
        out = out[:4] + [{"id": "prep_skipped", "text": "Next time, take 3 minutes to prepare your case first.", "quote": None,
                          "card_id": None}]
    return out[:5]


# ---------- objection cards ----------

OBJECTION_CARD = {}
for _ids, _card in ((("OF1", "OF2", "SC5", "RA1", "RA8", "IN3"), "X1"), (("OF6", "RA5", "RA6", "IN4", "IN1"), "X2"),
                    (("OF5", "RA3", "IN2", "CO6", "RP1"), "X3"), (("OF4", "SC7", "SC6"), "X4"), (("OF3",), "X5")):
    for _i in _ids:
        OBJECTION_CARD[_i] = _card


def objection_card(oid: str | None) -> str:
    return OBJECTION_CARD.get(oid or "", "O1")
