"""Salary negotiation practice: Mike plays a recruiter whose budget, style and concessions are held in code.

The model only phrases the move it is given (one line per turn, p7_recruiter); every number comes from the state here.
Nothing in this module calls a model, so a whole negotiation can be finished with the scripted lines alone.
Spec: docs/features/tough-talk/prd.md §4 and §9. All style numbers are assumptions (calibrate in playtests).
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from . import talk

TURN_CAP = 12
SIMPLE_UNITS = re.compile(r"^\s*(?:%|percent\b|per cent\b|days?\b|months?\b|weeks?\b|years?\b|yrs?\b|hours?\b|hrs?\b|minutes?\b|"
                          r"people\b|kids\b|times\b|x\b|am\b|pm\b)", re.I)
LEVER_ORDER = {"friendly": ("sign_on", "review", "pto", "remote", "perf_bonus"),
               "firm": ("review", "title", "sign_on", "perf_bonus"),
               "tight": ("sign_on", "perf_bonus")}


# ---------- amounts ----------

@dataclass
class Amount:
    value: int
    start: int
    end: int
    raw: str
    k: bool = False
    in_range: bool = False


NUMBER = re.compile(r"(?<![\w.])(\d{1,3}(?:[, ]\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})+|\d+(?:\.\d+)?)(?!\d)(\s?(?:k|K|thousand|grand)\b)?")
WORD_NUM = {"zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
            "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
            "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
            "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
WORD = re.compile(r"[A-Za-z]+")


def _digits_value(token: str) -> float:
    if re.fullmatch(r"\d{1,3}(?:[, ]\d{3})+(?:\.\d{1,2})?", token):
        return float(token.replace(",", "").replace(" ", ""))
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", token):
        return float(token.replace(".", ""))
    return float(token)


def _word_amounts(text: str) -> list[Amount]:
    out: list[Amount] = []
    words = [(m.group(0).lower(), m.start(), m.end()) for m in WORD.finditer(text)]
    i = 0
    while i < len(words):
        w, s, _e = words[i]
        start_i = i
        if w == "a" and i + 1 < len(words) and words[i + 1][0] in ("hundred", "thousand"):
            i += 1
            w = words[i][0]
        if w not in WORD_NUM and w not in ("hundred", "thousand"):
            i = start_i + 1
            continue
        total, current, last_end, j, seen_big = 0, 0, words[i][2], i, False
        if words[start_i][0] == "a":
            current = 1
        while j < len(words):
            w = words[j][0]
            gap = text[last_end:words[j][1]] if j > i else ""
            if j > i and not re.fullmatch(r"[\s\-]*", gap):
                break
            if w in WORD_NUM:
                current += WORD_NUM[w]
            elif w == "hundred":
                current = (current or 1) * 100
                seen_big = True
            elif w == "thousand":
                total += (current or 1) * 1000
                current = 0
                seen_big = True
            elif w == "and" and j + 1 < len(words) and words[j + 1][0] in WORD_NUM:
                pass
            else:
                break
            last_end = words[j][2]
            j += 1
        value = total + current
        end = last_end
        k = False
        m = re.match(r"\s?k\b", text[end:], re.I)
        if m and value < 1000:
            value *= 1000
            end += m.end()
            k = True
        if seen_big or k or value >= 20:
            out.append(Amount(int(value), words[start_i][1], end, text[words[start_i][1]:end], k or "thousand" in text[words[start_i][1]:end].lower()))
        i = max(j, start_i + 1)
    return out


def parse_amounts(text: str) -> list[Amount]:
    """Money amounts in what the user said, in the order said. Days, months, years, percentages and the like are
    ignored. `95k`, `95,000`, `95.000`, `95 000`, `$95k`, `95,000 EUR`, `ninety-five thousand`; "95 to 100k" is read
    as 95,000 to 100,000 (both amounts, the first one marked in_range)."""
    text = text or ""
    found: list[Amount] = []
    for m in NUMBER.finditer(text):
        token, suffix = m.group(1), m.group(2)
        try:
            value = _digits_value(token)
        except ValueError:
            continue
        end = m.end()
        if SIMPLE_UNITS.match(text[end:end + 14]):
            continue
        k = bool(suffix)
        if k:
            value *= 1000
        found.append(Amount(int(round(value)), m.start(1), end, text[m.start(1):end], k))
    found += [a for a in _word_amounts(text)
              if not SIMPLE_UNITS.match(text[a.end:a.end + 14]) and not any(f.start <= a.start < f.end for f in found)]
    found.sort(key=lambda a: a.start)
    for a, b in zip(found, found[1:]):
        if a.value < 1000 and not a.k and b.k and re.fullmatch(r"\s*(?:-|–|—|to|or|and)\s*", text[a.end:b.start]):
            a.value *= 1000
            a.k = True
            a.in_range = True
    return found


# ---------- classification ----------

ACCEPT = re.compile(r"\b(?:i accept|i'?ll take it|i will take it|we have a deal|deal|sounds (?:good|great|fair|perfect)|"
                    r"that works(?: for me)?|works for me|agreed|let'?s do it|i'?m happy with (?:that|this|it)|happy with that|"
                    r"yes|yeah|okay|ok|sure|fine by me|go ahead|i'?m in|that'?s fine|great)\b", re.I)
STRONG_ACCEPT = re.compile(r"\b(?:i accept|i'?ll take it|i will take it|we have a deal|deal|agreed|let'?s do it)\b", re.I)
NEGATED = re.compile(r"\b(?:not|n'?t|never|can'?t|cannot|won'?t|unable)\b[^.?!]{0,25}\b(?:accept|agree|take|do)\b|\bnot sure\b", re.I)
BUT = re.compile(r"\b(?:but|however|although|though|except|if only)\b", re.I)
DECLINE = re.compile(r"\b(?:decline|pass on|i'?ll pass|i will pass|not interested|no deal|can'?t accept|cannot accept|won'?t accept|"
                     r"not going to work|doesn'?t work for me|does not work for me|walk away|no,? thanks?|no,? thank you|"
                     r"i'?ll have to say no|turn (?:it|this) down|reject|no\.?)\b", re.I)
ASK_TIME = re.compile(r"(?:\b(?:need|take|have|like|want|get)\s+(?:some |a |more )?(?:time|few days|couple of days|day or two|the weekend)\b|"
                      r"\b(?:a|few|couple of) (?:few |couple of )?days\b|think (?:it|this|that) over|sleep on it|get back to you|"
                      r"think about it (?:and|over|until|tonight|overnight)|\b(?:until|by) (?:monday|tuesday|wednesday|thursday|friday|"
                      r"next week|tomorrow|the end of the week)\b|over the weekend|time to (?:decide|think|consider|review|discuss)|"
                      r"give me (?:some |a )?(?:time|day|days|week))", re.I)
ASK_WRITTEN = re.compile(r"(?:in writing|written (?:offer|terms|confirmation)|send (?:me )?(?:the |an? |your )?(?:full |written )?"
                         r"(?:offer|terms|details|contract|letter|package|summary)|email (?:me )?(?:the )?(?:offer|terms)|"
                         r"put (?:it|that|this) in (?:an? )?(?:email|writing))", re.I)
PAUSE = re.compile(r"\blet me (?:think|consider)\b|\bgive me a (?:second|moment|minute)\b|\bone moment\b|\bhmm+\b|\bjust a moment\b", re.I)
ASK_RANGE = re.compile(r"(?:what(?:'s| is)? (?:the |your )?(?:salary )?(?:range|budget|max(?:imum)?|ceiling|top|limit)|how high can you go|"
                       r"what can you (?:offer|do)|what are you (?:offering|thinking)|you (?:go )?first|what did you (?:have in mind|plan)|"
                       r"what(?:'s| is) on the table|\brange\b|\bbudget\b|\bmaximum\b|\bmax\b)", re.I)
DEFLECT = re.compile(r"\b(?:depends|not sure|flexible|open to (?:discuss|negotiat)|i'?d rather not|prefer not|no idea|don'?t know|"
                     r"whatever is fair|up to you)\b", re.I)
CURRENT_PAY = re.compile(r"\b(?:i (?:currently )?(?:earn|make|am making|am earning|get)|currently (?:earning|making|on|paid)|"
                         r"my (?:current )?salary (?:is|now)|i'?m on|my current (?:pay|salary))\b", re.I)
ULTIMATUM = re.compile(r"take it or leave it|or i walk|walk away|bottom line|my final offer|non[- ]negotiable|last offer|deal[- ]breaker", re.I)
APOLOGY = re.compile(r"\b(?:sorry|apolog\w+|excuse me|i know (?:it'?s|this is) a lot|hope that'?s (?:ok|okay|fine)|"
                     r"i don'?t want to be (?:difficult|pushy|greedy))\b", re.I)
STEP_TIME = re.compile(r"(?:\b(?:after|post)[- ](?:the |my |a )?(?:first )?(?:probation(?:ary)?(?: period)?|trial(?: period)?|internship|"
                       r"(?:\d+|three|six|two|four|twelve)[- ]?months?)|\bin (?:\d+|three|six) months\b|"
                       r"\bat (?:the )?(?:(?:\d+|three|six)[- ]month )?(?:review|mark)\b|\bafter (?:the )?review\b|"
                       r"\bby (?:the )?(?:\d+|three|six) months\b|\b(?:three|six|3|6)[- ]month (?:review|probation|trial|mark)\b|"
                       r"\bonce (?:the )?probation)", re.I)
STEP_MONTHS = re.compile(r"\b(\d+|three|six|two|four|twelve)[- ]?months?\b", re.I)
WRITING = re.compile(r"in writing|in the (?:offer|contract|letter)|in my (?:offer|contract)|written|send it|put it in|offer letter", re.I)
NUM_WORDS = {"two": 2, "three": 3, "four": 4, "six": 6, "twelve": 12}


@dataclass
class Cls:
    kind: str
    amount: int | None = None
    amounts: list[Amount] = field(default_factory=list)
    lever: str | None = None
    lever_amount: int | None = None
    justified: bool = False
    new_reason: bool = False
    reasons: list[str] = field(default_factory=list)
    also_lever: str | None = None
    now: int | None = None
    later: int | None = None
    months: int | None = None
    criteria: bool = False
    writing: bool = False
    revealed_current: bool = False
    bluff: bool = False
    attempted_amount: bool = False
    pause: bool = False


def _compile(patterns: list[str]) -> list[re.Pattern]:
    return [re.compile(p, re.I) for p in patterns]


def reasons_in(text: str, has_real_offer: bool) -> tuple[list[str], bool]:
    """Reason words found in an ask, and whether a competing offer was mentioned without the form flag."""
    d = talk.data()
    found = [p for p in d["reason_words"] if re.search(p, text, re.I)]
    mentioned = any(re.search(p, text, re.I) for p in d["offer_reason_words"])
    bluff = False
    if mentioned:
        if has_real_offer:
            found.append("competing_offer")
        else:
            bluff = True
    return found, bluff


def lever_in(text: str) -> str | None:
    kw = talk.data()["lever_keywords"]
    for lever in ("perf_bonus", "equity", "sign_on", "review", "pto", "remote", "title", "package"):
        if any(re.search(p, text, re.I) for p in kw[lever]):
            return lever
    return None


def _months(text: str) -> int:
    m = STEP_MONTHS.search(text)
    if m:
        raw = m.group(1).lower()
        n = int(raw) if raw.isdigit() else NUM_WORDS.get(raw, 3)
        return 3 if n <= 4 else 6
    if re.search(r"\bsix\b|\b6\b", text, re.I):
        return 6
    return 6 if re.search(r"review|mark", text, re.I) and not re.search(r"probation|trial|internship", text, re.I) else 3


def classify(text: str, st: dict) -> Cls:
    """What the user's line is, by code only. Order: step-up, pause, time/written, decline, accept, lever, counter,
    range question, other (a counter with a lever in it stays a counter, the lever is noted)."""
    text = " ".join((text or "").split())
    amounts = parse_amounts(text)
    ref = st["offer"] or st["target"]
    valid = [a for a in amounts if 0.3 * ref <= a.value <= 3 * ref]
    cls = Cls("other", amounts=amounts)
    cls.attempted_amount = any(a.value >= 1000 or a.k for a in amounts)
    reasons, cls.bluff = reasons_in(text, st["has_real_offer"])
    used = {w for ask in st["asks"] for w in ask.get("reason_words", [])}
    cls.reasons = reasons
    cls.justified = bool(reasons)
    cls.new_reason = bool(set(reasons) - used)
    cls.criteria = any(re.search(p, text, re.I) for p in talk.data()["criteria_words"]) or bool(reasons)
    cls.writing = bool(WRITING.search(text))
    cls.revealed_current = bool(CURRENT_PAY.search(text) and valid)
    offered = st["offer"] is not None
    su = st["levers"]["step_up"]
    lever = lever_in(text)
    pending_su = su["given"] or su["pending"]
    later_known = (su["later_amount"] or (su["pending"] or {}).get("later")) if pending_su else None
    detail_ask = bool(cls.writing or re.search(r"\bgoals?\b|\bcriteria\b|\bmilestones?\b", text, re.I))
    if offered and pending_su and detail_ask and not ASK_TIME.search(text) and all(a.value == later_known for a in valid):
        cls.kind = "step_up_detail"                  # asking to write the agreed step-up down: not a counter
        return cls
    if offered and STEP_TIME.search(text) and valid and max(a.value for a in valid) > st["offer"]:
        values = sorted(a.value for a in valid)
        cls.kind = "step_up"
        cls.later = values[-1]
        cls.now = values[0] if len(values) > 1 else st["offer"]
        cls.months = _months(text)
        return cls
    if offered and (su["given"] or su["pending"]) and not valid and (cls.writing or any(
            re.search(p, text, re.I) for p in talk.data()["criteria_words"])) and not ASK_TIME.search(text):
        cls.kind = "step_up_detail"
        return cls
    if ASK_TIME.search(text) and not valid:
        cls.kind = "ask_time"
        return cls
    if ASK_WRITTEN.search(text) and not valid:
        cls.kind = "ask_written"
        return cls
    if PAUSE.search(text) and not cls.attempted_amount and len(text.split()) <= 14:
        cls.kind, cls.pause = "pause", True
        return cls
    if DECLINE.search(text) and not valid and not (lever and lever != "equity"):
        cls.kind = "decline"
        return cls
    if offered and ACCEPT.search(text) and not NEGATED.search(text) and not BUT.search(text) \
            and not any(a.value != st["offer"] for a in valid) and ("?" not in text or STRONG_ACCEPT.search(text)):
        cls.kind = "accept"
        return cls
    rising = [a for a in valid if a.value != st["offer"]] if offered else valid
    if rising and not (lever and not offered):
        cls.kind, cls.amount, cls.also_lever = "counter", rising[0].value, lever if lever != "package" else lever
        return cls
    if lever:
        cls.kind, cls.lever = "lever_ask", lever
        small = [a.value for a in amounts if a.value >= 50]
        cls.lever_amount = small[0] if small else None
        return cls
    if ASK_RANGE.search(text) or DEFLECT.search(text):
        cls.kind = "ask_range"
        return cls
    return cls


# ---------- state ----------

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def step_for(ceiling: float) -> int:
    return 500 if ceiling >= 20000 else 50


def round_up(v: float, step: int) -> int:
    return int(math.ceil(v / step - 1e-9) * step)


def round_near(v: float, step: int) -> int:
    return int(math.floor(v / step + 0.5) * step)


def new_state(form: dict, style: str, surprise: bool = False) -> dict:
    """The negotiation as it starts. `form` is the validated `negotiate` block of the start message."""
    nums = talk.data()["style_numbers"][style]
    low, high, target = form.get("job_low"), form.get("job_high"), form["target"]
    ceiling = high if high else target
    floor = low if low else round_near(0.85 * target, step_for(target))
    if high and ceiling < floor:
        floor = ceiling
    step = step_for(ceiling)
    opening = round_near(floor + nums["opening_frac"] * (ceiling - floor), step)
    opening = int(clamp(opening, floor, ceiling))
    cap = lambda frac: int(ceiling * frac // 50 * 50)       # noqa: E731
    levers = {"sign_on": {"cap_pct": 3 if style != "friendly" else 5, "cap": cap(0.03 if style != "friendly" else 0.05),
                          "given": False, "value": None},
              "review": {"available": style != "tight", "given": False, "months": 6},
              "pto": {"cap": 2, "given": False, "value": None},
              "remote": {"cap": 2, "given": False, "value": None},
              "title": {"available": style == "firm", "given": False},
              "perf_bonus": {"cap_pct": 10 if style == "friendly" else 5, "given": False, "value": None},
              "step_up": {"available": True, "after_months": None, "later_amount": None, "now_amount": None,
                          "criteria_asked": False, "in_writing": False, "given": False, "pending": None}}
    return {"style": style, "surprise": bool(surprise), "currency": form.get("currency") or "USD", "period": "year",
            "role": form["role"], "job_low": low, "job_high": high, "target": target,
            "has_real_offer": bool(form.get("has_real_offer")), "floor": int(floor), "ceiling": int(ceiling),
            "opening": int(opening), "step": step, "offer": None, "round": 0, "round_cap": nums["round_cap"],
            "final": False, "phase": "expectations", "user_first_number": None, "user_anchor": None,
            "levers": levers, "asks": [], "moves": [], "pressure_used": [], "declines": 0, "user_turns": 0,
            "outcome": None, "guard_replacements": 0, "hints_used": [], "flags": [], "signals": {}, "turns": [],
            "pressed": 0, "figure_asked": 0, "counters": 0, "same_streak": 0, "last_counter": None,
            "opening_turn_offer": None, "offer_path": [], "last_move": "ask_expectations", "last_pressure": None}


def _sig(st: dict, key: str, turn: int, quote: str = "") -> None:
    st["signals"].setdefault(key, {"turn": turn, "quote": talk.quote(quote) if quote else ""})


def _flag(st: dict, flag: str) -> None:
    if flag not in st["flags"]:
        st["flags"].append(flag)


def _path(st: dict, turn: int, label: str) -> None:
    st["offer_path"].append({"turn": turn, "offer": st["offer"], "label": label})


# ---------- levers ----------

def lever_available(st: dict, lever: str) -> bool:
    style, lv = st["style"], st["levers"]
    if lv[lever].get("given"):
        return False
    if lever == "sign_on":
        return style == "friendly" or (style == "firm" and st["final"]) or (style == "tight" and st["round"] >= 2)
    if lever == "perf_bonus":
        return style == "friendly" or (style == "firm" and st["final"]) or (style == "tight" and st["round"] >= 2)
    if lever in ("pto", "remote"):
        return style == "friendly"
    if lever in ("review", "title"):
        return bool(lv[lever]["available"])
    return False


def _grant(st: dict, lever: str, justified: bool, asked: int | None) -> tuple[str, dict]:
    """Give a lever: returns the words for it and the lever value. Friendly gives half to a bare ask."""
    lv, style, cur = st["levers"][lever], st["style"], st["currency"]
    full = style != "friendly" or justified
    if lever == "sign_on":
        value = lv["cap"] if full else int(lv["cap"] / 2 // 50 * 50)
        if asked and asked < value:
            value = int(asked // 50 * 50) or value
        lv["value"] = value
        text = f"a sign-on bonus of {talk.money(value, cur)}"
    elif lever == "perf_bonus":
        pct = lv["cap_pct"] if full else lv["cap_pct"] // 2
        lv["value"] = pct
        text = f"a yearly performance bonus of up to {pct}% of base, paid separately from base"
    elif lever == "review":
        lv["value"] = lv["months"]
        text = f"a salary review at {lv['months']} months"
    elif lever == "pto":
        lv["value"] = lv["cap"] if full else 1
        text = f"{lv['value']} extra day{'s' if lv['value'] != 1 else ''} off a year"
    elif lever == "remote":
        lv["value"] = lv["cap"] if full else 1
        text = f"{lv['value']} remote day{'s' if lv['value'] != 1 else ''} a week"
    else:
        lv["value"] = "senior"
        text = "a move up to a senior title"
    lv["given"] = True
    return text, lv


def lever_value_text(st: dict, lever: str) -> str:
    lv, cur = st["levers"][lever], st["currency"]
    if lever == "sign_on":
        return talk.money(lv["value"], cur)
    if lever == "perf_bonus":
        return f"up to {lv['value']}% of base a year"
    if lever == "review":
        return f"at {lv['months']} months"
    if lever == "pto":
        return f"{lv['value']} extra days"
    if lever == "remote":
        return f"{lv['value']} days a week"
    return "senior title"


def _next_lever(st: dict) -> str | None:
    return next((l for l in LEVER_ORDER[st["style"]] if lever_available(st, l)), None)


# ---------- replies ----------

@dataclass
class Reply:
    move: str
    amount: int | None = None
    lever_text: str | None = None
    numbers: list[int] = field(default_factory=list)      # other numbers the line may say (lever values, step-up amounts)
    pressure: list[str] = field(default_factory=list)
    extra: list[str] = field(default_factory=list)        # scripted sentences appended after the line (content only)
    closing: bool = False
    final: bool = False
    now: int | None = None
    later: int | None = None
    months: int | None = None
    time_text: str = ""


def _record(st: dict, turn: int, move: str, before: int | None, quote: str, cause: str) -> None:
    st["moves"].append({"turn": turn, "move": move, "offer_before": before, "offer_after": st["offer"],
                        "cause": cause, "quote": talk.quote(quote)})


def _pressure(st: dict, key: str) -> list[str]:
    if key in st["pressure_used"]:
        return []
    st["pressure_used"].append(key)
    st["last_pressure"] = key
    return [key]


def _state_opening(st: dict, turn: int, text: str) -> Reply:
    st["offer"] = st["opening"]
    st["phase"] = "offer"
    _path(st, turn, "Opening offer")
    _record(st, turn, "state_offer", None, text, "opening")
    press = _pressure(st, "deadline_48h") if st["style"] == "tight" else []
    return Reply("state_offer", amount=st["offer"], pressure=press)


def _close(st: dict, outcome: str) -> None:
    st["outcome"], st["phase"] = outcome, "closed"


def step(st: dict, text: str) -> Reply:
    """One user turn. Changes `st` in place (pass a copy if the reply may be thrown away) and returns the move Mike makes."""
    st["user_turns"] += 1
    turn = st["user_turns"]
    if st["phase"] == "closed":
        return Reply("closed_again", closing=True)
    text = " ".join((text or "").split())
    cls = classify(text, st)
    st["turns"].append({"turn": turn, "text": text, "cls": cls.kind})
    _signals(st, cls, text, turn)
    reply = _handle(st, cls, text, turn)
    if st["phase"] != "closed" and st["user_turns"] >= talk.data()["turn_cap"]:
        _close(st, "turn_cap")
        reply = Reply("close_turn_cap", amount=st["offer"], closing=True)
    reply.closing = reply.closing or st["phase"] == "closed"
    reply.final = st["final"]
    st["last_move"] = reply.move
    return reply


def _signals(st: dict, cls: Cls, text: str, turn: int) -> None:
    if len(APOLOGY.findall(text)) >= 2:
        _sig(st, "apologised", turn, text)
    if PAUSE.search(text):
        _sig(st, "paused", turn, text)
    if ULTIMATUM.search(text):
        _sig(st, "ultimatum", turn, text)
    if cls.bluff:
        _sig(st, "competing_offer_no_flag", turn, text)
    if cls.revealed_current:
        _sig(st, "revealed_current", turn, text)
        _flag(st, "revealed_current")
    if cls.kind in ("ask_time", "ask_written"):
        _sig(st, "asked_time", turn, text)
    if cls.kind == "lever_ask" or cls.also_lever:
        _sig(st, "asked_package", turn, text)


def _handle(st: dict, cls: Cls, text: str, turn: int) -> Reply:
    kind = cls.kind
    if kind == "ask_time" or kind == "ask_written":
        if st["offer"] is None and kind == "ask_written":
            kind = "other"
        else:
            _close(st, "time")
            return Reply("grant_time", amount=st["offer"], closing=True, time_text=talk.data()["recruiter_lines"]["time_text"][st["style"]])
    if kind == "decline":
        st["declines"] += 1
        if st["declines"] >= 2:
            _close(st, "declined")
            return Reply("close_declined", closing=True)
        return Reply("decline_first", amount=st["offer"])
    if st["offer"] is None:
        return _expectations(st, cls, text, turn)
    if kind == "accept":
        if (st["counters"] == 0 and st["user_first_number"] is None and not st["asks"]
                and not any(m["move"] in ("concede", "concede_final", "give_lever", "step_up") for m in st["moves"])):
            _sig(st, "accepted_first_offer", turn, text)
        _close(st, "accepted")
        return Reply("close_accepted", amount=st["offer"], closing=True)
    if kind == "counter":
        return _counter(st, cls, text, turn)
    if kind == "step_up":
        return _step_up(st, cls, text, turn)
    if kind == "step_up_detail":
        return _step_up_detail(st, cls, text, turn)
    if kind == "lever_ask":
        return _lever(st, cls, text, turn)
    if kind == "ask_range":
        return Reply("no_range", amount=st["offer"])
    if kind == "pause":
        return Reply("wait_ack", amount=st["offer"])
    if cls.attempted_amount and st["figure_asked"] < 1:
        st["figure_asked"] += 1
        return Reply("ask_figure", amount=st["offer"])
    return Reply("answer_other", amount=st["offer"])


def _expectations(st: dict, cls: Cls, text: str, turn: int) -> Reply:
    kind = cls.kind
    if kind == "counter" and cls.amount:
        n = cls.amount
        st["user_first_number"] = n
        st["user_anchor"] = n
        if n < st["target"]:
            _sig(st, "first_number_below_target", turn, text)
        if cls.revealed_current:
            _flag(st, "revealed_current")
        st["asks"].append(_ask(cls, n, None, text, turn))
        if n <= st["opening"]:
            st["offer"] = min(st["opening"], round_up(n, st["step"]))
            st["phase"] = "offer"
            _flag(st, "named_below_opening")
            _path(st, turn, "Opening offer")
            _record(st, turn, "confirm_number", None, text, "named_below_opening")
            press = _pressure(st, "deadline_48h") if st["style"] == "tight" else []
            return Reply("confirm_number", amount=st["offer"], pressure=press)
        st["phase"] = "bargaining"
        st["offer"] = st["opening"]
        _path(st, turn, "Opening offer")
        _record(st, turn, "state_offer", None, text, "opening")
        press = _pressure(st, "deadline_48h") if st["style"] == "tight" else []
        return Reply("state_offer", amount=st["offer"], pressure=press)
    if kind == "ask_range" or kind == "other" and not cls.attempted_amount and False:
        if st["style"] == "friendly" or st["pressed"] >= 1:
            return _state_opening(st, turn, text)
        st["pressed"] += 1
        return Reply("press_number")
    if st["figure_asked"] < 1:
        st["figure_asked"] += 1
        return Reply("ask_figure")
    return _state_opening(st, turn, text)


def _ask(cls: Cls, amount: int | None, lever: str | None, text: str, turn: int) -> dict:
    return {"turn": turn, "amount": amount, "lever": lever, "justified": cls.justified, "new_reason": cls.new_reason,
            "reason_words": list(cls.reasons), "quote": talk.quote(text)}


def _counter(st: dict, cls: Cls, text: str, turn: int) -> Reply:
    a = cls.amount
    before = st["offer"]
    st["counters"] += 1
    st["user_anchor"] = max(st["user_anchor"] or 0, a)
    if a >= before * 1.03:
        _sig(st, "counter_above_offer", turn, text)
    if a % 1000 != 0:
        _sig(st, "precise_number", turn, text)
    st["asks"].append(_ask(cls, a, None, text, turn))
    if cls.also_lever:
        _sig(st, "asked_package", turn, text)
    prev = st["last_counter"]
    st["same_streak"] = st["same_streak"] + 1 if prev and abs(a - prev) <= 0.01 * prev and not cls.new_reason else 0
    st["last_counter"] = a
    if a <= before:
        _flag(st, "countered_below_offer")
        _held(st, turn, before, a, text, "below_offer")
        return Reply("hold_confirm", amount=before)
    if st["final"]:
        lever = _next_lever(st)
        if lever:
            _held(st, turn, before, a, text, "base_final")
            return _offer_lever(st, lever, True, turn, text, by="offered", cause="offered_when_final")
        _held(st, turn, before, a, text, "base_final")
        return Reply("hold_final", amount=before)
    nums = talk.data()["style_numbers"][st["style"]]
    goal = min(a, st["ceiling"])
    mult = nums["concession"] if cls.justified else nums["concession"] * nums["unjustified_mult"]
    delta = mult * (goal - before)
    new = before if delta <= 0 else min(round_up(before + delta, st["step"]), goal)
    st["offer"] = int(new)
    st["round"] += 1
    cause = "competing_offer" if "competing_offer" in cls.reasons and cls.new_reason else \
        "justified_counter" if cls.justified else "bare_counter"
    if new != before:
        _path(st, turn, "After your counter")
        _record(st, turn, "concede", before, text, cause)
    _evaluate_final(st, cls)
    press = []
    if st["style"] == "friendly" and st["round"] == 2:
        press = _pressure(st, "deadline_soft")
    elif st["style"] == "firm" and st["round"] == 2:
        press = _pressure(st, "other_candidates")
    elif st["style"] == "tight" and st["round"] == 1:
        press = _pressure(st, "standard_role")
    if a > st["ceiling"]:
        reply = Reply("over_budget", amount=st["offer"], pressure=press)
        lever = _next_lever(st)
        if lever:
            text_l, _ = _grant(st, lever, cls.justified, None)
            reply.lever_text = text_l
            reply.numbers = _lever_numbers(st, lever)
            st["moves"].append({"turn": turn, "move": "give_lever", "offer_before": st["offer"], "offer_after": st["offer"],
                                "cause": f"lever:{lever}", "quote": talk.quote(text), "lever": lever, "by": "offered"})
        return reply
    if new == before:
        _held(st, turn, before, a, text, "base_final" if st["final"] else "no_reason")
        return Reply("hold_final" if st["final"] else "hold_same", amount=st["offer"], pressure=press)
    return Reply("concede_final" if st["final"] else "concede", amount=st["offer"], pressure=press)


def _held(st: dict, turn: int, offer: int, asked: int, text: str, why: str) -> None:
    """A moment Mike kept the base offer unchanged after the user's counter."""
    st["moves"].append({"turn": turn, "move": "hold", "offer_before": offer, "offer_after": offer, "cause": why,
                        "quote": talk.quote(text), "asked": asked})


