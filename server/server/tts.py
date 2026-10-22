"""Text-to-speech with Kokoro (local, ONNX). Without the model files the app runs in text-only mode."""
from __future__ import annotations

import io
import re
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
            from kokoro_onnx import Kokoro
        except ImportError:
            return None
        _kokoro = Kokoro(str(model), str(voices))
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
    return {"available": files and package, "engine": "kokoro", "package_installed": package,
            "model_found": files, "model_dir": str(model.parent),
            "hint": "" if files else f"Download {MODEL_FILE} and {VOICES_FILE} from {MODEL_URL} into {model.parent}"}


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
