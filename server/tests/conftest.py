"""Shared fixtures. Tests never touch the network, the microphone, real keys or the user's data folder."""
from __future__ import annotations

import json
from typing import AsyncIterator

import pytest

from server.engines.base import EngineStatus, LLMEngine


@pytest.fixture(autouse=True)
def isolated_data(tmp_path, monkeypatch):
    monkeypatch.setenv("IC_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("KOKORO_MODEL_DIR", str(tmp_path / "no-kokoro"))   # text-only in tests
    monkeypatch.delenv("OLLAMA_URL", raising=False)
    monkeypatch.setenv("IC_PRELOAD", "0")                                  # no Whisper/Kokoro loading in tests
    from server import tts
    from server.engines import antigravity_cli, claude_cli, codex_cli
    monkeypatch.setattr(tts, "_kokoro", None)
    # Never the real `claude` binary: Connect sends a real request on the user's plan (D85).
    monkeypatch.setattr(claude_cli, "find_claude", lambda: None)
    monkeypatch.setattr(codex_cli, "find_codex", lambda: None)            # nor `codex` (D86)
    monkeypatch.setattr(antigravity_cli, "find_agy", lambda: None)        # nor `agy` (D87)
    monkeypatch.setattr(antigravity_cli, "history_dir", lambda: tmp_path / "agy-history")
    monkeypatch.setattr(antigravity_cli, "_signed_in_cache", {})
    yield tmp_path / "data"
    for run in list(antigravity_cli._spares.values()):                   # no spare `agy` outlives its test
        run.discard()
    antigravity_cli._spares.clear()
    antigravity_cli._wanted.clear()
    antigravity_cli._filling.clear()


class FakeLLM(LLMEngine):
    """Scripted engine: picks a reply by the JSON schema (or plain text) and streams it in small pieces."""

    id = "fake"

    def __init__(self, replies: dict | None = None, single_worker: bool = False, chunk: int = 7):
        self.replies = replies or {}
        self.calls: list[dict] = []
        self._single = single_worker
        self.chunk = chunk
        self.warmed = 0

    @property
    def model(self) -> str:
        return "fake-model"

    @property
    def single_worker(self) -> bool:
        return self._single

    async def status(self) -> EngineStatus:
        return EngineStatus(code="ready", ready=True, model="fake-model")

    async def warm_up(self, messages) -> None:
        self.warmed += 1

    def _key(self, schema: dict | None) -> str:
        if schema is None:
            return "text"
        props = set(schema.get("properties", {}))
        for key, marker in (("p1", "say"), ("p2b", "items"), ("p5b", "corrections"), ("p3", "verdict"),
                            ("p2c", "rewrite"), ("suggester", "story"), ("p0", "questions")):
            if marker in props:
                return key
        if "voice" in props or "relevant" in props:
            return "p2a"
        return "unknown"

    async def chat_stream(self, messages, *, temperature=0.6, max_tokens=300, json_schema=None) -> AsyncIterator[str]:
        key = self._key(json_schema)
        self.calls.append({"key": key, "messages": messages})
        from server import usage
        usage.count(self.id)                                   # like every real engine (D88)
        reply = self.replies.get(key, "")
        if callable(reply):
            reply = reply(messages)
        if isinstance(reply, Exception):
            raise reply
        text = reply if isinstance(reply, str) else json.dumps(reply)
        for i in range(0, len(text), self.chunk):
            yield text[i:i + self.chunk]


@pytest.fixture
def fake_llm():
    return FakeLLM
