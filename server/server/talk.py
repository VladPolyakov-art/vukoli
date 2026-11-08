"""Shared bits of the two "tough talk" practice modes (tough questions, salary negotiation): the content file,
cards, themes and a few formatting helpers. Content lives in content/tough_talk.json (English only)."""
from __future__ import annotations

import functools
import json
import re

from .config import content_dir

TALK_MODES = ("tough", "negotiate")
STYLE_IDS = ("friendly", "firm", "tight")
THEME_IDS = ("money", "leaving", "weakness", "fit", "english", "personal", "mix")
MAX_ROLE = 80
MAX_MONEY = 1_000_000_000
CURRENCY = re.compile(r"[A-Z]{3}")


@functools.lru_cache(maxsize=None)
def data() -> dict:
    return json.loads((content_dir() / "tough_talk.json").read_text(encoding="utf-8"))


def cards() -> list[dict]:
    return data()["cards"]


def card(card_id: str) -> dict:
    return next(c for c in cards() if c["id"] == card_id)


def themes() -> list[dict]:
    return data()["themes"]


def theme_name(theme_id: str) -> str:
    return next((t["name"] for t in themes() if t["id"] == theme_id), theme_id)


def style_name(style_id: str) -> str:
    return next((s["name"] for s in data()["styles"] if s["id"] == style_id), style_id)


def questions() -> list[dict]:
    return data()["questions"]


def question(question_id: str) -> dict:
    return next(q for q in questions() if q["id"] == question_id)


def money(value: int | float | None, currency: str = "") -> str:
    if value is None:
        return ""
    text = f"{int(round(value)):,}"
    return f"{text} {currency}".strip()


def quote(text: str, limit: int = 160) -> str:
    """A verbatim piece of what the user said: the start of it, cut at a word end. Always a substring of the text."""
    text = " ".join(str(text or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if " " in cut:
        cut = cut[:cut.rfind(" ")]
    return cut.rstrip(" ,;:-")


def hint_payload(card_id: str, mode: str, n: int, shape: str | None = None, example: str | None = None) -> dict:
    c = card(card_id)
    out = {"mode": mode, "card_id": c["id"], "title": c["title"], "text": c["rule"], "example": example or c["example"], "n": n}
    if shape:
        out["shape"] = shape
    return out


def public_content() -> dict:
    d = data()
    counts = {}
    for q in d["questions"]:
        counts[q["theme"]] = counts.get(q["theme"], 0) + 1
    themes_out = [{"id": t["id"], "name": t["name"], "count": counts.get(t["id"], 5 if t["id"] == "mix" else 0),
                   "personal": t["id"] == "personal"} for t in d["themes"]]
    return {"cards": d["cards"], "themes": themes_out, "styles": d["styles"], "currencies": d["currencies"],
            "notes": d["notes"], "tough_total": 5}


_SIGN = {"$": "USD", "\u20ac": "EUR", "\u00a3": "GBP"}
_CODES = ("USD", "EUR", "GBP", "CAD", "AUD", "CHF", "PLN")
_AMT = r"(?:[$\u20ac\u00a3]\s?)?\d{1,3}(?:[,. ]\d{3})+(?:\.\d+)?\s?(?:k|K)?|(?:[$\u20ac\u00a3]\s?)?\d{2,3}\s?(?:k|K)\b|(?:[$\u20ac\u00a3]\s?)?\d{4,7}|\d{2,3}(?=\s*(?:-|\u2013|\u2014|to|and)\s*[$\u20ac\u00a3]?\d{2,3}\s?[kK]\b)"
_RANGE = re.compile(rf"({_AMT})\s*(?:-|\u2013|\u2014|to|and)\s*({_AMT})", re.I)


def _amount(text: str, other_k: bool = False) -> int | None:
    digits = re.sub(r"[^\d.,kK]", "", text)
    k = digits[-1:] in ("k", "K")
    digits = digits.rstrip("kK")
    if re.fullmatch(r"\d{1,3}(?:[,.]\d{3})+", digits):
        value = float(re.sub(r"[,.]", "", digits))
    else:
        try:
            value = float(digits.replace(",", ""))
        except ValueError:
            return None
    if k or (other_k and value < 1000):
        value *= 1000
    return int(round(value))


def salary_range(text: str) -> tuple[int | None, int | None, str | None]:
    """The first "low - high" pay range in a job text: (low, high, currency) or (None, None, None).
    Sign or code next to it gives the currency; `95-110k` reads both as thousands; below 5,000 is not an annual pay."""
    for m in _RANGE.finditer(text or ""):
        a, b = m.group(1), m.group(2)
        low = _amount(a, other_k=b.strip()[-1:] in ("k", "K"))
        high = _amount(b)
        if low is None or high is None or low > high or low < 5000 or high < 5000:
            continue
        around = (text[max(0, m.start() - 6):m.start()] + m.group(0) + text[m.end():m.end() + 6])
        currency = next((v for k, v in _SIGN.items() if k in around), None) or next(
            (c for c in _CODES if c in around.upper()), None)
        return low, high, currency
    return None, None, None


def start_title(mode: str, *, role: str = "", style: str = "", theme: str = "") -> str:
    if mode == "negotiate":
        return f"Negotiation \u00b7 {role.strip() or 'Salary'} \u00b7 {style_name(style)}"
    return f"Tough questions \u00b7 {theme_name(theme or 'mix')}"


def debrief_for(session: dict) -> dict:
    """The saved debrief of a tough / negotiate session, computed in code from the saved state (no model)."""
    from . import negotiation, tough
    if session.get("mode") == "negotiate":
        return negotiation.debrief(session["negotiation"])
    return tough.debrief(session["tough"])


def talk_result(session: dict) -> dict | None:
    """The History row's structured result for a tough / negotiate session (from the saved debrief); None for other modes."""
    mode, d = session.get("mode"), session.get("debrief") or {}
    if mode not in TALK_MODES:
        return None
    if mode == "tough":
        sm = d.get("summary") or {}
        return {"kind": "tough", "calm": sm.get("calm"), "total": sm.get("answered")}
    sm = d.get("summary") or {}
    deal = d.get("deal")
    final, opening = sm.get("final_offer"), sm.get("opening")
    return {"kind": "negotiate", "outcome": d.get("outcome"), "currency": d.get("currency"), "opening": opening,
            "final_offer": final, "gain_now": final - opening if final is not None and opening is not None else None,
            "captured_now_pct": sm.get("captured_now_pct"),
            "step_up": {"later": deal["later"], "after_months": deal["after_months"], "in_writing": deal["in_writing"]} if deal else None,
            "no_offer": bool(d.get("no_offer", d.get("debrief") is None and not final))}
