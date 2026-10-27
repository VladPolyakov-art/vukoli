#!/usr/bin/env python3
"""Dev script: fill the app with fictional "Demo · ..." sessions so every state of the debrief (layout D) and the
conversation history can be looked at in the real app.

  ~/.vukoli/venv/bin/python app/server/scripts/seed_demo_sessions.py                 # write into the owner's data folder
  ~/.vukoli/venv/bin/python app/server/scripts/seed_demo_sessions.py --data-dir DIR  # write somewhere else (a scratch copy)
  ~/.vukoli/venv/bin/python app/server/scripts/seed_demo_sessions.py --remove        # delete only the demo records

How it works
  * Records are written with the server's own `storage.save_session` / `storage.save_record`, so the JSON, the Markdown
    companion and the version marker are the real ones. Nothing is POSTed to a running server; the API reads the
    folder on every request, so the sessions show up at once.
  * The layers of every answer are made by the server's own code (`feedback.content_from_model`, `feedback.language_layer`,
    `feedback._delivery`, `feedback.cascade_note`); the scorecard, the verdict step and the plan are NOT saved: the API
    builds them at read time (`debrief_view.enrich_debrief`). What each session says is in `seed_demo_content.py`.
  * Everything is recognisable as demo: the id starts with `demo-`, the title with `Demo · `. `--remove` deletes a record
    only when its id is one of ours AND its title still starts with `Demo · ` (a session you renamed is left alone).
  * Re-running overwrites the demo records (dates move with "now"); it never touches anything else. The trash, the
    settings and the profile are not read or written.
Content is fictional (Sam Rivera and invented companies); the interviewer is Mike.
"""
from __future__ import annotations

import argparse
import asyncio
import datetime
import hashlib
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER_ROOT = HERE.parent
OWNER_DIR = Path("~/Library/Application Support/interview-coach").expanduser()
DEMO_PREFIX = "Demo · "

# --data-dir must be known before the server package reads the data folder.
_pre = argparse.ArgumentParser(add_help=False)
_pre.add_argument("--data-dir")
_known, _ = _pre.parse_known_args()
os.environ["IC_DATA_DIR"] = str(Path(_known.data_dir).expanduser() if _known.data_dir else OWNER_DIR)
sys.path.insert(0, str(SERVER_ROOT))
sys.path.insert(0, str(HERE))

from server import config, content, debrief_view, feedback, storage          # noqa: E402

import seed_demo_content as demo                                              # noqa: E402

SEVERITY = {"M": 3, "N": 2, "C": 1}
ANSWER_DEFAULTS = {"situation": True, "task": True, "action": True, "result": True, "voice": "i",
                   "result_type": "number", "relevant": True, "reflection": True, "evidence": "", "praise": ""}
OPENERS = ["Okay.", "Thanks.", "Got it.", "Understood."]
TYPING_WPM = 40


def digest(*parts: object) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()


def count_words(text: str) -> int:
    return len(feedback.WORD.findall(text))


def need_quote(fragment: str, answer: str, what: str, where: str) -> None:
    if fragment and not feedback.is_quote(fragment, answer):
        raise SystemExit(f"[{where}] {what} is not a quote of the answer: {fragment!r}")


# ---------- one answer -> one feedback record ----------

def language_items(spec: dict, answer: str, where: str) -> list[dict]:
    items = []
    for n, entry in enumerate(spec.get("lang") or []):
        original, better, tag, klass, reason, *rest = entry
        status = rest[0] if rest else "active"
        need_quote(original, answer, "language original", where)
        items.append({"id": "f" + digest(where, n, original)[:8], "layer": "language", "tag": tag, "original": original,
                      "heard_as": original, "better": [better], "reason": reason, "level": "B1", "class": klass,
                      "severity": SEVERITY[klass], "possibly_misheard": status == "unconfirmed", "status": status})
    items.sort(key=lambda f: -f["severity"])
    return items


