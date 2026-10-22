"""Speech-to-text on this computer.

Backends, in order of preference for `auto`:
- mlx-whisper on Apple Silicon (fast, Metal);
- faster-whisper everywhere else (CTranslate2, int8 on CPU).
Both are optional imports. With neither installed the app still works with typed answers or the
browser's own recogniser (the client sends text turns).
"""
from __future__ import annotations

import asyncio
import importlib.util
import logging
import platform
import sys
import threading
import re
import time
from dataclasses import dataclass, field

import numpy as np

log = logging.getLogger("uvicorn.error")
SAMPLE_RATE = 16000
MLX_DEFAULT = "mlx-community/whisper-large-v3-turbo"
LOW_CONFIDENCE = 0.5   # word probability below this is "possibly misheard" (GR9)


@dataclass
class Word:
    w: str
    start: float
    end: float
    p: float

    def public(self) -> dict:
        return {"w": self.w, "start": round(self.start, 2), "end": round(self.end, 2), "p": round(self.p, 3)}


@dataclass
class Transcript:
    text: str
    words: list[Word] = field(default_factory=list)
    duration_s: float = 0.0
    backend: str = ""
    # Two-pass recognition (latency): the reply starts from the text; word timings and confidence follow in
    # the background. `words_ready` is set when `words` is final (already set for a one-pass transcript).
    words_ready: asyncio.Event | None = field(default=None, repr=False, compare=False)

    def low_confidence(self) -> list[Word]:
        return [w for w in self.words if w.p < LOW_CONFIDENCE]

    async def wait_words(self, timeout: float = 30) -> None:
        if self.words_ready is not None and not self.words_ready.is_set():
            try:
                await asyncio.wait_for(self.words_ready.wait(), timeout)
            except asyncio.TimeoutError:
                pass


LOOP_MAX_WORDS = 6


def _loop_at(norm: list[str], i: int) -> tuple[int, int]:
    """Longest-covering run of one phrase (1..6 words) repeated from position i: (phrase length, repeats)."""
    best = (0, 0)
    for n in range(1, LOOP_MAX_WORDS + 1):
        phrase = norm[i:i + n]
        if len(phrase) < n:
            break
        count = 1
        while norm[i + count * n:i + (count + 1) * n] == phrase:
            count += 1
        if count >= (4 if n == 1 else 3) and n * count > best[0] * best[1]:
            best = (n, count)
    return best


def drop_loops(text: str) -> str:
    """Whisper on silence or room noise loops one short phrase ("I have a look. I have a look. ...", "Oh Oh Oh Oh").
    A run of such repeats collapses to one copy; a transcript that is mostly one loop is no speech at all."""
    words = text.split()
    if len(words) < 4:
        return text
    norm = [re.sub(r"[^\w']", "", w.lower()) for w in words]
    out, looped, i = [], 0, 0
    while i < len(words):
        n, count = _loop_at(norm, i)
        if n:
            out.extend(words[i:i + n])
            looped += n * count
            i += n * count
        else:
            out.append(words[i])
            i += 1
    if not looped:
        return text
    if looped >= 0.8 * len(words):
        return ""
    return " ".join(out)


def is_apple_silicon() -> bool:
    return sys.platform == "darwin" and platform.machine() == "arm64"


def available_backends() -> list[str]:
    found = []
    if is_apple_silicon() and importlib.util.find_spec("mlx_whisper") is not None:
        found.append("mlx")
    if importlib.util.find_spec("faster_whisper") is not None:
        found.append("faster_whisper")
    return found


def choose_backend(preference: str = "auto") -> str | None:
    found = available_backends()
    if preference == "none":
        return None
    if preference in found:
        return preference
    return found[0] if found else None


def default_model(backend: str) -> str:
    if backend == "mlx":
        return MLX_DEFAULT
    try:
        import psutil
        ram = psutil.virtual_memory().total / 1024 ** 3
    except Exception:  # pragma: no cover
        ram = 8
    return "small.en" if ram >= 8 else "base.en"


