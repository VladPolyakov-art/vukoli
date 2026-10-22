"""Test-only scripted engine for the end-to-end suite (app/web/e2e). Never used outside it.

Real models are slow and not repeatable, so a browser test cannot assert on them. With `IC_E2E=1` this engine takes
the place of the Ollama slot (`make_llm("ollama")`): the same engine id, name and copy in the setup wizard, Settings
and the session, but every answer is canned and derived from the input, so the same answer always gets the same reply:

- interviewer (P1): asks the next bank follow-up (result first) until the answer contains a number, then moves on;
- content layer (P2a): "no result" when the answer has no number, otherwise fine;
- language layer (P2b / P5b): corrects a fixed list of phrases (LANGUAGE_RULES) when the answer contains them;
- debrief (P3): weak spots from the S2+ tags in the records, as the real prompt would rank them;
- everything else: a minimal object that satisfies the JSON schema it is given (`from_schema`).

The engine can be steered from a test through `/api/_e2e/engine` (see ../e2e.py): its status (ready / not_running /
no_model / not_installed), kinds of call that fail on purpose, and a delay per call. The flag is read by
`config.e2e_enabled()`; without it nothing here is reachable.
"""
from __future__ import annotations

import asyncio
import json
import re
from collections import Counter
from typing import AsyncIterator

from .base import EngineError, EngineStatus, LLMEngine, Msg

MODEL = "scripted-e2e"
FAIL_KINDS = ("p0", "p1", "p2a", "p2b", "p2c", "p3", "p5b", "suggester", "text")

# (what the user said, the fix, why, class M meaning / N noticeable / C cosmetic). Matched case-insensitively; the quote
# returned is the user's own spelling, because the server drops corrections that are not an exact quote.
LANGUAGE_RULES = [
    (r"since (five|\d+) years", "for {0} years", "Use 'for' with periods of time, and 'since' with starting points.", "N"),
    (r"I am agree", "I agree", "Agree is itself the verb, so it needs no 'am'.", "N"),
    (r"he don't", "he doesn't", "He, she and it take 'doesn't'.", "N"),
    (r"more better", "better", "'Better' is already the comparative form.", "C"),
    (r"depend of", "depend on", "'Depend' goes with the preposition 'on'.", "N"),
    (r"discuss about", "discuss", "'Discuss' takes no preposition.", "C"),
    (r"informations", "information", "'Information' has no plural.", "N"),
]

# Plain-text replies (English track, one per user turn, then again from the top).
TUTOR_REPLIES = [
    "That sounds interesting. What was the hardest part of it?",
    "I see. How did you deal with that?",
    "Thanks for sharing. What would you do differently next time?",
]

STATE: dict = {"status": "ready", "fail": set(), "delay_ms": 0, "calls": Counter()}


def reset() -> None:
    STATE.update(status="ready", fail=set(), delay_ms=0, calls=Counter())


def configure(status: str | None = None, fail: list[str] | None = None, delay_ms: int | None = None) -> dict:
    if status is not None:
        STATE["status"] = status
    if fail is not None:
        STATE["fail"] = {k for k in fail if k in FAIL_KINDS}
    if delay_ms is not None:
        STATE["delay_ms"] = max(0, int(delay_ms))
    return snapshot()


def snapshot() -> dict:
    return {"status": STATE["status"], "fail": sorted(STATE["fail"]), "delay_ms": STATE["delay_ms"],
            "calls": dict(STATE["calls"])}


def start() -> bool:
    """"Open Ollama" in the e2e world: a not_running engine becomes ready (nothing is launched)."""
    if STATE["status"] == "not_running":
        STATE["status"] = "ready"
    return STATE["status"] == "ready"


# ---------- reading the prompts ----------

def _text(messages: list[Msg]) -> str:
    return "\n".join(str(m.get("content", "")) for m in messages if m.get("role") != "system")


def _tag(text: str, tag: str) -> str:
    match = re.search(rf"<{tag}>(.*?)</{tag}>", text, re.S)
    return match.group(1).strip() if match else ""


def _line(text: str, key: str) -> str:
    match = re.search(rf"^{key}:[ \t]*(.*)$", text, re.M)
    return match.group(1).strip() if match else ""


def _answer(text: str) -> str:
    return _tag(text, "answer") or _tag(text, "turn")


def kind_of(schema: dict | None) -> str:
    """Which prompt a JSON schema belongs to (by its field names)."""
    if schema is None:
        return "text"
    props = set(schema.get("properties", {}))
    if "say" in props:
        return "p1"
    if "questions" in props:
        return "p0"
    if "corrections" in props:
        return "p5b"
    if "items" in props and "weak_spots" not in props:
        return "p2b" if (schema["properties"]["items"].get("items", {}).get("properties", {}).get("better")
                         or {}).get("type") == "array" else "p4"
    if "verdict" in props:
        return "p3"
    if "rewrite" in props:
        return "p2c"
    if "story" in props:
        return "suggester"
    if "situation" in props:
        return "p2a"
    return "unknown"