def _evaluate_final(st: dict, cls: Cls) -> None:
    final = st["round"] >= st["round_cap"]
    if st["style"] == "friendly" and st["offer"] >= 0.9 * st["ceiling"]:
        final = True
    if st["style"] == "firm" and st["same_streak"] >= 1:
        final = True
    if st["style"] == "tight" and st["round"] >= 1 and not (cls.justified and st["round"] == 1):
        final = True
    if final and not st["final"]:
        st["final"] = True
        st["phase"] = "final"
    elif not final and st["phase"] == "offer":
        st["phase"] = "bargaining"
    if st["phase"] == "offer":
        st["phase"] = "bargaining"


def _lever_numbers(st: dict, lever: str) -> list[int]:
    lv = st["levers"][lever]
    if lever == "sign_on":
        return [lv["value"]]
    if lever == "perf_bonus":
        return [lv["value"]]
    if lever == "review":
        return [lv["months"]]
    if lever in ("pto", "remote"):
        return [lv["value"]]
    return []


def _offer_lever(st: dict, lever: str, justified: bool, turn: int, text: str, by: str, cause: str, asked: int | None = None) -> Reply:
    words, _ = _grant(st, lever, justified, asked)
    st["moves"].append({"turn": turn, "move": "give_lever", "offer_before": st["offer"], "offer_after": st["offer"],
                        "cause": cause, "quote": talk.quote(text), "lever": lever, "by": by})
    return Reply("give_lever", amount=st["offer"], lever_text=words, numbers=_lever_numbers(st, lever))


