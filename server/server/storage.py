"""Local storage: versioned JSON records with atomic writes, a trash folder and rendered Markdown.

Layout inside the data dir:
  meta.json                     data_version marker
  settings.json                 settings (see config.py)
  profile.json                  the user's CV: uploaded files (their text) and a pasted note (v2, D79)
  vacancies/<id>.json           job postings and cached generated questions
  sessions/<id>.json            canonical session record
  sessions/<id>.md              readable Markdown rendered from the JSON
  trash/sessions/, trash/vacancies/
  telemetry.jsonl               only when the user opted in
"""
from __future__ import annotations

import datetime
import json
import re
import secrets
import threading
from pathlib import Path
from typing import Any

from . import DATA_VERSION
from .config import data_dir

RECORD_ID = re.compile(r"[a-z0-9][a-z0-9-]{5,40}")
_lock = threading.RLock()


# ---------- Names (13: QA-04, QA-15) ----------
# One rule for every list and heading: a job session is "Company · Role", an interview without a job is
# "General questions", English is "English practice", a drill is "Drill · <the same name>".
GENERAL_TITLE = "General questions"
ENGLISH_TITLE = "English practice"
DRILL_PREFIX = "Drill · "
LEGACY_PREFIX = "Interview practice"


def job_name(title: str) -> str:
    """A job's name as "Company · Role": "Role at Company" is turned around, "Company - Role" normalised.
    Anything else (one word, a sentence) stays as it is."""
    line = " ".join(str(title or "").split())
    if not line or " · " in line or len(line) > 140:
        return line
    at = re.match(r"^(.{3,80}?)\s+(?:at|@)\s+(.{2,60})$", line, re.I)
    if at:
        return f"{at.group(2).strip()} · {at.group(1).strip()}"
    sep = re.match(r"^(.{2,60}?)\s+[|\u2013\u2014-]\s+(.{3,80})$", line)
    if sep:
        return f"{sep.group(1).strip()} · {sep.group(2).strip()}"
    return line


def session_title(mode: str, vacancy_title: str = "", drill: bool = False) -> str:
    """The name a new session is saved under."""
    if mode == "english":
        return ENGLISH_TITLE
    base = job_name(vacancy_title) or GENERAL_TITLE
    return f"{DRILL_PREFIX}{base}" if drill else base


def display_title(title: str) -> str:
    """A saved title as it is shown. Sessions saved before 13 carry an "Interview practice" prefix: dropped here, so
    "Interview practice · Kestrel Pay · Product Manager" reads "Kestrel Pay · Product Manager" and a bare
    "Interview practice" reads "General questions". A name the user typed is left alone."""
    raw = str(title or "").strip()
    if raw == LEGACY_PREFIX:
        return GENERAL_TITLE
    head = LEGACY_PREFIX + " · "
    if raw.startswith(head) and raw[len(head):].strip():
        return raw[len(head):].strip()
    return raw


def now_iso() -> str:
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def new_id(prefix: str = "") -> str:
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{prefix}{stamp}-{secrets.token_hex(3)}"


def _check_id(record_id: str) -> str:
    if not RECORD_ID.fullmatch(record_id or ""):
        raise FileNotFoundError(record_id)
    return record_id


def _folder(kind: str) -> Path:
    path = data_dir() / kind
    path.mkdir(parents=True, exist_ok=True)
    return path


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f".{secrets.token_hex(3)}.tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def write_json(path: Path, data: dict) -> dict:
    data = {"data_version": DATA_VERSION, **{k: v for k, v in data.items() if k != "data_version"}}
    atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2))
    return data


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


# ---------- Generic records (sessions, vacancies) ----------

def record_path(kind: str, record_id: str) -> Path:
    return _folder(kind) / f"{_check_id(record_id)}.json"


def save_record(kind: str, record: dict) -> dict:
    with _lock:
        return write_json(record_path(kind, record["id"]), record)


def read_record(kind: str, record_id: str) -> dict:
    return read_json(record_path(kind, record_id))


def list_records(kind: str) -> list[dict]:
    items = []
    for path in _folder(kind).glob("*.json"):
        try:
            items.append(read_json(path))
        except (OSError, ValueError):
            continue
    return items


def trash_record(kind: str, record_id: str) -> dict:
    """Move a record (and its rendered Markdown) to trash. FileNotFoundError if missing."""
    source = record_path(kind, record_id)
    with _lock:
        if not source.exists():
            raise FileNotFoundError(record_id)
        trash = _folder(f"trash/{kind}")
        target = trash / source.name
        if target.exists():
            target = trash / f"{source.stem}-{secrets.token_hex(2)}.json"
        source.replace(target)
        md = source.with_suffix(".md")
        if md.exists():
            md.replace(target.with_suffix(".md"))
    return {"id": record_id, "trash_id": target.stem}


