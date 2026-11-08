"""D117: a hint's "Try saying" line written by the model from what the person said, checked by code.

The card itself (title, rule) still comes from the content file and is sent at once; this line replaces the card's
fixed example a second later. The model may only reuse the person's facts: every number in its line must already be in
the conversation or in the practice numbers, else it becomes a [number] placeholder. Owner 08.11: fixed examples were
read out word for word ("I led the launch that the team now builds on") although they were not his facts."""
from __future__ import annotations

import difflib
import re

NUM = re.compile(r"(?<![\w\[])(\$|€|£)?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)(?:\s?(k\b|%|percent\b))?", re.I)
MAX_WORDS = 45


def _norm(token: str, suffix: str) -> str:
    raw = token.replace(" ", "")
    if re.fullmatch(r"\d{1,3}(?:[,.]\d{3})+", raw):
        raw = re.sub(r"[,.]", "", raw)
    try:
        value = float(raw)
    except ValueError:
        return raw
    s = (suffix or "").lower()
    if s == "k":
        value *= 1000
    text = f"{value:g}" if value != int(value) else str(int(value))
    return text + ("%" if s in ("%", "percent") else "")


def numbers_in(text: str) -> set[str]:
    return {_norm(m.group(2), m.group(3)) for m in NUM.finditer(text or "")}


def allowed_numbers(texts: list[str], values: list[int | float | None]) -> set[str]:
    out: set[str] = set()
    for t in texts:
        out |= numbers_in(t)
    for v in values:
        if v is not None:
            out.add(str(int(v)) if float(v) == int(v) else f"{v:g}")
    return out


def clean(line: str, allowed: set[str], said: list[str]) -> str | None:
    """The model's line made safe: invented numbers become [number]; None when it is empty, too long, or a line the
    person already said (a hint that repeats them is no hint)."""
    line = " ".join((line or "").split()).strip().strip('"“”')
    if not line or len(line.split()) > MAX_WORDS:
        return None

    def fix(m: re.Match) -> str:
        return m.group(0) if _norm(m.group(2), m.group(3)) in allowed else "[number]"
    line = NUM.sub(fix, line)
    low = line.lower()
    for s in said[-3:]:
        if difflib.SequenceMatcher(None, low, (s or "").lower()).ratio() >= 0.85:
            return None
    return line