def _lever(st: dict, cls: Cls, text: str, turn: int) -> Reply:
    lever = cls.lever
    st["asks"].append(_ask(cls, None, lever, text, turn))
    if lever == "equity":
        return Reply("equity", amount=st["offer"])
    if lever == "package":
        pick = _next_lever(st)
        if pick is None:
            return Reply("lever_unavailable", amount=st["offer"])
        return _offer_lever(st, pick, cls.justified, turn, text, "ask", f"lever_ask:{pick}")
    if st["levers"][lever].get("given"):
        return Reply("lever_repeat", amount=st["offer"])
    if not lever_available(st, lever):
        return Reply("lever_unavailable", amount=st["offer"])
    return _offer_lever(st, lever, cls.justified, turn, text, "ask", f"lever_ask:{lever}", cls.lever_amount)


def _step_up(st: dict, cls: Cls, text: str, turn: int) -> Reply:
    su = st["levers"]["step_up"]
    _sig(st, "step_up_asked", turn, text)
    if cls.criteria:
        su["criteria_asked"] = True
        _sig(st, "criteria_named", turn, text)
    if cls.writing:
        su["in_writing"] = True
        _sig(st, "in_writing_asked", turn, text)
    st["asks"].append(_ask(cls, cls.later, "step_up", text, turn))
    st["user_anchor"] = max(st["user_anchor"] or 0, cls.later)
    style, months = st["style"], cls.months
    if style == "tight" and not st["final"]:
        return Reply("step_up_not_yet", amount=st["offer"])
    if st["levers"]["step_up"]["given"]:
        return Reply("lever_repeat", amount=st["offer"])
    later = min(cls.later, st["ceiling"])
    if later <= st["offer"]:
        return Reply("step_up_rejected", amount=st["offer"])
    if style == "tight" and not (cls.criteria or cls.justified):
        su["pending"] = {"later": later, "months": months}
        return Reply("step_up_ask_criteria", amount=st["offer"])
    return _grant_step_up(st, later, months, cls, text, turn)