def list_trash(kind: str) -> list[dict]:
    items = []
    for path in _folder(f"trash/{kind}").glob("*.json"):
        try:
            data = read_json(path)
        except (OSError, ValueError):
            continue
        items.append({"trash_id": path.stem, "id": data.get("id", path.stem),
                      "title": display_title(data.get("title", "")), "started_at": data.get("started_at", ""),
                      "deleted_at": datetime.datetime.fromtimestamp(path.stat().st_mtime).astimezone()
                      .isoformat(timespec="seconds")})
    return sorted(items, key=lambda item: item["deleted_at"], reverse=True)


def restore_record(kind: str, trash_id: str) -> dict:
    """Restore from trash. FileNotFoundError if not in trash, FileExistsError if the id is taken again."""
    source = _folder(f"trash/{kind}") / f"{_check_id(trash_id)}.json"
    with _lock:
        if not source.exists():
            raise FileNotFoundError(trash_id)
        data = read_json(source)
        target = record_path(kind, data.get("id", trash_id))
        if target.exists():
            raise FileExistsError(target.name)
        source.replace(target)
        md = source.with_suffix(".md")
        if md.exists():
            md.replace(target.with_suffix(".md"))
    return data


def purge_trashed(kind: str, trash_id: str) -> None:
    """Delete a trashed record and its rendered Markdown for good (US-23 AC2). FileNotFoundError if not in trash."""
    source = _folder(f"trash/{kind}") / f"{_check_id(trash_id)}.json"
    with _lock:
        if not source.exists():
            raise FileNotFoundError(trash_id)
        source.unlink()
        source.with_suffix(".md").unlink(missing_ok=True)


# ---------- Profile ----------

def profile_path() -> Path:
    return data_dir() / "profile.json"


PROFILE_MAX_FILES = 10
PROFILE_MAX_CHARS = 40000


def _profile_view(raw: dict) -> dict:
    """v2 shape for the API; `text` joins the note and every file (what Mike reads). v1 (one text) reads as one file
    or as the note, so a CV saved before D79 keeps working."""
    if raw.get("v") == 2:
        files, note = list(raw.get("files") or []), str(raw.get("note") or "")
    else:
        text, source = str(raw.get("text") or ""), str(raw.get("source") or "")
        if text and source.startswith("file:"):
            files = [{"id": "f1", "name": source[5:], "text": text, "added": raw.get("updated", "")}]
            note = ""
        else:
            files, note = [], text
    parts = [note.strip()] if note.strip() else []
    parts += [f"## {f['name']}\n{f['text'].strip()}" for f in files if f.get("text", "").strip()]
    updated = max([str(raw.get("updated") or "")] + [str(f.get("added") or "") for f in files])
    return {
        "text": "\n\n".join(parts)[:PROFILE_MAX_CHARS],
        "source": "files" if files else ("paste" if note else ""),
        "updated": updated,
        "note": note,
        "files": [{"id": f["id"], "name": f["name"], "chars": len(f.get("text", "")), "added": f.get("added", "")} for f in files],
    }


def _profile_raw() -> dict:
    path = profile_path()
    if not path.is_file():
        return {}
    try:
        return read_json(path)
    except (OSError, ValueError):
        return {}


def _profile_v2() -> dict:
    raw = _profile_raw()
    if raw.get("v") == 2:
        return {"v": 2, "note": raw.get("note", ""), "files": list(raw.get("files") or []), "updated": raw.get("updated", "")}
    view = _profile_view(raw)
    files = [{"id": f["id"], "name": f["name"], "text": raw.get("text", ""), "added": f["added"]} for f in view["files"]]
    return {"v": 2, "note": view["note"], "files": files, "updated": raw.get("updated", "")}


def read_profile() -> dict:
    return _profile_view(_profile_raw())


def save_profile(text: str, source: str = "") -> dict:
    """The pasted note (the text a person typed, not a file's)."""
    with _lock:
        data = _profile_v2()
        data.update(note=text.strip()[:PROFILE_MAX_CHARS], updated=now_iso())
        return _profile_view(write_json(profile_path(), data))


class ProfileFull(ValueError):
    pass


