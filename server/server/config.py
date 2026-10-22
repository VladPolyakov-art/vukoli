"""Paths, environment overrides and the persisted settings file.

Settings live in the OS app-data folder (platformdirs), never in the install folder.
API keys are stored only in `settings.json` inside that folder (mode 0600) and are never logged
or returned by the API (the API reports `has_api_key` instead).
"""
from __future__ import annotations

import copy
import json
import os
import threading
from pathlib import Path
from typing import Any

from . import APP_NAME, DATA_VERSION, __version__

SERVER_ROOT = Path(__file__).resolve().parent.parent          # app/server
APP_ROOT = SERVER_ROOT.parent                                  # app


def _load_dotenv() -> None:
    """Developer convenience: read app/server/.env if it exists. Real env vars win."""
    path = SERVER_ROOT / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


def data_dir() -> Path:
    override = os.getenv("IC_DATA_DIR", "").strip()
    if override:
        path = Path(override).expanduser()
    else:
        from platformdirs import user_data_dir
        path = Path(user_data_dir(APP_NAME, appauthor=False))
    path.mkdir(parents=True, exist_ok=True)
    return path


# E2E mode only (POST /api/_e2e/storage): report the folder as not writable without touching the disk.
E2E_STORAGE_BLOCKED = False


def data_dir_writable() -> bool:
    """US-23 AC4: can sessions be written? A real write and remove of a small file in the data folder (a read-only
    mount, a full disk and a missing permission all show up here; os.access does not catch them all)."""
    if E2E_STORAGE_BLOCKED and e2e_enabled():
        return False
    try:
        probe = data_dir() / f".write-test-{os.getpid()}-{threading.get_ident()}"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def content_dir() -> Path:
    override = os.getenv("IC_CONTENT_DIR", "").strip()
    return Path(override).expanduser() if override else SERVER_ROOT / "content"


def web_dist_dir() -> Path:
    override = os.getenv("IC_WEB_DIST", "").strip()
    return Path(override).expanduser() if override else APP_ROOT / "web" / "dist"


def e2e_enabled() -> bool:
    """IC_E2E=1: the end-to-end test mode (scripted engine, /api/_e2e/*). Off everywhere else, and invisible when off."""
    return os.getenv("IC_E2E", "").strip() == "1"


