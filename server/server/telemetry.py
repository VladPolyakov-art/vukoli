"""Opt-in usage telemetry (D25). Off by default.

When the user opts in, events are appended to `telemetry.jsonl` in the data folder. Events hold counts,
timings, engine ids and error codes only: never transcripts, CV text, job postings, file names or keys.
Nothing is sent anywhere.
TODO(telemetry-remote): add an optional upload endpoint once the project has a privacy policy and a
server; until then the file stays on this computer and the user can read or delete it.
"""
from __future__ import annotations

import json
import threading

from . import DATA_VERSION, __version__, config
from .storage import now_iso

ALLOWED_FIELDS = {"engine", "model", "mode", "round_type", "turns", "answers", "code", "first_text_ms",
                  "first_audio_ms", "total_ms", "stt_ms", "path", "level", "input", "duration_s", "feedback_ms",
                  "layer", "ok"}
_lock = threading.Lock()


def path():
    return config.data_dir() / "telemetry.jsonl"


def enabled(settings: dict | None = None) -> bool:
    settings = settings or config.load_settings()
    return bool(settings.get("telemetry_opt_in"))


def record(event: str, settings: dict | None = None, **fields) -> bool:
    """Append one event if the user opted in. Unknown or free-text fields are dropped."""
    if not enabled(settings):
        return False
    clean = {k: v for k, v in fields.items() if k in ALLOWED_FIELDS and isinstance(v, (int, float, bool, str))
             and (not isinstance(v, str) or len(v) <= 60)}
    line = json.dumps({"data_version": DATA_VERSION, "app_version": __version__, "at": now_iso(),
                       "event": event, **clean})
    with _lock:
        with path().open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    return True


def info(settings: dict | None = None) -> dict:
    p = path()
    count = 0
    if p.is_file():
        with p.open(encoding="utf-8") as handle:
            count = sum(1 for _ in handle)
    return {"opt_in": enabled(settings), "events": count, "file": str(p), "remote": False,
            "what": "Counts, timings, engine names and error codes. Never what you said or wrote."}


def clear() -> None:
    path().unlink(missing_ok=True)
