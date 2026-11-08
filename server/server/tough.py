"""Tough questions practice: five uncomfortable questions, scripted in the call; the model only reads the answers after the call.

In the call Mike asks a question, may ask its own follow-up, then at most one pressure line chosen by code. Personal
questions get a neutral move-on and no pressing. The after-call check (p8_tough_check) returns booleans with a verbatim
evidence quote; any boolean whose quote is not a substring of the answer is dropped. Spec: prd.md §3, §5, §6.
"""
from __future__ import annotations

import asyncio
import logging
import random
import re

from . import content, postcall, talk

log = logging.getLogger("uvicorn.error")

TOTAL = 5
LONG_WORDS = 110
SHORT_WORDS = 8
CHECK_KEYS = ("shares_personal_info", "blames_others", "argues_instead", "redirects_to_work", "rambling", "no_example")
PERSONAL_FIRST = re.compile(r"\b(?:i'?m|i am|i was|my (?:husband|wife|partner|kids?|children|baby|pregnan\w*)|pregnan\w*|"
                            r"i plan to have|we plan to|married|single|divorce\w*|religio\w*|my age)\b", re.I)


def pick_questions(theme: str, rng: random.Random | None = None) -> list[str]:
    """Five question ids. A theme picks inside it (all of it when it has at most five); Mix draws across themes
    and never includes a personal one. Order is random but the first is never a personal one."""
    rng = rng or random.Random()
    qs = talk.questions()
    if theme == "mix":
        pool = [q for q in qs if not q["personal"]]
        by_theme: dict[str, list[dict]] = {}
        for q in pool:
            by_theme.setdefault(q["theme"], []).append(q)
        themes = list(by_theme)
        rng.shuffle(themes)
        picked: list[dict] = []
        for t in themes:
            picked.append(rng.choice(by_theme[t]))
        while len(picked) < TOTAL:
            extra = rng.choice([q for q in pool if q not in picked])
            picked.append(extra)
        picked = picked[:TOTAL]
        rng.shuffle(picked)
    else:
        pool = [q for q in qs if q["theme"] == theme]
        picked = rng.sample(pool, min(TOTAL, len(pool)))
        if len(picked) < TOTAL:
            others = [q for q in qs if q["theme"] != theme and not q["personal"] and q not in picked]
            picked += rng.sample(others, TOTAL - len(picked))
        rng.shuffle(picked)
        if theme == "personal":
            pass
    if picked[0]["personal"] and len(picked) > 1:
        for i, q in enumerate(picked):
            if not q["personal"]:
                picked[0], picked[i] = picked[i], picked[0]
                break
    return [q["id"] for q in picked]


def new_state(theme: str, question_ids: list[str]) -> dict:
    """`log` has one entry per question asked so far: {id, answers[{role,text}], pushes[{kind,text,key}], skipped}."""
    return {"theme": theme, "theme_name": talk.theme_name(theme), "ids": list(question_ids), "index": 0,
            "stage": "asked", "log": [{"id": question_ids[0], "answers": [], "pushes": [], "skipped": False}],
            "checks": {}, "hints_used": [], "closed": False, "repeats": 0, "pressure_used": []}


def current(st: dict) -> dict | None:
    return talk.question(st["ids"][st["index"]]) if st["index"] < len(st["ids"]) else None


# ---------- code signals ----------

def code_signals(text: str, q: dict) -> dict:
    d = talk.data()["tough_signals"]
    words = text.split()
    low = text.lower()
    out = {"words": len(words), "long": len(words) > LONG_WORDS, "short": len(words) < SHORT_WORDS,
           "apology": sum(len(re.findall(p, low)) for p in d["apology"]),
           "has_result": any(w in low for w in d["result_words"]) or bool(re.search(r"\d", low))}
    out["over_apology"] = out["apology"] >= 2
    out["no_example"] = (q["theme"] in ("leaving", "weakness", "fit") and not out["has_result"] and len(words) >= SHORT_WORDS
                         and not q["personal"])
    out["rambling"] = out["long"]
    return out


def classify_repeat(text: str) -> bool:
    return bool(re.search(r"\b(?:repeat|say that again|say it again|can you ask again|didn'?t (?:catch|hear)|come again|pardon)\b", text, re.I))


def wants_skip(text: str) -> bool:
    return bool(re.search(r"\b(?:skip|next question|pass on this|i'?d rather not answer|prefer not to answer|move on)\b", text, re.I))


