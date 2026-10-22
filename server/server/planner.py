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


def plan_questions(round_type: str = "mix", count: int = 5, *, extra: list[Question] | None = None,
                   seed: int | None = None) -> list[Question]:
    """Pick `count` questions. Generated questions (from CV + job posting) come first, then the bank
    fills the round type's competency slots without repeats."""
    rng = random.Random(seed)
    count = max(1, min(10, int(count)))
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
