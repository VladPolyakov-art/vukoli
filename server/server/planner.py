"""Question plans: general bank (F15) plus questions generated from the user's CV and a job posting (P0)."""
from __future__ import annotations

import random
import re

from . import content
from .content import ROUND_TYPES, Question
from .documents import known_terms
from .engines.base import EngineError, LLMEngine

FOLLOW_UP_LIMIT = {1: 1, 2: 2, 3: 2}     # strictness -> follow-ups per main question
SENSITIVE = re.compile(r"\b(age|old are you|married|children|kids|pregnan|nationality|religio|health|disab)\w*", re.I)


def max_follow_ups(strictness: int) -> int:
    return FOLLOW_UP_LIMIT.get(int(strictness or 2), 2)


# ---------- Drill focus (C1b) ----------
# A drill from a debrief works on that debrief's weak spots: [{"layer": "content", "tag": "we_not_i"}, ...].
# The bank has no per-question tags beyond its competency (A-H) and the follow-up tags every question carries
# (YP / RN / WD / CT), so only the CONTENT tags can steer the questions, and only through those two signs:
#   follow  - the follow-up the question must have ready, so the interviewer can ask for exactly this gap;
#   gap     - the interviewer's gap name (p1_interviewer.system.md) the follow-up answers;
#   comps   - competencies whose stories show this gap best, strongest first ("we" lives in teamwork stories,
#             a missing lesson in failure and feedback stories, ...).
# Language and delivery tags (tense, filler_high, ...) do not depend on the question: they are saved with the
# session but do not change the plan or the interviewer (the debrief still counts them as before).
FOCUS_LAYERS = ("content", "language", "delivery")
FOCUS_TAG = re.compile(r"[a-z][a-z0-9_]{0,31}")
MAX_FOCUS = 6
FOCUS_PROFILE: dict[str, dict] = {
    "we_not_i":       {"follow": "YP", "gap": "own_part",   "comps": "BGECF"},
    "no_star_action": {"follow": "YP", "gap": "own_part",   "comps": "BEFGD"},
    "no_result":      {"follow": "RN", "gap": "result",     "comps": "BEGCD"},
    "vague_result":   {"follow": "RN", "gap": "result",     "comps": "BEGCD"},
    "too_vague":      {"follow": "RN", "gap": "result",     "comps": "BEDCF"},
    "no_reflection":  {"follow": "WD", "gap": "reflection", "comps": "FDBGC"},
}
GAP_TEXT = {
    "own_part": 'the answer says "we" or "the team" and not what the candidate did themselves',
    "result": "the answer has no result, or a vague one",
    "reflection": "the answer has nothing learned and no change in behaviour",
}


def parse_focus(raw) -> list[dict]:
    """The drill focus of a `start` message, checked: a list of up to MAX_FOCUS {"layer", "tag"}, no repeats.
    ValueError on anything else (the socket answers bad_start)."""
    if raw in (None, []):
        return []
    if not isinstance(raw, list):
        raise ValueError("focus")
    out: list[dict] = []
    for item in raw:
        if not isinstance(item, dict) or item.get("layer") not in FOCUS_LAYERS:
            raise ValueError("focus")
        tag = item.get("tag")
        if not isinstance(tag, str) or not FOCUS_TAG.fullmatch(tag):
            raise ValueError("focus")
        spot = {"layer": item["layer"], "tag": tag}
        if spot not in out:
            out.append(spot)
    return out[:MAX_FOCUS]


def _steering(focus: list[dict] | None) -> list[dict]:
    """The profiles of the focus tags that can steer questions, in the focus's order, one per tag."""
    seen, out = set(), []
    for spot in focus or []:
        profile = FOCUS_PROFILE.get(spot.get("tag", "")) if spot.get("layer") == "content" else None
        if profile and spot["tag"] not in seen:
            seen.add(spot["tag"])
            out.append(profile)
    return out


def focus_gaps(focus: list[dict] | None) -> list[str]:
    """The interviewer's gap names for the focus (own_part, result, reflection), in order, no repeats."""
    return list(dict.fromkeys(p["gap"] for p in _steering(focus)))


def focus_line(focus: list[dict] | None) -> str:
    """One line for the live interviewer's prompt: what to listen for in this drill. Empty when nothing applies."""
    gaps = focus_gaps(focus)
    if not gaps:
        return ""
    listen = "; ".join(f"{g}: {GAP_TEXT[g]}" for g in gaps)
    return ("\n\nThis practice round works on the candidate's weak spots. Check these gaps first, before any other, "
            "and ask the follow-up for one when the answer shows it: " + listen +
            ". Do not mention the focus or say it is a drill.")


def _fit(q: Question, profile: dict, picked: list[Question]) -> float:
    """How well a question serves a focus tag: a follow-up for the gap, a competency where it shows, variety."""
    comps = profile["comps"]
    score = (len(comps) - comps.index(q.competency)) if q.competency in comps else 0
    if profile["follow"] in q.follow_ups:
        score += 3
    if q.source == "cv_jd":
        score += 1                                  # the user's own CV and job posting, when it fits
    return score - 3 * sum(1 for p in picked if p.competency == q.competency)