# ---------- canned answers ----------

def interviewer(text: str) -> dict:
    """Follow up on the next thing the bank offers (result first) until the answer has a number."""
    if "has_number=true" in text:
        return {"gap": "none", "action": "next_question", "say": ""}
    bank = dict(re.findall(r"\b(YP|RN|WD|CT):\s*([^;]+?)(?:;|$)", _line(text, "FOLLOW_UP_BANK")))
    asked = _line(text, "FOLLOW_UPS_ALREADY_ASKED")
    for tag, gap in (("RN", "result"), ("YP", "own_part"), ("WD", "reflection"), ("CT", "tradeoff")):
        line = bank.get(tag, "").strip()
        if line and line not in asked:
            return {"gap": gap, "action": "follow_up", "say": line}
    return {"gap": "none", "action": "next_question", "say": ""}


def _first_words(answer: str, count: int) -> str:
    match = re.match(r"(?:\S+\s+){0,%d}\S+" % (count - 1), answer.strip())
    return match.group(0) if match else ""


def content_layer(text: str) -> dict:
    answer = _answer(text)
    n_i = int((re.search(r"first_person_actions=(\d+)", text) or [0, 0])[1])
    n_we = int((re.search(r"we_or_passive_actions=(\d+)", text) or [0, 0])[1])
    number = "has_number=true" in text
    quote = _first_words(answer, 8)
    return {"situation": True, "task": True, "action": n_i > 0, "result": number,
            "voice": "we" if n_we > n_i else ("i" if n_i else "none"),
            "result_type": "number" if number else "none", "relevant": True,
            "reflection": bool(re.search(r"\b(learned|differently)\b", answer, re.I)),
            "evidence": quote, "praise": quote}


def language_items(text: str) -> list[dict]:
    answer = _answer(text)
    items = []
    for pattern, better, reason, klass in LANGUAGE_RULES:
        match = re.search(pattern, answer, re.I)
        if match:
            fixed = better.format(*match.groups()) if "{" in better else better
            items.append({"original": match.group(0), "better": [fixed], "reason": reason,
                          "level": "B1", "class": klass})
    return items[:3]


def english_corrections(text: str) -> dict:
    items = [{**item, "better": item["better"][0]} for item in language_items(text)][:2]
    answer = _answer(text)
    keep = _first_words(answer, 4) if len(answer.split()) >= 6 else ""
    return {"corrections": items,
            "phrase_to_keep": {"phrase": keep, "why": "Clear and natural."} if keep else None}


def debrief(text: str) -> dict:
    found: dict[tuple[str, str], list[str]] = {}
    for line in re.findall(r"^q\d+ .*$", _tag(text, "records"), re.M):
        label = line.split(" | ")[0]
        for layer, tag, _sev in re.findall(r"(content|language|delivery):(\w+)\(S(\d)\)", line):
            found.setdefault((layer, tag), []).append(label)
    ranked = sorted(found.items(), key=lambda kv: -len(kv[1]))
    spots = [{"layer": layer, "tag": tag, "text": f"Work on {tag.replace('_', ' ')}.", "evidence": ev}
             for (layer, tag), ev in ranked[:3]]
    lead = "The one thing" if len(spots) == 1 else "The main thing"      # "one" is only true with one weak spot (F-13-6)
    return {"verdict": ("Your answers were clear. " + (f"{lead} to fix: {spots[0]['tag'].replace('_', ' ')}."
                                                          if spots else "Nothing repeated stood out.")),
            "weak_spots": spots, "strength": "You kept each answer on the question.",
            "next_step": "Practise one answer again, out loud, with a result at the end."}


def stronger(text: str) -> dict:
    answer = _answer(text) or text
    return {"rewrite": f"{answer.strip().rstrip('.')}. The result was [your number], and I would say so first.",
            "placeholders": ["[your number]"]}


def _clauses(source: str) -> list[str]:
    """Duty and requirement clauses of a posting, verbatim: the title line (first) is skipped when more lines follow,
    so question 1 quotes what the job asks for, not its name (13, QA-17)."""
    lines = [" ".join(line.split()) for line in source.splitlines() if line.strip()]
    if len(lines) > 1:
        lines = lines[1:]
    out = []
    for line in lines:
        for part in re.split(r"[.;,:!?]", line):
            part = part.strip()
            if 3 <= len(part.split()) <= 14 and part in " ".join(source.split()):
                out.append(part)
    return out