# ---------- the call ----------

def opening_line(st: dict, name: str = "") -> str:
    q = current(st)
    return talk.data()["tough_lines"]["opening"].format(hi=f"Hi {name}," if name else "Hi,", count=TOTAL, question=q["text"])


def _pressure_key(st: dict, sig: dict, q: dict, text: str) -> str | None:
    lines = talk.data()["tough_lines"]["pressure"]
    if sig["over_apology"]:
        return "apology"
    if sig["long"]:
        return "long"
    if sig["no_example"] and q["theme"] in ("leaving", "weakness", "fit"):
        return "no_result"
    if sig["short"]:
        return "short"
    return None


def _entry(st: dict) -> dict:
    return st["log"][st["index"]]


def step(st: dict, text: str) -> dict:
    """One user turn. Returns {kind, line, advance} and updates the state. kind: question|follow_up|pressure|move_on|closing|repeat.
    The line is complete spoken text (no model)."""
    L = talk.data()["tough_lines"]
    q = current(st)
    if st["closed"] or q is None:
        return {"kind": "closing", "line": L["closing"], "advance": False}
    text = " ".join((text or "").split())
    if classify_repeat(text) and len(text.split()) <= 10 and st["repeats"] < 2:
        st["repeats"] += 1
        return {"kind": "repeat", "line": L["repeat"].format(question=q["text"]), "advance": False}
    entry = _entry(st)
    role = {"asked": "answer", "followed": "follow_up_answer", "pressed": "pressure_answer"}[st["stage"]]
    if q["personal"]:
        entry["answers"].append({"role": role, "text": text})
        return _next(st, "move_on")
    if wants_skip(text) and len(text.split()) <= 8:
        entry["skipped"] = True
        return _next(st, "move_on")
    entry["answers"].append({"role": role, "text": text})
    sig = code_signals(" ".join(a["text"] for a in entry["answers"]), q)
    if q["follow_up"] and st["stage"] == "asked":
        st["stage"] = "followed"
        entry["pushes"].append({"kind": "follow_up", "text": q["follow_up"], "key": None})
        return {"kind": "follow_up", "line": q["follow_up"], "advance": False}
    if st["stage"] != "pressed":
        key = _pressure_key(st, sig, q, text)
        if key and key not in st["pressure_used"]:
            st["stage"] = "pressed"
            st["pressure_used"].append(key)
            entry["pushes"].append({"kind": "pressure", "text": L["pressure"][key], "key": key})
            return {"kind": "pressure", "line": L["pressure"][key], "advance": False, "pressure": key}
    return _next(st, "next")


def _next(st: dict, lead: str) -> dict:
    L = talk.data()["tough_lines"]
    st["stage"], st["repeats"] = "asked", 0
    st["index"] += 1
    nxt = current(st)
    if nxt is None:
        st["closed"] = True
        return {"kind": "closing", "line": L["move_on"] + " " + L["closing"] if lead == "move_on" else L["closing"],
                "advance": True}
    st["log"].append({"id": nxt["id"], "answers": [], "pushes": [], "skipped": False})
    kind = "move_on" if lead == "move_on" else "question"
    return {"kind": kind, "line": f"{L['move_on'] if lead == 'move_on' else L['next']} {nxt['text']}", "advance": True}


def _hint_turn(st: dict) -> int:
    """How many answers and pushes the log holds: a hint belongs to the moment between two of them."""
    return sum(len(e["answers"]) + len(e["pushes"]) for e in st["log"])


# Per-question cards built from the question itself (not in the card list): how to build this answer, what they check.
SHAPE_CARD, CHECK_CARD = "TS", "TC"
VIRTUAL_TITLES = {SHAPE_CARD: "How to build this answer", CHECK_CARD: "What they are really checking"}
PAUSE_RE = re.compile(r"\b(?:let me think|give me a (?:second|moment|minute)|one (?:second|moment)|good question)\b", re.I)


def hint_title(cid: str) -> str:
    return VIRTUAL_TITLES.get(cid) or talk.card(cid)["title"]


def _last_answer(st: dict) -> str:
    for e in reversed(st["log"]):
        texts = [a["text"] for a in e["answers"] if a.get("text")]
        if texts:
            return texts[-1]
    return ""