def _grant_step_up(st: dict, later: int, months: int, cls: Cls, text: str, turn: int) -> Reply:
    su = st["levers"]["step_up"]
    counter = False
    if st["style"] == "firm" and months == 3:
        months, counter = 6, True
        _flag(st, "step_up_months_countered")
    before = st["offer"]
    if st["style"] == "friendly" and cls.now and cls.now > before and cls.justified:
        st["offer"] = int(min(cls.now, round_up(before * 1.05, st["step"]), st["ceiling"]))
        if st["offer"] != before:
            _path(st, turn, "After your step-up")
    su.update(given=True, after_months=months, later_amount=later, now_amount=st["offer"], pending=None)
    st["moves"].append({"turn": turn, "move": "step_up", "offer_before": before, "offer_after": st["offer"],
                        "cause": "step_up", "quote": talk.quote(text), "lever": "step_up", "by": "ask"})
    reply = Reply("step_up_months_counter" if counter else "step_up_grant", amount=st["offer"], now=st["offer"],
                  later=later, months=months, numbers=[st["offer"], later, months])
    if su["in_writing"]:
        reply.extra.append("step_up_writing")
    return reply


def _step_up_detail(st: dict, cls: Cls, text: str, turn: int) -> Reply:
    su = st["levers"]["step_up"]
    if cls.criteria:
        su["criteria_asked"] = True
        _sig(st, "criteria_named", turn, text)
    if cls.writing:
        su["in_writing"] = True
        _sig(st, "in_writing_asked", turn, text)
    if su["pending"] and (cls.criteria or cls.justified):
        p = su["pending"]
        return _grant_step_up(st, p["later"], p["months"], cls, text, turn)
    if cls.writing and su["given"]:
        return Reply("step_up_writing", amount=st["offer"], later=su["later_amount"], months=su["after_months"],
                     numbers=[su["later_amount"], su["after_months"]])
    return Reply("step_up_detail", amount=st["offer"])