HOST = os.getenv("IC_HOST", "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.getenv("IC_PORT", "8000"))
# Extra origins allowed to call state-changing endpoints and the session socket (Vite dev server).
DEV_ORIGINS = {o.strip().rstrip("/") for o in os.getenv(
    "IC_DEV_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()}

DEFAULT_SETTINGS: dict[str, Any] = {
    "engine": "ollama",                       # ollama | openai_compatible | claude_cli | codex_cli | antigravity_cli | gemini_live
    # "" url = env OLLAMA_URL or localhost; "" model = chosen by RAM; "" voice_model = qwen3:4b-instruct
    "ollama": {"url": "", "model": "", "voice_model": ""},
    "openai_compatible": {"base_url": "", "api_key": "", "model": ""},
    # verified: None = not checked yet, True = a real request answered, False = Claude Code isn't signed in (D85)
    "claude_cli": {"model": "haiku", "verified": None},
    # D86: the same for Codex; "" model = the Codex CLI's own default for the ChatGPT plan
    "codex_cli": {"model": "", "verified": None},
    # D87: the same for the Antigravity CLI; "" model = its own default, run at low effort
    "antigravity_cli": {"model": "", "verified": None},
    "gemini_live": {"api_key": "", "model": "gemini-3.8-live", "text_model": "gemini-3.5-flash-lite",
                    "voice": "Puck"},
    "voice": "",                              # Kokoro voice id; "" = default male voice for Mike
    "kokoro_speed": 1.0,
    "stt": {"backend": "auto", "model": ""},  # auto | mlx | faster_whisper | none
    "answer_suggester": True,                 # practice-only prompter, one switch (D35)
    "telemetry_opt_in": False,                # opt-in only (D25); nothing leaves the machine today
    "obsidian_dir": "",                       # Markdown export off until a folder is set (D41)
    "layer_order": "content-first",           # content-first | delivery-first (D4)
    "level": "B1",                            # A2 | B1 | B2 | C1
    "strictness": 2,                          # 1 gentle .. 3 demanding
    "questions_per_session": 5,
    "name": "",                               # how Mike addresses the user (D80); "" = no name
    "disconnected": [],                       # local engines switched off with Disconnect (D84)
}
SECRET_PATHS = [("openai_compatible", "api_key"), ("gemini_live", "api_key")]
ENGINES = ("ollama", "openai_compatible", "claude_cli", "codex_cli", "antigravity_cli", "gemini_live")
# Engines found on this computer: Disconnect only switches them off in the app (the key engines forget the key).
LOCAL_ENGINES = ("ollama", "claude_cli", "codex_cli", "antigravity_cli")
LEVELS = ("A2", "B1", "B2", "C1")

_lock = threading.Lock()


def _settings_path() -> Path:
    return data_dir() / "settings.json"


def _merge(base: dict, extra: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in (extra or {}).items():
        if key in out and isinstance(out[key], dict) and isinstance(value, dict):
            out[key] = _merge(out[key], value)
        elif key in out:
            out[key] = value
    return out


def normalize_level(level: str | None) -> str:
    level = (level or "").strip().upper().rstrip("+")
    return level if level in LEVELS else "B1"


def _validate(settings: dict) -> dict:
    if settings.get("engine") not in ENGINES:
        settings["engine"] = "ollama"
    if settings.get("layer_order") not in ("content-first", "delivery-first"):
        settings["layer_order"] = "content-first"
    settings["level"] = normalize_level(settings.get("level"))
    try:
        settings["strictness"] = min(3, max(1, int(settings.get("strictness", 2))))
    except (TypeError, ValueError):
        settings["strictness"] = 2
    try:
        settings["questions_per_session"] = min(10, max(1, int(settings.get("questions_per_session", 5))))
    except (TypeError, ValueError):
        settings["questions_per_session"] = 5
    try:
        settings["kokoro_speed"] = min(1.5, max(0.6, float(settings.get("kokoro_speed", 1.0))))
    except (TypeError, ValueError):
        settings["kokoro_speed"] = 1.0
    settings["answer_suggester"] = bool(settings.get("answer_suggester"))
    settings["telemetry_opt_in"] = bool(settings.get("telemetry_opt_in"))
    # D80: one line, no control characters, at most 60 characters.
    settings["name"] = " ".join(str(settings.get("name") or "").split())[:60]
    for cli in ("claude_cli", "codex_cli", "antigravity_cli"):
        if settings[cli].get("verified") not in (True, False, None):
            settings[cli]["verified"] = None
    raw = settings.get("disconnected")
    settings["disconnected"] = sorted({e for e in raw if e in LOCAL_ENGINES}) if isinstance(raw, list) else []
    if settings.get("stt", {}).get("backend") not in ("auto", "mlx", "faster_whisper", "none"):
        settings["stt"]["backend"] = "auto"
    return settings


def load_settings() -> dict:
    path = _settings_path()
    stored: dict = {}
    if path.is_file():
        try:
            stored = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            stored = {}
    return _validate(_merge(DEFAULT_SETTINGS, stored))


def save_settings(settings: dict) -> dict:
    settings = _validate(_merge(DEFAULT_SETTINGS, settings))
    path = _settings_path()
    tmp = path.with_suffix(".tmp")
    payload = {"data_version": DATA_VERSION, **settings}
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    tmp.replace(path)
    return settings


def update_settings(patch: dict) -> dict:
    """Deep-merge a partial update. An empty-string API key in the patch clears the key;
    a missing key leaves it unchanged."""
    with _lock:
        current = load_settings()
        merged = _merge(current, patch or {})
        return save_settings(merged)


def public_settings(settings: dict | None = None) -> dict:
    """Settings safe to send to the browser: secrets replaced by `has_api_key`."""
    settings = copy.deepcopy(settings or load_settings())
    for section, key in SECRET_PATHS:
        block = settings.get(section, {})
        block["has_api_key"] = bool(block.pop(key, ""))
    return settings


def ollama_url(settings: dict | None = None) -> str:
    settings = settings or load_settings()
    url = (settings.get("ollama", {}).get("url") or os.getenv("OLLAMA_URL", "") or "http://127.0.0.1:11434")
    return url.strip().rstrip("/")


def kokoro_model_dir(settings: dict | None = None) -> Path:
    """Kokoro files: KOKORO_MODEL_DIR (dev override) or <data dir>/models/kokoro."""
    env = os.getenv("KOKORO_MODEL_DIR", "").strip()
    if env:
        return Path(env).expanduser()
    return data_dir() / "models" / "kokoro"


def ensure_meta() -> dict:
    """Write or check meta.json with the data_version marker (R9)."""
    path = data_dir() / "meta.json"
    meta: dict = {}
    if path.is_file():
        try:
            meta = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            meta = {}
    if not meta:
        import datetime
        meta = {"data_version": DATA_VERSION, "app_version": __version__,
                "created_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds")}
        path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    elif int(meta.get("data_version", 0)) > DATA_VERSION:
        raise RuntimeError("data_version_newer")  # refuse to write data from a newer app version
    return meta
