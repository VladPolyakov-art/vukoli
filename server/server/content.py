"""Prompt templates, JSON schemas, copy and the general question bank, read from app/server/content/."""
from __future__ import annotations

import functools
import json
import re
from dataclasses import dataclass, field

from .config import content_dir

VAR = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")


@functools.lru_cache(maxsize=None)
def _read(name: str) -> str:
    return (content_dir() / "prompts" / name).read_text(encoding="utf-8")


def render(template: str, **values) -> str:
    """Fill {{var}} placeholders. Unknown placeholders become empty strings."""
    return VAR.sub(lambda m: str(values.get(m.group(1), "")), template)


def system(prompt_id: str, **values) -> str:
    return render(_read(f"{prompt_id}.system.md"), **values).strip()


def user(prompt_id: str, **values) -> str:
    return render(_read(f"{prompt_id}.user.md"), **values).strip()


@functools.lru_cache(maxsize=None)
def schema(prompt_id: str) -> dict:
    return json.loads(_read(f"{prompt_id}.schema.json"))


@functools.lru_cache(maxsize=None)
def copy_text() -> dict:
    return json.loads(_read("copy.json"))


def copy(key: str, name: str = "", **values) -> str:
    """Fixed copy. `{hi}` is the greeting: "Hi Alex," with the user's name (D80), else "Hi,"."""
    return copy_text()[key].format(hi=f"Hi {name}," if name else "Hi,", **values)


def name_line(name: str) -> str:
    """D80: appended to Mike's system prompts when the user gave their name in Settings → General."""
    if not name:
        return ""
    return (f"\n\nThe user's name is {name}. Address them by name now and then, the way a person would "
            "(in the greeting and once in a while, not in every turn).")


@functools.lru_cache(maxsize=None)
def level_presets() -> dict:
    return json.loads(_read("p5a_levels.json"))


# ---------- Question bank ----------

@dataclass
class Question:
    id: str
    competency: str
    text: str
    follow_ups: dict[str, str] = field(default_factory=dict)   # tag -> text
    source: str = "bank"                                       # bank | cv_jd
    anchor: str = ""

    def public(self) -> dict:
        return {"id": self.id, "competency": self.competency, "text": self.text,
                "follow_ups": [{"tag": t, "text": x} for t, x in self.follow_ups.items()],
                "source": self.source, "anchor": self.anchor}


QUESTION_LINE = re.compile(r"^\*\*([A-H][1-9])\*\*\s+(.+)$")
FOLLOW_LINE = re.compile(r"^-\s+(YP|RN|WD|CT):\s+(.+)$")


class BankError(ValueError):
    pass


@functools.lru_cache(maxsize=None)
def question_bank() -> tuple[Question, ...]:
    path = content_dir() / "question_bank.md"
    questions: list[Question] = []
    current: Question | None = None
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if line.startswith("#") or line == "---":
            current = None
            continue
        match = QUESTION_LINE.match(line)
        if match:
            current = Question(id=match.group(1), competency=match.group(1)[0], text=match.group(2).strip())
            questions.append(current)
            continue
        match = FOLLOW_LINE.match(line)
        if match and current is not None:
            current.follow_ups[match.group(1)] = match.group(2).strip()
    for q in questions:
        if len(q.follow_ups) < 2:
            raise BankError(f"{path.name}: question {q.id} has fewer than 2 follow-ups")
    if not questions:
        raise BankError(f"{path.name}: no questions found")
    return tuple(questions)


ROUND_TYPES = {
    # round type -> ordered competency plan (F15); the planner draws one question per slot.
    "hr": ["A", "A", "B", "B", "H", "C", "A"],
    "behavioural": ["B", "C", "D", "E", "F", "G", "B"],
    "mix": ["A", "B", "C", "D", "E", "F", "G", "H"],
}