# ---------- words ----------

def fmt(st: dict, value: int | None) -> str:
    return talk.money(value, st["currency"])


# Moves whose line is always the fixed one: they carry the step-up numbers, which a small model garbles.
SCRIPTED_MOVES = ("step_up_writing", "step_up_grant", "step_up_months_counter", "step_up_detail")


def scripted_line(st: dict, reply: Reply, name: str = "", base_only: bool = False) -> str:
    """The fixed line for a move (used when no model is available or the model's line fails the number guard).
    `base_only` leaves off the scripted extras and pressure sentences (the code appends those to a model line, see tail)."""
    d = talk.data()
    lines = d["recruiter_lines"]
    table = lines.get(reply.move) or lines["answer_other"]
    key = st["style"] if st["style"] in table else "*"
    template = table.get(key) or next(iter(table.values()))
    move = reply.move
    if reply.amount is None:
        alt = lines.get(move + "_noamount") or (lines[move].get("none") if "none" in lines[move] else None)
        template = alt["*"] if isinstance(alt, dict) else alt or template
        if "{amount}" in template:
            template = lines["answer_other_noamount"]["*"]
    su = st["levers"]["step_up"]
    text = template.format(goals=" and the goals" if su["criteria_asked"] else "", extras=_agreed_extras(st) if move == "close_accepted" else "",
                           amount=fmt(st, reply.amount), lever=reply.lever_text or "", role=st["role"],
                           time=reply.time_text, now=fmt(st, reply.now), later=fmt(st, reply.later),
                           months=reply.months or "", hi=f"Hi {name}," if name else "Hi,")
    return text if base_only else " ".join([text, *tail(reply)])