def hint_ranking(st: dict) -> tuple[list[str], dict]:
    """Cards for the moment, best first. Personal question -> T1; after a push -> T2 ("fair point, shorter"); then this
    question's own two cards (how to build the answer, what they check); a pause only if the user has not just paused.
    Owner 08.11: with one shared card for 20 questions "Another hint" kept showing the same card."""
    q = current(st) or talk.question(st["ids"][-1])
    ranked = []
    if q["personal"]:
        ranked.append("T1")
    elif st["stage"] == "pressed":
        ranked.append("T2")
    ranked += [SHAPE_CARD, CHECK_CARD]
    if not PAUSE_RE.search(_last_answer(st)):
        ranked.append("N4")
    return list(dict.fromkeys(ranked)), q


def pick_hint(st: dict, another: bool = False) -> dict:
    """The next card for this moment: every press (the H key or "Another hint") moves on to a card not shown yet here,
    then cycles. `another` is kept for the protocol; a press after a card was shown now means "show me something else"."""
    ranked, q = hint_ranking(st)
    turn = _hint_turn(st)
    on_q = [h for h in st["hints_used"] if h.get("question_id") == q["id"]]
    shown = [h["card_id"] for h in on_q if h.get("turn") == turn]
    seen_before = {h["card_id"] for h in on_q}
    fresh = [c for c in ranked if c not in shown]
    # A new moment of the same question (Mike followed up) leads with a card not seen on this question yet.
    fresh = [c for c in fresh if c not in seen_before] + [c for c in fresh if c in seen_before]
    if fresh:
        card = fresh[0]
    else:
        last = shown[-1] if shown else ranked[-1]
        card = ranked[(ranked.index(last) + 1) % len(ranked)] if last in ranked else ranked[0]
    return {"card_id": card, "shape": q["shape"], "question_id": q["id"], "turn": turn}


def hint_payload(st: dict, h: dict, n: int) -> dict:
    """What the hint card shows. The question's own cards carry its shape or what it checks, with an example to fill in."""
    q = talk.question(h["question_id"])
    cid = h["card_id"]
    if cid == SHAPE_CARD:
        return {"mode": "tough", "card_id": cid, "title": VIRTUAL_TITLES[cid], "text": q["shape"], "shape": q["shape"],
                "example": q.get("hint_example") or "", "n": n}
    if cid == CHECK_CARD:
        rule = f"{q['checking']} Avoid: {q['trap'][0].lower()}{q['trap'][1:]}"
        return {"mode": "tough", "card_id": cid, "title": VIRTUAL_TITLES[cid], "text": rule, "shape": rule, "example": "", "n": n}
    return talk.hint_payload(cid, "tough", n)


# ---------- after the call ----------

def check_input(question: dict, answer: str) -> dict:
    return {"question": question["text"], "checking": question["checking"], "trap": question["trap"], "answer": answer[:2500]}


def merge_check(answer: str, model: dict | None) -> dict:
    """Keep a model flag only when its evidence quote is a verbatim piece of the answer (case and spacing aside).
    Returns {"signals": {key: {"quote"}}, "calmer_answer": str|None, "model_ok": bool}."""
    out = {"signals": {}, "calmer_answer": None, "model_ok": bool(model)}
    if not model:
        return out
    norm = " ".join(answer.lower().split())
    for key in CHECK_KEYS:
        item = model.get(key)
        if not isinstance(item, dict) or not item.get("value"):
            continue
        quote_ = " ".join(str(item.get("evidence_quote") or "").lower().split())
        if len(quote_) >= 4 and quote_ in norm:
            out["signals"][key] = {"quote": " ".join(str(item["evidence_quote"]).split())}
    calmer = " ".join(str(model.get("calmer_answer") or "").split())
    out["calmer_answer"] = calmer[:600] or None
    return out


def answer_text(entry: dict) -> str:
    return " ".join(a["text"] for a in entry["answers"] if a["text"]).strip()


