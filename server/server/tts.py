"""Text-to-speech with Kokoro (local, ONNX). Without the model files the app runs in text-only mode."""
from __future__ import annotations

import io
import os
import re
import shutil
import sys
import tempfile
import threading
import wave
from pathlib import Path

from . import config

SAMPLE_RATE = 24000
CHUNK_BYTES = 9600            # 0.2 s of 24 kHz int16 mono per WebSocket frame
MODEL_FILE = "kokoro-v1.0.onnx"
VOICES_FILE = "voices-v1.0.bin"
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases"
DEFAULT_VOICE = "am_michael"  # the interviewer is Mike

VOICES = {
    "am_michael": "Michael · US, male",
    "am_adam": "Adam · US, male",
    "am_eric": "Eric · US, male",
    "am_liam": "Liam · US, male",
    "am_onyx": "Onyx · US, male",
    "am_puck": "Puck · US, male",
    "bm_george": "George · UK, male",
    "bm_daniel": "Daniel · UK, male",
    "bm_lewis": "Lewis · UK, male",
    "bm_fable": "Fable · UK, male",
    "af_heart": "Heart · US, female",
    "af_bella": "Bella · US, female",
    "af_nicole": "Nicole · US, female",
    "af_sky": "Sky · US, female",
    "bf_emma": "Emma · UK, female",
    "bf_isabella": "Isabella · UK, female",
    "bf_alice": "Alice · UK, female",
    "bf_lily": "Lily · UK, female",
}
# espeak-ng keeps the data folder in a fixed buffer (about 160 characters, 230 on Windows). A longer path makes it fall
# back to a path that does not exist and exit the whole process, so a deeper folder is copied to a short one first.
ESPEAK_PATH_LIMIT = 220 if sys.platform == "win32" else 150
ESPEAK_DATA_NAME = "espeak-ng-data"
SENTENCE_END = re.compile(r"(.+?[.!?…])\s+", re.S)

_kokoro = None
_kokoro_dir: Path | None = None
_lock = threading.Lock()
# Short fixed lines ("Okay.", "Take your time.") are synthesised once per voice: they often open a reply,
# so a cached copy makes Mike's first audio instant.
CACHE_MAX_WORDS = 4
_cache: dict[tuple, bytes] = {}
COMMON_LINES = ("Okay.", "I see.", "Thank you.", "Understood.", "Take your time.", "Sure, go ahead.")


def model_files(settings: dict | None = None) -> tuple[Path, Path]:
    folder = config.kokoro_model_dir(settings)
    return folder / MODEL_FILE, folder / VOICES_FILE


def espeak_data_path() -> tuple[str | None, bool]:
    """(folder for EspeakConfig, usable). The folder is None when espeakng_loader's own path is short enough.
    (None, False) when it is too long and no short place for a copy works: Kokoro must not start then."""
    from espeakng_loader import get_data_path
    source = Path(get_data_path())
    if len(str(source)) <= ESPEAK_PATH_LIMIT:
        return None, True
    candidates = []
    try:
        candidates.append(config.data_dir() / ESPEAK_DATA_NAME)
    except OSError:
        pass
    candidates.append(Path(tempfile.gettempdir()) / f"vukoli-{ESPEAK_DATA_NAME}")
    for target in candidates:
        if len(str(target)) > ESPEAK_PATH_LIMIT:
            continue
        try:
            if not (target / "phontab").exists():      # missing or a broken copy: copy again
                temp = target.with_name(f"{target.name}.tmp-{os.getpid()}")
                shutil.rmtree(temp, ignore_errors=True)
                shutil.copytree(source, temp)          # copy under another name, so a half copy is never used
                shutil.rmtree(target, ignore_errors=True)
                os.replace(temp, target)
            if (target / "phontab").exists():
                return str(target), True
        except OSError:
            continue
    return None, False


def kokoro_model(settings: dict | None = None):
    """Load Kokoro once; None if the package or model files are missing."""
    global _kokoro, _kokoro_dir
    model, voices = model_files(settings)
    with _lock:
        if _kokoro is not None and _kokoro_dir == model.parent:
            return _kokoro
        if not (model.exists() and voices.exists()):
            return None
        try:
            from kokoro_onnx import EspeakConfig, Kokoro
            folder, usable = espeak_data_path()
        except ImportError:
            return None
        if not usable:
            return None
        _kokoro = Kokoro(str(model), str(voices), espeak_config=EspeakConfig(data_path=folder) if folder else None)
        _kokoro_dir = model.parent
        _cache.clear()
        try:   # the first synthesis initialises the ONNX session (about 2 s); do it now, not in Mike's first line
            _kokoro.create("Okay.", voice=DEFAULT_VOICE, speed=1.0, lang="en-us")
        except Exception:  # pragma: no cover - a broken model shows up on first real use
            pass
        return _kokoro


def status(settings: dict | None = None) -> dict:
    model, voices = model_files(settings)
    files = model.exists() and voices.exists()
    try:
        import kokoro_onnx  # noqa: F401
        package = True
    except ImportError:
        package = False
    espeak_ok = True
    if files and package:
        try:
            espeak_ok = espeak_data_path()[1]
        except ImportError:
            espeak_ok = False
    hint = ""
    if not files:
        hint = f"Download {MODEL_FILE} and {VOICES_FILE} from {MODEL_URL} into {model.parent}"
    elif not espeak_ok:
        hint = ("The speech data folder path is too long for espeak-ng and no short copy could be made. "
                "Install Vukoli in a shorter folder or free some space, then restart.")
    return {"available": files and package and espeak_ok, "engine": "kokoro", "package_installed": package,
            "model_found": files, "model_dir": str(model.parent), "hint": hint}


def resolve_voice(voice: str) -> str:
    return voice if voice in VOICES else DEFAULT_VOICE


def list_voices() -> list[dict]:
    return [{"id": vid, "label": label, "locale": "en-GB" if vid.startswith("b") else "en-US",
             "gender": "male" if vid[1] == "m" else "female"} for vid, label in VOICES.items()]


def synthesize_pcm(text: str, voice: str = "", speed: float = 1.0, settings: dict | None = None) -> bytes:
    """24 kHz mono int16 PCM. Empty bytes when Kokoro is not available."""
    import numpy as np
    model = kokoro_model(settings)
    if model is None or not text.strip():
        return b""
    voice = resolve_voice(voice)
    key = (text.strip(), voice, round(speed, 2))
    if key in _cache:
        return _cache[key]
    with _lock:
        samples, _rate = model.create(text, voice=voice, speed=speed,
                                      lang="en-gb" if voice.startswith("b") else "en-us")
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    if len(text.split()) <= CACHE_MAX_WORDS and len(_cache) < 256:
        _cache[key] = pcm
    return pcm


def preload(settings: dict | None = None, voice: str = "", speed: float = 1.0) -> bool:
    """Load Kokoro and cache the common short lines for this voice. False when speech is not available."""
    if kokoro_model(settings) is None:
        return False
    for line in COMMON_LINES:
        synthesize_pcm(line, voice, speed, settings)
    return True


def synthesize_wav(text: str, voice: str = "", speed: float = 1.0, settings: dict | None = None) -> bytes:
    pcm = synthesize_pcm(text, voice, speed, settings)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(pcm)
    return buffer.getvalue()