def _agreed_extras(st: dict) -> str:
    """What was agreed besides base, for the closing line: the step-up (with its goals) and any levers given."""
    parts = []
    su = st["levers"]["step_up"]
    if su["given"]:
        goals = " tied to the goals" if su["criteria_asked"] else ""
        parts.append(f"rising to {fmt(st, su['later_amount'])} after {su['after_months']} months{goals}")
    lv = st["levers"]
    for lever in ("sign_on", "perf_bonus", "review", "pto", "remote", "title"):
        if lv[lever].get("given"):
            parts.append({"sign_on": "a sign-on bonus of {v}", "perf_bonus": "a yearly performance bonus {v}",
                          "review": "a salary review {v}", "pto": "{v} of extra time off", "remote": "{v} remote",
                          "title": "a {v}"}[lever].format(v=lever_value_text(st, lever)))
    return (", " + ", ".join(parts)) if parts else ""


def card_example(cid: str, st: dict | None) -> str:
    """The card's example with the real numbers of this call where we know them; the static text otherwise."""
    base = talk.card(cid)["example"]
    if not st:
        return base
    su, offer = st["levers"]["step_up"], st["offer"]
    anchor = st["user_anchor"] or st["target"]
    m = lambda v: talk.money(v)           # noqa: E731
    if cid == "N9" and offer:
        return f"If {m(offer)} is the limit today, could we agree on {m(anchor)} after the three-month probation?"
    if cid == "N10":
        if su["given"]:
            return f"Great. Can we write the {m(su['later_amount'])} at {su['after_months']} months and the goals into the offer?"
        return base
    if cid == "N5":
        return f"I've led two launches like this one, so I'm asking for {m(anchor)}."
    if cid == "N1":
        return f"Based on the scope, I'm looking at {m(int(round(st['target'] * 1.015 / 250) * 250))}."
    return base


def tail(reply: Reply) -> list[str]:
    """Scripted sentences that always follow the move: step-up in-writing line, then the pressure line (content only)."""
    lines = talk.data()["recruiter_lines"]
    return [lines[k]["*"] for k in reply.extra] + [lines["pressure"][k] for k in reply.pressure]


def opening_line(st: dict, name: str = "") -> str:
    lines = talk.data()["recruiter_lines"]["opening"]
    return lines[st["style"]].format(hi=f"Hi {name}," if name else "Hi,", role=st["role"])


def restate_line(st: dict) -> str:
    lines = talk.data()["recruiter_lines"]["restate_offer"]
    if st["offer"] is None:
        return lines["none"]
    return lines["*"].format(amount=fmt(st, st["offer"]))


AMOUNT_IN_LINE = re.compile(r"\b\d[\d,. ]*\d(?:\s?[kK])?\b|\b\d(?:\s?[kK])?\b")
SMALL_UNIT = re.compile(r"^\s*(?:days?|months?|weeks?|hours?|hrs?|years?|minutes?)\b", re.I)
LEAK_WORDS = re.compile(r"\b(?:maximum|ceiling|upper limit|top of (?:the|our) (?:range|budget)|our budget is|budget is|budget of|"
                        r"the most we can)\b", re.I)


def guard_ok(line: str, allowed: list[int]) -> bool:
    """False when a recruiter line says a number that is not on the allowed list (the move's amount, lever values),
    or names a budget or maximum. Small counts with a unit (days, months, hours) are fine."""
    if not line.strip() or LEAK_WORDS.search(line):
        return False
    allowed_set = {int(x) for x in allowed if x is not None}
    for a in parse_amounts(line):
        if a.value in allowed_set:
            continue
        return False
    for m in re.finditer(r"\d[\d,. ]*\d|\d", line):
        token = m.group(0).strip(" ,.")
        try:
            value = _digits_value(token)
        except ValueError:
            continue
        if int(value) in allowed_set:
            continue
        if value <= 99 and SMALL_UNIT.match(line[m.end():m.end() + 14]):
            continue
        if re.match(r"\s?[kK]\b", line[m.end():m.end() + 2]) and int(value * 1000) in allowed_set:
            continue
        return False
    return True