def make_record(sid: str, n: int, question: dict | None, asked: str, kind: str, spec: dict, mode: str,
                created: datetime.datetime) -> tuple[dict, float]:
    """(feedback record, seconds the answer took). Text answers take typing time; voice answers take words / wpm."""
    text = spec["text"]
    where = f"{sid} answer {n}"
    words = count_words(text)
    wpm = spec.get("wpm")
    if wpm and kind == "main" and words >= 56 and words * 60 / wpm < 31:
        wpm = round(words * 60 / 31.5)         # a spoken answer of this many words takes at least ~30 s: not "too short" by accident
    seconds = words * 60 / wpm if wpm else words * 60 / TYPING_WPM
    competency = (question or {}).get("competency", "") if mode == "interview" else ""
    layers: dict = {}
    audio = {"span": seconds, "wpm": wpm, "pauses": spec.get("pauses", 0)} if wpm else None
    layers["delivery"] = feedback._delivery(text, audio, kind == "main")
    items = language_items(spec, text, where)
    layers["language"] = feedback.language_layer(items)
    if mode == "english":
        keep = spec.get("keep")
        layers["language"]["phrase_to_keep"] = {"phrase": keep[0], "why": keep[1]} if keep else None
        if not items:
            layers["language"]["fix"] = "No corrections this turn."
        if keep:
            need_quote(keep[0], text, "phrase_to_keep", where)
    else:
        data = {**ANSWER_DEFAULTS, **(spec.get("c") or {})}
        need_quote(data["evidence"], text, "content evidence", where)
        need_quote(data["praise"], text, "content praise", where)
        h = feedback.hints(text)
        layers["content"] = feedback.content_from_model(data, question=asked, competency=competency, transcript=text,
                                                        n_i=h["n_i"], n_we=h["n_we"])
    low = []
    for word in spec.get("low") or []:
        need_quote(word, text, "low-confidence word", where)
        low.append({"w": word, "start": round(1.5 + len(low) * 7.3, 1), "end": round(1.9 + len(low) * 7.3, 1), "p": 0.38})
    record = {"id": "fb-" + digest(sid, n)[:8], "turn_id": None, "question": asked,
              "question_id": (question or {}).get("id", ""), "competency": competency,
              "answer_kind": kind if mode == "interview" else "turn", "answer": text,
              "source": "voice" if wpm else "text", "created_at": created.isoformat(timespec="seconds"),
              "layers": layers, "complete": True, "heard_as_words": low,
              "cascade": feedback.cascade_note(layers)}
    if spec.get("edited"):
        record["edited"] = True
    if spec.get("stronger"):
        rewrite, placeholders = spec["stronger"]
        record["stronger"] = {"rewrite": rewrite, "placeholders": placeholders}
    return record, seconds


# ---------- one session ----------

