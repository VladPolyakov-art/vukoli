"""Engine registry: descriptors, status and factories for the selected engine."""
from __future__ import annotations

from .. import config
from . import antigravity_cli, claude_cli, codex_cli, gemini_live, ollama, openai_compat
from .base import EngineDescriptor, EngineError, EngineStatus, LLMEngine

DESCRIPTORS: dict[str, EngineDescriptor] = {
    "ollama": ollama.DESCRIPTOR,
    "openai_compatible": openai_compat.DESCRIPTOR,
    "claude_cli": claude_cli.DESCRIPTOR,
    "codex_cli": codex_cli.DESCRIPTOR,
    "antigravity_cli": antigravity_cli.DESCRIPTOR,
    "gemini_live": gemini_live.DESCRIPTOR,
}


class DisconnectedEngine(LLMEngine):
    """D84: the user pressed Disconnect. Nothing is called until Connect."""

    def __init__(self, engine_id: str):
        self.id = engine_id

    async def status(self) -> EngineStatus:
        return EngineStatus(code="disconnected", message="Disconnected in Vukoli.",
                            hint="Press Connect in Settings → AI engine to use it again.")

    async def chat_stream(self, messages, *, temperature: float = 0.6, max_tokens: int = 300, json_schema=None):
        raise EngineError("disconnected", "This AI engine is disconnected.",
                          "Press Connect in Settings → AI engine to use it again.")
        yield ""  # pragma: no cover - makes this an async generator


def make_llm(settings: dict | None = None, engine_id: str | None = None, *, voice: bool = False) -> LLMEngine:
    """The text LLM for the chosen engine (for gemini_live: the Gemini text model used for feedback).
    voice=True: an Ollama voice session uses ollama.voice_model, by default the small fast model."""
    settings = settings or config.load_settings()
    engine_id = engine_id or settings["engine"]
    if engine_id in settings.get("disconnected", []):
        return DisconnectedEngine(engine_id)
    if engine_id == "ollama" and config.e2e_enabled():     # IC_E2E=1 only: the scripted engine takes the Ollama slot
        from . import scripted
        return scripted.ScriptedEngine()
    if engine_id == "ollama":
        block = settings["ollama"]
        if voice:
            return ollama.OllamaEngine(config.ollama_url(settings), block.get("voice_model", ""),
                                       default_model=ollama.VOICE_MODEL)
        return ollama.OllamaEngine(config.ollama_url(settings), block.get("model", ""))
    if engine_id == "openai_compatible":
        block = settings["openai_compatible"]
        return openai_compat.OpenAICompatibleEngine(block.get("base_url", ""), block.get("api_key", ""),
                                                    block.get("model", ""))
    if engine_id == "claude_cli":
        block = settings["claude_cli"]
        return claude_cli.ClaudeCLIEngine(block.get("model", "haiku"), verified=block.get("verified"))
    if engine_id == "codex_cli":
        block = settings["codex_cli"]
        return codex_cli.CodexCLIEngine(block.get("model", ""), verified=block.get("verified"))
    if engine_id == "antigravity_cli":
        block = settings["antigravity_cli"]
        return antigravity_cli.AntigravityCLIEngine(block.get("model", ""), verified=block.get("verified"))
    if engine_id == "gemini_live":
        block = settings["gemini_live"]
        return gemini_live.GeminiTextEngine(block.get("api_key", ""), block.get("text_model", ""),
                                            block.get("model", ""))
    raise EngineError("unknown_engine", f"Unknown engine {engine_id}")


async def engine_status(engine_id: str, settings: dict | None = None) -> EngineStatus:
    settings = settings or config.load_settings()
    try:
        return await make_llm(settings, engine_id).status()
    except EngineError as exc:
        return EngineStatus(code="error", message=exc.message, hint=exc.hint)


async def all_engines(settings: dict | None = None) -> list[dict]:
    import asyncio
    settings = settings or config.load_settings()
    statuses = await asyncio.gather(*(engine_status(eid, settings) for eid in DESCRIPTORS))
    return [{**DESCRIPTORS[eid].model_dump(), "status": status.model_dump(), "selected": eid == settings["engine"]}
            for eid, status in zip(DESCRIPTORS, statuses)]


__all__ = ["DESCRIPTORS", "DisconnectedEngine", "EngineDescriptor", "EngineError", "EngineStatus", "LLMEngine", "make_llm",
           "engine_status", "all_engines"]