def _plan_for_focus(profiles: list[dict], count: int, extra: list[Question], rng: random.Random) -> list[Question]:
    bank = list(content.question_bank())
    rng.shuffle(bank)                               # equal scores are drawn at random
    pool = list(extra) + bank
    plan: list[Question] = []
    while len(plan) < count:
        profile = profiles[len(plan) % len(profiles)]
        left = [q for q in pool if all(q.text != p.text for p in plan)]
        if not left:
            break
        plan.append(max(left, key=lambda q: _fit(q, profile, plan)))   # max keeps the first of equal scores
    return plan


def plan_questions(round_type: str = "mix", count: int = 5, *, extra: list[Question] | None = None,
                   seed: int | None = None, focus: list[dict] | None = None) -> list[Question]:
    """Pick `count` questions. Generated questions (from CV + job posting) come first, then the bank
    fills the round type's competency slots without repeats. A drill focus with content tags (see FOCUS_PROFILE)
    picks instead the questions where those weak spots show, one tag after another; generated questions join
    that choice when they fit."""
    rng = random.Random(seed)
    count = max(1, min(10, int(count)))
    profiles = _steering(focus)
    if profiles:
        return _plan_for_focus(profiles, count, list(extra or []), rng)
    plan: list[Question] = list((extra or [])[: max(0, count - 1) if count > 1 else 1])
    if len(plan) >= count:
        return plan[:count]
    slots = ROUND_TYPES.get(round_type, ROUND_TYPES["mix"])
    bank = list(content.question_bank())
    used = {q.text for q in plan}
    by_comp: dict[str, list[Question]] = {}
    for q in bank:
        by_comp.setdefault(q.competency, []).append(q)
    for items in by_comp.values():
        rng.shuffle(items)
    # Always open with a motivation question for HR and mixed rounds when nothing was generated.
    order = list(slots)
    i = 0
    while len(plan) < count and i < len(order) * 3:
        comp = order[i % len(order)]
        i += 1
        pool = [q for q in by_comp.get(comp, []) if q.text not in used]
        if not pool:
            continue
        q = pool[0]
        plan.append(q)
        used.add(q.text)
    if len(plan) < count:   # very small round types: fill from any competency
        for q in bank:
            if len(plan) >= count:
                break
            if q.text not in used:
                plan.append(q)
                used.add(q.text)
    return plan


def questions_from_record(items: list[dict]) -> list[Question]:
    out = []
    for item in items or []:
        follow = {f["tag"]: f["text"] for f in item.get("follow_ups", []) if f.get("tag") and f.get("text")}
        if item.get("text") and len(follow) >= 2:
            out.append(Question(id=item.get("id") or "V", competency=item.get("competency") or "B",
                                text=item["text"], follow_ups=follow, source="cv_jd", anchor=item.get("anchor", "")))
    return out


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


async def generate_questions(llm: LLMEngine, cv_text: str, jd_text: str, count: int = 6) -> list[Question]:
    """P0: questions anchored in the user's own CV and the job posting. Every anchor must be an exact quote."""
    if not (cv_text.strip() or jd_text.strip()):
        raise EngineError("no_input", "Add your CV or a job posting first.")
    count = max(3, min(8, count))
    terms = known_terms(cv_text, jd_text)
    messages = [{"role": "system", "content": content.system("p0_questions", count=count)},
                {"role": "user", "content": content.user("p0_questions", cv_text=cv_text[:12000],
                                                         jd_text=jd_text[:8000], known_terms=", ".join(terms) or "none",
                                                         count=count)}]
    data = await llm.complete_json(messages, content.schema("p0_questions"), temperature=0.3, max_tokens=1600)
    source = _norm(cv_text + "\n" + jd_text)
    out: list[Question] = []
    for n, item in enumerate(data.get("questions") or [], 1):
        if not isinstance(item, dict):
            continue
        text = re.sub(r"\s+", " ", str(item.get("question", ""))).strip()
        anchor = re.sub(r"\s+", " ", str(item.get("anchor", ""))).strip()
        if not text or not anchor or _norm(anchor) not in source:
            continue                                    # anchor must be a real quote
        if SENSITIVE.search(text) or len(text.split()) > 35:
            continue
        follow = {}
        for f in item.get("follow_ups") or []:
            if isinstance(f, dict) and f.get("tag") in ("YP", "RN", "WD", "CT") and f.get("text"):
                follow.setdefault(f["tag"], re.sub(r"\s+", " ", str(f["text"])).strip())
        if len(follow) < 2:
            continue
        comp = item.get("competency") if item.get("competency") in "ABCDEFGH" else "B"
        out.append(Question(id=f"V{n}", competency=comp, text=text, follow_ups=follow, source="cv_jd", anchor=anchor))
    if not out:
        raise EngineError("no_questions", "Could not build questions from this text. Try the general questions.")
    return out[:count]