def start_time(now: datetime.datetime, days_ago: int, hour: int, minute: int) -> datetime.datetime:
    started = (now - datetime.timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return started - datetime.timedelta(days=1) if started > now else started


def bank_question(qid: str) -> dict:
    return next(q.public() for q in content.question_bank() if q.id == qid)


def resolve_questions(spec: dict) -> list[dict]:
    out = []
    for item in spec["questions"]:
        out.append(item if isinstance(item, dict) else bank_question(item))
    return out


def counted_spots(records: list[dict], wanted: list[tuple[str, str]]) -> list[dict]:
    """Weak spots as `feedback.fallback_debrief` makes them (the advice from the code, the evidence recounted from the
    records), but for the (layer, tag) pairs we pick."""
    scored = debrief_view.scored_records(records)
    evidence: dict[tuple[str, str], list[str]] = {}
    for i, record in enumerate(scored, 1):
        for layer, tag, _sev in feedback.counted_tags(record):
            ids = evidence.setdefault((layer, tag), [])
            if f"q{i}" not in ids:
                ids.append(f"q{i}")
    spots = []
    for layer, tag in wanted:
        if (layer, tag) not in evidence:
            raise SystemExit(f"weak spot {layer}:{tag} is not counted in any answer (counted: {sorted(evidence)})")
        typed = all(((r.get("layers") or {}).get("delivery") or {}).get("metrics", {}).get("mode") == "text" for r in scored)
        text = (feedback.CONTENT_FIX.get(tag) or (feedback.DELIVERY_TIP_TEXT.get(tag) if typed else None)
                or feedback.DELIVERY_TIP.get(tag) or feedback.LANGUAGE_FIX.get(tag) or f"Work on {tag.replace('_', ' ')}.")
        spots.append({"layer": layer, "tag": tag, "text": text, "evidence": evidence[(layer, tag)]})
    return spots


def build_debrief(spec: dict, records: list[dict]) -> dict:
    scored = debrief_view.scored_records(records)
    d = spec.get("debrief")
    if len(scored) < 3 or not d:
        return asyncio.run(feedback.debrief(None, records, layer_order="content-first"))
    return {"verdict": d["verdict"], "weak_spots": counted_spots(records, d["spots"]), "strength": d.get("strength", ""),
            "next_step": d.get("next_step", ""), "source": "model"}


def build_session(spec: dict, now: datetime.datetime) -> dict:
    sid = spec["id"]
    mode = spec.get("mode", "interview")
    started = start_time(now, spec["days_ago"], *spec["at"])
    cursor = started + datetime.timedelta(seconds=20)
    questions = resolve_questions(spec) if mode == "interview" else []
    by_id = {q["id"]: q for q in questions}
    transcript: list[dict] = []
    records: list[dict] = []
    spoken = 15.0
    opener = 0

    def say(text: str, kind: str, qid: str = "") -> None:
        row = {"role": "model", "kind": kind, "text": text}
        if qid:
            row["question_id"] = qid
        transcript.append(row)

    def answer(spec_answer: dict, question: dict | None, asked: str, kind: str) -> None:
        nonlocal cursor, spoken
        record, seconds = make_record(sid, len(records) + 1, question, asked, kind, spec_answer, mode, cursor)
        records.append(record)
        row = {"role": "user", "text": spec_answer["text"], "kind": kind if mode == "interview" else "turn"}
        if question:
            row["question_id"] = question["id"]
        transcript.append(row)
        cursor += datetime.timedelta(seconds=seconds + 12)
        spoken += seconds + 12

    if mode == "english":
        say(content.copy("english_opening"), "turn")
        for turn in spec["turns"]:
            answer(turn["answer"], None, transcript[-1]["text"], "turn")
            if turn.get("mike"):
                say(turn["mike"], "turn")
    else:
        first = questions[0]
        say(content.copy("interview_opening", name="", count=len(questions), question=first["text"]), "question", first["id"])
        for n, turn in enumerate(spec["turns"]):
            question = by_id[turn["q"]]
            if turn.get("said"):                       # answers too short to coach: kept in the chat, no feedback made
                for i, line in enumerate(turn["said"]):
                    transcript.append({"role": "user", "text": line, "question_id": question["id"], "kind": "main"})
                    if i + 1 < len(turn["said"]):
                        say(content.copy("short_answer"), "wait", question["id"])
                    spoken += 14
            else:
                answer(turn["answer"], question, question["text"], "main")
                if turn.get("follow"):
                    follow_text, follow_answer = turn["follow"]
                    say(follow_text, "follow_up", question["id"])
                    answer(follow_answer, question, follow_text, "follow_up")
            if n + 1 < len(spec["turns"]):
                nxt = by_id[spec["turns"][n + 1]["q"]]
                say(f"{OPENERS[opener % len(OPENERS)]} {nxt['text']}", "question", nxt["id"])
                opener += 1
            elif spec.get("closing", True):
                say(content.copy("interview_closing"), "closing")
            spoken += 6
    duration = round(spoken + 20)
    session = {"id": sid, "mode": mode, "round_type": spec.get("round_type", "") if mode == "interview" else "",
               "engine": "claude_cli", "model": "haiku", "level": "B1", "strictness": spec.get("strictness", 2),
               "input": spec.get("input", "voice"), "vacancy_id": spec.get("vacancy_id", ""),
               "vacancy_title": spec.get("vacancy_title", ""), "started_at": started.isoformat(timespec="seconds"),
               "ended_at": (started + datetime.timedelta(seconds=duration)).isoformat(timespec="seconds"),
               "duration_s": duration, "app_version": "demo-seed", "questions": questions, "title": spec["title"],
               "transcript": transcript, "feedback": records,
               "stats": {"answers": sum(1 for t in transcript if t["role"] == "user"), "turns": len(transcript)}}
    if not session["round_type"]:
        session.pop("round_type")
    session["debrief"] = build_debrief(spec, records)
    if spec.get("requests"):
        used = spec.get("limit_used", 0.6)
        session["usage"] = {"engine": "claude_cli", "requests": spec["requests"],
                            "windows": [{"id": "five_hour", "before": 12.0, "after": round(12.0 + used, 1)}]}
    if spec.get("archived"):
        session["archived"] = True
        session["archived_at"] = (started + datetime.timedelta(days=2)).isoformat(timespec="seconds")
    return session


# ---------- write / remove ----------

def demo_vacancies(now: datetime.datetime) -> list[dict]:
    out = []
    for v in demo.VACANCIES:
        record = {k: val for k, val in v.items() if k != "days_ago"}
        record.update(created_at=(now - datetime.timedelta(days=v["days_ago"])).isoformat(timespec="seconds"), source="pasted")
        out.append(record)
    return out


def check_ids() -> None:
    for spec in demo.SESSIONS:
        assert spec["id"].startswith("demo-") and storage.RECORD_ID.fullmatch(spec["id"]), spec["id"]
        assert spec["title"].startswith(DEMO_PREFIX), spec["title"]
    for vacancy in demo.VACANCIES:
        assert vacancy["id"].startswith("demo-") and vacancy["title"].startswith(DEMO_PREFIX), vacancy["id"]


def remove() -> None:
    gone = 0
    for kind, specs in (("sessions", demo.SESSIONS), ("vacancies", demo.VACANCIES)):
        for spec in specs:
            path = storage.record_path(kind, spec["id"])
            if not path.exists():
                continue
            title = storage.read_json(path).get("title", "")
            if not title.startswith(DEMO_PREFIX):
                print(f"left alone (renamed): {kind}/{spec['id']}  {title!r}")
                continue
            path.unlink()
            path.with_suffix(".md").unlink(missing_ok=True)
            gone += 1
            print(f"removed {kind}/{spec['id']}")
    print(f"{gone} demo record(s) removed from {config.data_dir()}")


def seed() -> None:
    now = datetime.datetime.now().astimezone()
    for vacancy in demo_vacancies(now):
        storage.save_record("vacancies", vacancy)
    rows = []
    for spec in demo.SESSIONS:
        session = storage.save_session(build_session(spec, now))
        shown = debrief_view.enrich_debrief(session.get("debrief"), session.get("feedback") or [], session["mode"]) or {}
        card = {r["key"]: r["score"] for r in (shown.get("scorecard") or {}).get("rows", [])}
        step = (shown.get("step") or {}).get("value")
        rows.append((session["id"], session["title"], step, card, len(session["feedback"]), bool(shown.get("too_short"))))
    print(f"wrote {len(rows)} demo sessions and {len(demo.VACANCIES)} vacancy into {config.data_dir()}\n")
    for sid, title, step, card, n, short in rows:
        name = debrief_view.STEP_NAMES[step] if step in (0, 1, 2) else ("too short" if short else "-")
        print(f"{sid:24} {name:13} {n:2} records  {card or ''}  {title}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", help=f"default: {OWNER_DIR}")
    parser.add_argument("--remove", action="store_true", help="delete only the demo records this script made")
    args = parser.parse_args()
    check_ids()
    remove() if args.remove else seed()


if __name__ == "__main__":
    main()