def numbers_allowed(reply: Reply, st: dict) -> list[int]:
    out = [reply.amount, reply.now, reply.later, reply.months, *reply.numbers]
    if reply.pressure or reply.extra:
        out += []
    return [x for x in out if x is not None]


def model_input(st: dict, reply: Reply, last_user_line: str) -> dict:
    """What the model sees for one recruiter line. No ceiling, floor, shares or round cap: only the move and the number."""
    return {"role": st["role"], "style_brief": talk.data()["style_brief"][st["style"]], "move": reply.move,
            "final": reply.final, "amount_to_say": fmt(st, reply.amount) if reply.amount is not None else None,
            "lever_to_say": reply.lever_text, "step_up": ({"now": fmt(st, reply.now), "later": fmt(st, reply.later),
                                                           "months": reply.months} if reply.later else None),
            "last_user_line": last_user_line[:400],
            "rules": "1-3 sentences. Say only the amounts given. Never mention a budget, maximum or range. Stay polite."}


# ---------- hints ----------

DEADLINE_KEYS = ("deadline_soft", "deadline_48h")


def pick_hint(st: dict, spoken: list[dict] | None = None) -> str:
    """The tactic card for this moment (§5.4, §9), by code from what the user can see or said."""
    su = st["levers"]["step_up"]
    asked_step = any(a.get("lever") == "step_up" for a in st["asks"])
    last_ask = st["asks"][-1] if st["asks"] else None
    gap_anchor = st["user_anchor"] or st["target"]
    if st["phase"] == "expectations":
        last = st["hints_used"][-1] if st["hints_used"] else None
        asked_range = st["last_move"] == "press_number" or any(t["cls"] == "ask_range" for t in st["turns"])
        again = last and last["card_id"] == "N2" and last.get("turn") == st["user_turns"]
        return "N1" if asked_range or again else "N2"
    if st["offer"] is not None and st["final"] and st["offer"] < gap_anchor and not asked_step:
        return "N9"
    if su["given"] and (not su["criteria_asked"] or not su["in_writing"]):
        return "N10"
    if spoken and re.search(r"currently (earn|make|paid)|current (salary|pay)|what do you (earn|make)", spoken[-1].get("text", ""), re.I):
        return "N3"
    turns = st["turns"]
    if turns and turns[-1]["cls"] == "lever_ask" and not st["final"]:
        return "N4"                                  # they just asked about the package: do not suggest it again
    if st["final"] or (len(turns) >= 2 and turns[-1]["cls"] == "counter" and turns[-2]["cls"] == "counter"):
        return "N6"
    if st["last_pressure"] in DEADLINE_KEYS and st["last_move"] != "ask_expectations":
        return "N8"
    if turns and turns[-1]["cls"] == "counter" and last_ask and last_ask["amount"] and not last_ask["justified"]:
        return "N5"
    if turns and turns[-1]["cls"] == "counter" and last_ask and last_ask["amount"] and last_ask["amount"] % 1000 == 0:
        return "N1"
    if st["has_real_offer"] and not any("competing_offer" in a.get("reason_words", []) for a in st["asks"]):
        return "N7"
    return "N4"


# ---------- debrief ----------

CAUSE_LABEL = {"justified_counter": "A counter with a reason", "bare_counter": "A counter without a reason",
               "competing_offer": "Your competing offer", "step_up": "A step-up after probation",
               "named_below_opening": "You named a number below their opening", "opening": "Mike's opening offer"}
OUTCOME_LABEL = {"accepted": "You accepted the offer", "time": "You asked for time and the terms in writing",
                 "declined": "You declined the offer", "turn_cap": "Mike closed the call with a deadline",
                 "ended": "You ended the practice", None: "You ended the practice"}
SIGNAL_LABEL = {
    "accepted_first_offer": ("Accepted the first offer without asking", False),
    "first_number_below_target": ("First number named was below your target", False),
    "counter_above_offer": ("Countered clearly above the offer", True),
    "precise_number": ("Used a precise number", True),
    "revealed_current": ("Told Mike your current pay", False),
    "apologised": ("Apologised more than once in a turn", False),
    "paused": ("Took a moment to think", True),
    "asked_package": ("Asked about more than base pay", True),
    "asked_time": ("Asked for time or the terms in writing", True),
    "ultimatum": ("Used an ultimatum", None),
    "competing_offer_no_flag": ("Mentioned another offer you did not declare", False),
    "step_up_asked": ("Asked for a step-up after probation", True),
    "criteria_named": ("Named what you would show", True),
    "in_writing_asked": ("Asked for it in writing", True)}
SAY = {
    "accepted_first_offer": ("You said yes to the first offer", "N4"),
    "named_below_opening": ("Your first number was below Mike's opening", "N1"),
    "revealed_current": ("You told Mike your current pay", "N3"),
    "competing_offer_no_flag": ("You mentioned an offer you did not declare in the setup", "N7"),
    "base_final_no_step_up": ("Base was final and a gap was left, but you did not ask for a step-up", "N9"),
    "step_up_not_in_writing": ("A step-up was agreed but not in writing", "N10"),
    "bare_counter": ("You gave a number without a reason", "N5"),
    "apologised": ("You apologised more than once", "N5"),
    "no_package_ask": ("Base was final and you did not ask about the package", "N6")}
LEVER_NAMES = talk.data()["lever_labels"]


def _quote_of(st: dict, key: str) -> str | None:
    sig = st["signals"].get(key)
    return sig["quote"] if sig and sig.get("quote") else None


def _say_candidates(st: dict) -> list[tuple[str, str | None]]:
    out: list[tuple[str, str | None]] = []
    sg = st["signals"]
    if "accepted_first_offer" in sg:
        out.append(("accepted_first_offer", sg["accepted_first_offer"]["quote"]))
    if "named_below_opening" in st["flags"] or "named_below_opening" in [m["cause"] for m in st["moves"]]:
        out.append(("named_below_opening", st["asks"][0]["quote"] if st["asks"] else None))
    if "revealed_current" in sg:
        out.append(("revealed_current", sg["revealed_current"]["quote"]))
    if "competing_offer_no_flag" in sg:
        out.append(("competing_offer_no_flag", sg["competing_offer_no_flag"]["quote"]))
    asked_step = any(a.get("lever") == "step_up" for a in st["asks"])
    gap = (st["user_anchor"] or st["target"])
    if st["final"] and st["offer"] is not None and st["offer"] < gap and not asked_step:
        out.append(("base_final_no_step_up", None))
    su = st["levers"]["step_up"]
    if su["given"] and not su["in_writing"]:
        out.append(("step_up_not_in_writing", next((a["quote"] for a in st["asks"] if a.get("lever") == "step_up"), None)))
    bare = next((a for a in st["asks"] if a.get("amount") and not a.get("lever") and not a["justified"]), None)
    if bare:
        out.append(("bare_counter", bare["quote"]))
    if "apologised" in sg:
        out.append(("apologised", sg["apologised"]["quote"]))
    if st["final"] and "asked_package" not in sg and not su["given"]:
        out.append(("no_package_ask", None))
    return out