def questions(text: str) -> dict:
    """Questions anchored in real quotes of the user's own CV and job posting (the server drops any other anchor)."""
    count = int((re.search(r"^count:\s*(\d+)", text, re.M) or [0, 3])[1])
    source = _tag(text, "jd") or _tag(text, "cv")
    anchors = _clauses(source)
    words = source.split()
    out = []
    for n in range(max(3, min(count, 6))):
        if anchors:
            anchor = anchors[n % len(anchors)]
        else:
            chunk = words[n * 5:n * 5 + 5]
            if len(chunk) < 3:
                chunk = words[:5]
            anchor = " ".join(chunk)
        out.append({"id": f"V{n + 1}", "recipe": "R1", "anchor": anchor, "competency": "B",
                    "question": f"The posting says \"{anchor}\". Tell me about a time you did that.",
                    "follow_ups": [{"tag": "YP", "text": "What exactly did you do yourself?"},
                                   {"tag": "RN", "text": "What was the result, in numbers if you have them?"},
                                   {"tag": "WD", "text": "What would you do differently now?"}]})
    return {"questions": out}


def suggestion(text: str) -> dict:
    return {"story": "A project you led", "points": ["Situation in one line", "What you did", "A number at the end"],
            "answer": "In my last project I led a small team. I set the plan, I took the hard decision, "
                      "and the result was a 10 percent faster release."}


def from_schema(schema: dict) -> object:
    """A minimal value that satisfies a JSON schema: the fallback for prompts without a canned answer."""
    if "enum" in schema:
        return schema["enum"][0]
    for key in ("anyOf", "oneOf"):
        if key in schema:
            options = [o for o in schema[key] if o.get("type") != "null"]
            return from_schema(options[0] if options else schema[key][0])
    kind = schema.get("type")
    if kind == "object":
        props = schema.get("properties", {})
        return {name: from_schema(props.get(name, {})) for name in schema.get("required", [])}
    if kind == "array":
        return [from_schema(schema.get("items", {})) for _ in range(int(schema.get("minItems", 0)))]
    if kind == "boolean":
        return True
    if kind in ("integer", "number"):
        return int(schema.get("minimum", 1))
    if kind == "null":
        return None
    return "scripted"


def plain_reply(messages: list[Msg]) -> str:
    system = " ".join(str(m.get("content", "")) for m in messages if m.get("role") == "system")
    if "microphone check" in system:
        return "I heard you clearly. Everything works."
    if "Reply with one word" in system:
        return "ready"
    turns = sum(1 for m in messages if m.get("role") == "user" and "<turn>" in str(m.get("content", "")))
    return TUTOR_REPLIES[max(0, turns - 1) % len(TUTOR_REPLIES)]


def reply_for(messages: list[Msg], schema: dict | None) -> str:
    """The whole scripted reply as text (JSON for a schema)."""
    kind = kind_of(schema)
    text = _text(messages)
    if kind == "text":
        return plain_reply(messages)
    builders = {"p1": interviewer, "p2a": content_layer, "p2b": lambda t: {"items": language_items(t)},
                "p5b": english_corrections, "p3": debrief, "p2c": stronger, "p0": questions,
                "suggester": suggestion}
    data = builders[kind](text) if kind in builders else from_schema(schema or {})
    return json.dumps(data, ensure_ascii=False)


class ScriptedEngine(LLMEngine):
    id = "ollama"            # the Ollama slot: the web app knows no other local engine id

    @property
    def model(self) -> str:
        return MODEL

    async def status(self) -> EngineStatus:
        code = STATE["status"]
        if code == "ready":
            return EngineStatus(code="ready", ready=True, message="Ollama is ready with scripted-e2e.", model=MODEL)
        if code == "not_installed":
            return EngineStatus(code="not_installed", message="Ollama is not installed.",
                                hint="Download Ollama, then run: ollama pull qwen3:4b-instruct",
                                hint_command="ollama pull qwen3:4b-instruct", fix_url="https://ollama.com/download",
                                model=MODEL)
        if code == "no_model":
            return EngineStatus(code="no_model", message="The model qwen3:4b-instruct is not downloaded.",
                                hint="Run: ollama pull qwen3:4b-instruct", hint_command="ollama pull qwen3:4b-instruct",
                                fix_url="https://ollama.com/download", model="qwen3:4b-instruct")
        return EngineStatus(code="not_running", message="Ollama is installed but not running.",
                            hint="Open the Ollama app, or run: ollama serve", hint_command="ollama serve",
                            fix_url="https://ollama.com/download", model=MODEL)

    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        if STATE["status"] != "ready":
            raise EngineError("ollama_not_running", "Ollama is not running.", "Open the Ollama app, or run: ollama serve")
        kind = kind_of(json_schema)
        STATE["calls"][kind] += 1
        if STATE["delay_ms"]:
            await asyncio.sleep(STATE["delay_ms"] / 1000)
        if kind in STATE["fail"]:
            raise EngineError("e2e_failure", "The scripted engine was told to fail this call.")
        text = reply_for(messages, json_schema)
        for i in range(0, len(text), 24):
            yield text[i:i + 24]