def add_profile_file(name: str, text: str, replace: str | None = None) -> dict:
    """Adds a file's text; `replace` (a file id) swaps that file in place. A file with the same name is replaced too."""
    with _lock:
        data = _profile_v2()
        entry = {"id": new_id("f"), "name": name[:300], "text": text.strip()[:PROFILE_MAX_CHARS], "added": now_iso()}
        files = data["files"]
        at = next((i for i, f in enumerate(files) if f["id"] == replace or (not replace and f["name"] == entry["name"])), None)
        if at is not None:
            files[at] = entry
        elif len(files) >= PROFILE_MAX_FILES:
            raise ProfileFull(f"Up to {PROFILE_MAX_FILES} files.")
        else:
            files.append(entry)
        data["updated"] = entry["added"]
        return _profile_view(write_json(profile_path(), data))


def delete_profile_file(file_id: str) -> dict:
    with _lock:
        data = _profile_v2()
        data["files"] = [f for f in data["files"] if f["id"] != file_id]
        data["updated"] = now_iso()
        return _profile_view(write_json(profile_path(), data))


def delete_profile() -> None:
    profile_path().unlink(missing_ok=True)


# ---------- Markdown rendering ----------

def md_cell(text: Any) -> str:
    return str(text or "").replace("|", "\\|").replace("\n", " ").strip()


def render_session_markdown(session: dict) -> str:
    started = session.get("started_at", "")
    lines = ["---", f"data_version: {DATA_VERSION}", f"id: {session.get('id', '')}",
             f"date: {started[:10]}", f"mode: {session.get('mode', '')}",
             f"engine: {session.get('engine', '')}", f"model: {session.get('model', '')}",
             "tags: [interview-practice]", "---", "",
             f"# {display_title(session.get('title', '')) or 'Practice session'}", "",
             "Saved on this computer.", ""]
    debrief = session.get("debrief") or {}
    if debrief.get("verdict"):
        lines += ["## Debrief", "", debrief["verdict"], ""]
        for spot in debrief.get("weak_spots", []):
            lines.append(f"- **{md_cell(spot.get('layer'))}**: {md_cell(spot.get('text'))}")
        if debrief.get("strength"):
            lines += ["", f"Strength: {debrief['strength']}"]
        if debrief.get("next_step"):
            lines += ["", f"Next step: {debrief['next_step']}"]
        lines.append("")
    feedback = session.get("feedback") or []
    if feedback:
        lines += ["## Feedback per answer", ""]
        for item in feedback:
            lines.append(f"### {md_cell(item.get('question')) or 'Answer'}")
            lines.append("")
            lines.append(f"> {md_cell(item.get('answer'))}")
            lines.append("")
            layers = item.get("layers") or {}
            content = layers.get("content")
            if content:
                lines.append(f"- Content: {md_cell(content.get('fix') or 'Nothing to fix here.')}")
            delivery = layers.get("delivery")
            if delivery:
                lines.append(f"- Delivery: {md_cell(delivery.get('fix') or 'Nothing to fix here.')}")
            language = layers.get("language") or {}
            flags = [f for f in language.get("items", []) if f.get("status") in ("active", "confirmed")]
            if flags:
                lines += ["", "| Heard as | Say it like this | Why |", "| --- | --- | --- |"]
                for flag in flags:
                    lines.append(f"| {md_cell(flag.get('original'))} | {md_cell('; '.join(flag.get('better', [])))} "
                                 f"| {md_cell(flag.get('reason'))} |")
            lines.append("")
    lines += ["## Transcript", ""]
    for turn in session.get("transcript", []):
        speaker = "Mike" if turn.get("role") == "model" else "You"
        text = str(turn.get("text", "")).strip()
        if text:
            lines.append(f"**{speaker}:** {text}")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def save_session(session: dict) -> dict:
    saved = save_record("sessions", session)
    md_path = record_path("sessions", session["id"]).with_suffix(".md")
    atomic_write(md_path, render_session_markdown(saved))
    return saved


def export_obsidian(session: dict, folder: str) -> Path | None:
    """Copy the rendered Markdown into the user's chosen folder (off until a folder is set)."""
    if not folder:
        return None
    target_dir = Path(folder).expanduser()
    if not target_dir.is_dir():
        return None
    base = f"Interview_Practice_{session.get('started_at', '')[:16].replace(':', '-').replace('T', '_')}"
    path, n = target_dir / f"{base}.md", 2
    while path.exists():
        path, n = target_dir / f"{base}-{n}.md", n + 1
    path.write_text(render_session_markdown(session), encoding="utf-8")
    return path