def debrief(st: dict) -> dict:
    """The negotiation debrief, computed in code from the saved state (§4.7, §9). Quotes are the user's own words."""
    cur, offer, opening, ceiling, floor = st["currency"], st["offer"], st["opening"], st["ceiling"], st["floor"]
    outcome = st["outcome"] or "ended"
    no_offer = offer is None
    su = st["levers"]["step_up"]
    summary = {"opening": None if no_offer else opening, "final_offer": offer, "floor": floor, "ceiling": ceiling,
               "captured_pct": None, "position_pct": None, "rounds_used": st["round"], "round_cap": st["round_cap"],
               "captured_now_pct": None, "captured_later_pct": None, "year_one": None, "target": st["target"],
               "job_low": st["job_low"], "job_high": st["job_high"],
               "range_source": "job_range" if st["job_high"] else "your_target"}
    deal = None
    if not no_offer:
        if ceiling > opening:
            summary["captured_pct"] = round(100 * clamp((offer - opening) / (ceiling - opening)))
            summary["captured_now_pct"] = summary["captured_pct"]
            summary["position_pct"] = round(100 * clamp((offer - floor) / (ceiling - floor))) if ceiling > floor else None
        if su["given"]:
            n, now, later = su["after_months"], offer, su["later_amount"]
            if ceiling > opening:
                summary["captured_later_pct"] = round(100 * clamp((later - opening) / (ceiling - opening)))
            summary["year_one"] = int(round(now * n / 12 + later * (12 - n) / 12))
            tail = "in the offer letter ✓" if su["in_writing"] else "not in writing ✗"
            deal = {"now": now, "later": later, "after_months": n, "in_writing": su["in_writing"],
                    "criteria_named": su["criteria_asked"],
                    "line": f"Now {talk.money(now)} → {talk.money(later)} after {n} months ({tail})"}
    shifts = []
    for m in st["moves"]:
        if m["offer_before"] is not None and m["offer_after"] != m["offer_before"] and m["cause"] != "opening":
            shifts.append({"turn": m["turn"], "from": m["offer_before"], "to": m["offer_after"], "cause": m["cause"],
                           "cause_label": CAUSE_LABEL.get(m["cause"], "Your ask"), "quote": m["quote"]})
    held = [{"turn": m["turn"], "offer": m["offer_before"], "asked": m.get("asked"), "why": m["cause"], "quote": m["quote"]}
            for m in st["moves"] if m["move"] == "hold"]
    first = st["asks"][0] if st["asks"] else None
    below = None
    if "named_below_opening" in st["flags"] and first and first.get("amount"):
        below = {"turn": first["turn"], "your_number": first["amount"], "opening": opening, "quote": first["quote"]}
    levers_won = []
    for m in st["moves"]:
        if m.get("lever"):
            if m["lever"] == "step_up":
                continue
            levers_won.append({"lever": m["lever"], "label": LEVER_NAMES[m["lever"]], "value": lever_value_text(st, m["lever"]),
                               "by": m.get("by", "ask"), "turn": m["turn"]})
    missed = []
    asked_levers = {a["lever"] for a in st["asks"] if a.get("lever")}
    for lever in LEVER_ORDER[st["style"]] + ("step_up",):
        given = st["levers"][lever].get("given")
        if given or lever in asked_levers:
            continue
        if lever == "step_up" or lever in ("review", "title") and st["levers"][lever]["available"] or lever in (
                "sign_on", "perf_bonus", "pto", "remote") and st["style"] in ("friendly", "firm", "tight"):
            if lever in ("pto", "remote") and st["style"] != "friendly":
                continue
            if lever == "title" and st["style"] != "firm":
                continue
            missed.append({"lever": lever, "label": LEVER_NAMES[lever]})
    signals = [{"id": k, "label": SIGNAL_LABEL[k][0], "good": SIGNAL_LABEL[k][1], "quote": v.get("quote") or None}
               for k, v in st["signals"].items() if k in SIGNAL_LABEL]
    say = []
    cards_seen = []
    if no_offer:
        for cid in ("N2", "N1"):
            cards_seen.append(cid)
    else:
        for key, q in _say_candidates(st)[:3]:
            title, cid = SAY[key]
            c = talk.card(cid)
            entry = {"id": key, "title": title, "what_happened": c["rule"], "you_said": q, "try": card_example(cid, st),
                     "why": c["evidence"], "card_id": cid}
            if key == "named_below_opening" and below:
                entry.update(your_number=below["your_number"], opening=below["opening"])
            say.append(entry)
            cards_seen.append(cid)
    notes = []
    labels = {"deadline_soft": "a soft deadline", "other_candidates": "“other candidates”",
              "deadline_48h": "a 48-hour deadline", "standard_role": "“standard for the role”"}
    for key in st["pressure_used"]:
        notes.append(f"Mike used {labels[key]}; real recruiters may or may not.")
    flags_note = None
    if "competing_offer_no_flag" in st["signals"]:
        flags_note = ("You mentioned another offer, but you did not say you have a real one in the setup, so Mike did not "
                      "count it as a reason. Only mention offers you really have.")
    hints = [{"card_id": h["card_id"], "title": talk.card(h["card_id"])["title"], "turn": h.get("turn")} for h in st["hints_used"]]
    if no_offer:
        verdict = "No offer yet: the practice ended before Mike made one."
    elif summary["captured_pct"] is None:
        verdict = f"The final base offer was {talk.money(offer, cur)}. Mike's opening was already at his top."
    else:
        verdict = (f"You moved the base offer from {talk.money(opening, cur)} to {talk.money(offer, cur)} "
                   f"({summary['captured_pct']}% of the room).")
    if deal:
        verdict += f" {deal['line']}."
    cards = list(dict.fromkeys(cards_seen + [h["card_id"] for h in hints]))
    style = st["style"]
    return {"kind": "negotiate", "verdict": verdict, "practice_note": talk.data()["notes"]["practice"],
            "style": style, "style_name": talk.style_name(style), "surprise": st["surprise"], "role": st["role"],
            "currency": cur, "period": st["period"], "outcome": outcome, "outcome_label": OUTCOME_LABEL.get(outcome, ""),
            "no_offer": no_offer, "summary": summary,
            "hidden_range": {"floor": floor, "ceiling": ceiling,
                             "text": f"Your hidden range was {talk.money(floor)} to {talk.money(ceiling, cur)}."},
            "offer_path": st["offer_path"], "shifts": shifts, "deal": deal, "held": held, "named_below_opening": below, "levers_won": levers_won,
            "missed_levers": missed if not no_offer else [], "say_it_better": say, "signals": signals,
            "pressure_notes": notes, "flags": st["flags"], "guard_replacements": st["guard_replacements"],
            "competing_offer_note": flags_note, "hints_used": hints, "cards": cards, "source": "code"}