class STT:
    def __init__(self, backend: str | None, model: str = ""):
        self.backend = backend
        self.model_name = model or (default_model(backend) if backend else "")
        self._lock = threading.Lock()
        self._fw_model = None
        self._warm = False

    @property
    def available(self) -> bool:
        return self.backend is not None

    def info(self) -> dict:
        return {"available": self.available, "backend": self.backend or "none", "model": self.model_name,
                "installed_backends": available_backends(), "word_confidence": self.available}

    def _faster_whisper(self):
        if self._fw_model is None:
            from faster_whisper import WhisperModel
            self._fw_model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
        return self._fw_model

    def transcribe(self, pcm16k: bytes, words: bool = True) -> Transcript:
        """16 kHz mono int16 PCM -> English transcript, with per-word timestamps and probability when `words`.

        Word timing costs about 0.5 s more on Apple Silicon, so the interviewer reply starts from a text-only
        pass and the word pass runs in the background (see TextDriver.end_audio_stream)."""
        duration = len(pcm16k) / 2 / SAMPLE_RATE
        if not self.backend or duration < 0.5:
            return Transcript(text="", duration_s=duration, backend=self.backend or "none")
        audio = np.frombuffer(pcm16k, dtype=np.int16).astype(np.float32) / 32768.0
        started = time.perf_counter()
        words: list[Word] = []
        with self._lock:   # MLX and CTranslate2 models are not shared across threads here
            if self.backend == "mlx":
                import mlx_whisper
                result = mlx_whisper.transcribe(audio, path_or_hf_repo=self.model_name, language="en",
                                                condition_on_previous_text=False, word_timestamps=words,
                                                fp16=True, verbose=None)
                text = str(result.get("text", "")).strip()
                for seg in result.get("segments", []):
                    for item in seg.get("words", []) or []:
                        words.append(Word(str(item.get("word", "")).strip(), float(item.get("start", 0)),
                                          float(item.get("end", 0)), float(item.get("probability", 1))))
            else:
                segments, _info = self._faster_whisper().transcribe(
                    audio, language="en", word_timestamps=words, beam_size=1, condition_on_previous_text=False)
                parts = []
                for seg in segments:
                    parts.append(seg.text)
                    for item in seg.words or []:
                        words.append(Word(item.word.strip(), float(item.start), float(item.end),
                                          float(item.probability)))
                text = "".join(parts).strip()
        log.info("STT %s%s: %.1f s of audio in %.2f s", self.backend, "" if words else " (text)", duration,
                 time.perf_counter() - started)
        cleaned = drop_loops(text)
        if cleaned != text:
            log.info("STT dropped a repeated-phrase loop (%d -> %d words)", len(text.split()), len(cleaned.split()))
            text, words = cleaned, []
        return Transcript(text=text, words=words, duration_s=duration, backend=self.backend)

    def transcribe_if_idle(self, pcm16k: bytes) -> Transcript | None:
        """Live captions only: skip instead of queueing behind another transcription (the final one wins)."""
        if not self._lock.acquire(blocking=False):
            return None
        self._lock.release()
        return self.transcribe(pcm16k, words=False)

    def warm_up(self) -> None:
        """Load the model and run both passes once (the first call compiles kernels: about 3 s on Apple
        Silicon). Silence alone skips the word-timing code, so the warm-up audio is a quiet tone."""
        if not self.backend or self._warm:
            return
        try:
            t = np.arange(SAMPLE_RATE * 2) / SAMPLE_RATE
            tone = (0.2 * np.sin(2 * np.pi * 220 * t) * (1 + np.sin(2 * np.pi * 3 * t)) * 16000).astype(np.int16)
            self.transcribe(tone.tobytes(), words=False)
            self.transcribe(tone.tobytes(), words=True)
            self._warm = True
        except Exception as exc:  # model download problems surface on first real use
            log.warning("STT warm-up failed: %s", type(exc).__name__)


_instances: dict[tuple, STT] = {}
_instances_lock = threading.Lock()


def get_stt(settings: dict) -> STT:
    block = settings.get("stt", {})
    backend = choose_backend(block.get("backend", "auto"))
    key = (backend, block.get("model", ""))
    with _instances_lock:
        if key not in _instances:
            _instances[key] = STT(backend, block.get("model", ""))
        return _instances[key]
