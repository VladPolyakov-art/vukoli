"""Engine adapter interface shared by every AI backend."""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from contextvars import ContextVar
from typing import AsyncIterator, Literal

from pydantic import BaseModel, Field

Msg = dict  # {"role": "system" | "user" | "assistant", "content": str}

StatusCode = Literal[
    "ready",
    "unverified",         # found, but Connect hasn't checked it with a real request yet (Claude Code, D85)
    "not_installed",      # binary / package missing
    "not_running",        # installed but the service does not answer
    "no_model",           # running, but the chosen model is not available
    "not_configured",     # needs a URL / key / model from the user
    "unreachable",        # configured URL does not answer
    "unauthorized",       # key rejected
    "billing_required",   # provider says the key's project needs billing / credits
    "disconnected",       # the user pressed Disconnect in the app (D84); Connect brings it back
    "error",
]


class EngineStatus(BaseModel):
    code: StatusCode
    ready: bool = False
    message: str = ""                       # short English sentence for logs and fallback display
    hint: str = ""                          # what the user can do next
    hint_command: str = ""                  # a command to copy, e.g. "ollama pull qwen3:8b"
    fix_url: str = ""
    model: str = ""                         # effective model id
    warnings: list[str] = Field(default_factory=list)


class EngineDescriptor(BaseModel):
    id: str
    name: str
    kind: Literal["text", "live"]           # text = LLM + local STT/TTS; live = voice-to-voice service
    local: bool                             # True when nothing leaves this computer
    cost: str
    data_line: str                          # where the user's words go (GR7)
    needs: list[str]                        # settings the user must provide
    terms_note: str = ""
    privacy_note: str = ""
    setup_url: str = ""


class EngineError(RuntimeError):
    """Error with a stable code the UI can map to copy."""

    def __init__(self, code: str, message: str = "", hint: str = ""):
        super().__init__(message or code)
        self.code = code
        self.message = message or code
        self.hint = hint


class LLMEngine(ABC):
    id: str = ""

    @abstractmethod
    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        """Yield text deltas."""
        yield ""  # pragma: no cover

    async def complete(self, messages: list[Msg], *, temperature: float = 0.2, max_tokens: int = 400,
                       json_schema: dict | None = None) -> str:
        parts = []
        async for delta in self.chat_stream(messages, temperature=temperature, max_tokens=max_tokens,
                                            json_schema=json_schema):
            parts.append(delta)
        return strip_think("".join(parts))

    async def complete_json(self, messages: list[Msg], schema: dict, *, temperature: float = 0.1,
                            max_tokens: int = 400, retries: int = 1) -> dict:
        """Schema-guided JSON call with one retry on unparseable output."""
        last: Exception | None = None
        for _ in range(retries + 1):
            raw = await self.complete(messages, temperature=temperature, max_tokens=max_tokens, json_schema=schema)
            try:
                data = json.loads(extract_json(raw))
                if isinstance(data, dict):
                    return data
                last = ValueError("not an object")
            except ValueError as exc:
                last = exc
        raise EngineError("invalid_json", f"Model returned invalid JSON: {last}")

    @abstractmethod
    async def status(self) -> EngineStatus: ...

    async def warm_up(self, messages: list[Msg]) -> None:
        return None

    @property
    def model(self) -> str:
        return ""

    @property
    def single_worker(self) -> bool:
        """True when one local model serves both the interviewer and the feedback calls,
        so feedback must wait until the interviewer finished speaking."""
        return False


# Set while a call runs in the background (feedback, suggestions): an engine keeps its fast path for Mike's reply (D87).
BACKGROUND: ContextVar[bool] = ContextVar("vukoli_background", default=False)

THINK_BLOCK = re.compile(r"^\s*<think>.*?(</think>\s*|$)", re.S)


def strip_think(text: str) -> str:
    """Drop a leading <think>...</think> block that reasoning models sometimes emit."""
    return THINK_BLOCK.sub("", text, count=1) if text.lstrip().startswith("<think>") else text


def extract_json(text: str) -> str:
    """The JSON object inside a reply (it may be wrapped in a code fence or prose)."""
    text = strip_think(text)
    start = text.find("{")
    end = text.rfind("}")
    return text[start:end + 1] if start >= 0 and end > start else "{}"


class ThinkFilter:
    """Streaming filter that removes a leading <think>...</think> block from deltas."""

    def __init__(self) -> None:
        self.buffer = ""
        self.state = "start"   # start | thinking | pass

    def feed(self, delta: str) -> str:
        if self.state == "pass":
            return delta
        self.buffer += delta
        if self.state == "start":
            stripped = self.buffer.lstrip()
            if not stripped:
                return ""
            if "<think>".startswith(stripped[:7]) and len(stripped) < 7:
                return ""  # could still become <think>
            if stripped.startswith("<think>"):
                self.state = "thinking"
            else:
                self.state = "pass"
                out, self.buffer = self.buffer, ""
                return out
        if self.state == "thinking":
            idx = self.buffer.find("</think>")
            if idx < 0:
                return ""
            out = self.buffer[idx + len("</think>"):].lstrip()
            self.buffer = ""
            self.state = "pass"
            return out
        return ""