def debrief(st: dict) -> dict:
    """Per-question rows from the log and `st["checks"]` (model pass, may be empty). Code signals always apply."""
    d = talk.data()
    labels = d["tough_signals"]["labels"]
    priority = d["tough_signals"]["bad_priority"]
    rows = []
    for n, entry in enumerate(st["log"], 1):
        if not entry["answers"] and not entry["skipped"]:
            continue
        q = talk.question(entry["id"])
        text = answer_text(entry)
        sig = code_signals(text, q)
        chk = st["checks"].get(q["id"]) or {"signals": {}, "calmer_answer": None, "model_ok": False}
        found: dict[str, dict] = {}
        for key, item in chk["signals"].items():
            found[key] = {"quote": item["quote"], "source": "model"}
        if not q["personal"]:
            for key in ("rambling", "over_apology", "no_example"):
                if sig[key] and key not in found:
                    found[key] = {"quote": None, "source": "code"}
        else:
            found = {k: v for k, v in found.items() if k in ("shares_personal_info", "argues_instead", "redirects_to_work")}
        sigs = [{"id": k, "label": labels[k], "bad": k != "redirects_to_work", "source": found[k]["source"],
                 "may_be_wrong": found[k]["source"] == "model", "quote": found[k]["quote"]}
                for k in [*priority, "redirects_to_work"] if k in found]
        card = talk.card(q["card"])
        rows.append({"n": n, "question_id": q["id"], "theme": q["theme"], "question": q["text"], "personal": q["personal"],
                     "answers": entry["answers"], "pushes": [{"kind": p["kind"], "text": p["text"]} for p in entry["pushes"]],
                     "signals": sigs, "calm": not any(s["bad"] for s in sigs), "calmer_answer": chk.get("calmer_answer"),
                     "shape": q["shape"], "checking": q["checking"], "trap": q["trap"],
                     "card_ids": list(dict.fromkeys([q["card"], *(["T1"] if q["personal"] else [])])),
                     "lawful_note": d["notes"]["personal"] if q["personal"] else None,
                     "model_checked": bool(chk["model_ok"]), "try": card["example"], "why": card["evidence"]})
    calm = sum(1 for r in rows if r["calm"])
    hurt = None
    for r in rows:
        bad = [s for s in r["signals"] if s["bad"]]
        if bad:
            rank = priority.index(bad[0]["id"])
            if hurt is None or rank < hurt[0]:
                hurt = (rank, r, bad[0])
    show_counts = len(rows) >= 3
    if hurt:
        _rank, r, s = hurt
        hurt_most = {"question_no": r["n"], "question": r["question"], "signal": s["id"], "label": s["label"], "quote": s["quote"]}
        tail = f"The answer that hurt most: question {r['n']}."
        verdict = (f"Handled calmly {calm} of {len(rows)}. " if show_counts else "") + tail
    else:
        hurt_most = None
        verdict = f"Handled calmly {calm} of {len(rows)}. No clear stumbles." if show_counts else "No clear stumbles in your answers."
    any_model = any(r["model_checked"] for r in rows)
    hints = [{"card_id": h["card_id"], "title": hint_title(h["card_id"]), "turn": h.get("question_id")} for h in st["hints_used"]]
    return {"kind": "tough", "verdict": verdict, "practice_note": d["notes"]["tough_practice"], "theme": st["theme"],
            "theme_name": st["theme_name"], "summary": {"answered": len(rows), "calm": calm, "show_counts": show_counts,
                                                         "hurt_most": hurt_most},
            "questions": rows, "hints_used": hints,
            "cards": list(dict.fromkeys([c for r in rows for c in r["card_ids"]]
                                        + [h["card_id"] for h in hints if h["card_id"] not in VIRTUAL_TITLES])),
            "source": "code+model" if any_model else "code"}


def check_total(st: dict) -> int:
    return sum(1 for e in st["log"] if answer_text(e) and not e["skipped"])


async def run_checks(st: dict, llm, ctx, save) -> bool:
    """The after-call model pass: one call per answered question, answers joined. A failed call leaves the code
    signals only. `save(done)` writes progress and returns False when the record is no longer ours."""
    rows = [e for e in st["log"] if answer_text(e) and not e["skipped"]]
    ctx.emit("feedback_progress", done=0, total=len(rows))
    for done, entry in enumerate(rows, 1):
        q, text = talk.question(entry["id"]), answer_text(entry)
        data = None
        if llm is not None and len(text.split()) >= 3:
            await postcall.machine_free()
            messages = [{"role": "system", "content": content.system("p8_tough_check")},
                        {"role": "user", "content": content.user("p8_tough_check", **check_input(q, text))}]
            try:
                data = await asyncio.wait_for(ctx.run(lambda: llm.complete_json(
                    messages, content.schema("p8_tough_check"), temperature=0.1, max_tokens=500)), timeout=90)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.warning("Tough check failed: %s", type(exc).__name__)
        st["checks"][q["id"]] = merge_check(text, data)
        if not await save(done):
            return False
        ctx.emit("feedback_progress", done=done, total=len(rows))
    return True
