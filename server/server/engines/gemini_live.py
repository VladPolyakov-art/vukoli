"""Gemini Live adapter: voice-to-voice interviewer with the user's own Google AI Studio key.

Two parts:
- GeminiLiveDriver: the live audio session (16 kHz PCM in, 24 kHz PCM out, transcripts both ways).
- GeminiTextEngine: an LLMEngine on a Gemini text model for feedback, debrief and suggestions.
`google-genai` is an optional dependency; without it the engine reports `not_installed`.
"""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator, AsyncIterator, Callable, Dict, List, Optional

from .. import usage
from .base import EngineDescriptor, EngineError, EngineStatus, LLMEngine, Msg

KEY_URL = "https://aistudio.google.com/apikey"
PRIVACY_NOTE = ("Free tier available with your own Google AI Studio key (limits apply). On the free tier, "
                "Google may use your audio and text to improve its products.")
DESCRIPTOR = EngineDescriptor(
    id="gemini_live",
    name="Gemini Live (your Google AI Studio key)",
    kind="live",
    local=False,
    cost="Free tier with your own key; limits apply. Paid if your Google project has billing enabled.",
    data_line="Your voice is sent to Google to run the interview in real time.",
    needs=["Google AI Studio API key"],
    privacy_note=PRIVACY_NOTE,
    setup_url=KEY_URL,
)
VOICES = ["Puck", "Charon", "Fenrir", "Orus", "Aoede", "Kore", "Leda", "Zephyr"]
INPUT_RATE = 16000


def genai_available() -> bool:
    try:
        import google.genai  # noqa: F401
        return True
    except ImportError:
        return False


def classify_error(exc: BaseException) -> EngineError:
    """Map Gemini API errors to stable codes."""
    text = str(exc)
    low = text.lower()
    if "prepayment" in low or "credits are depleted" in low or "billing" in low:
        return EngineError("billing_required", "This key's Google project needs billing or credits.",
                           "This key's Google project has billing enabled and no credits; create a key in a "
                           "project without billing to use the free tier.")
    if "api key not valid" in low or "permission_denied" in low or "unauthenticated" in low or " 401" in low \
            or " 403" in low:
        return EngineError("unauthorized", "Google rejected the API key.", f"Create a key at {KEY_URL}.")
    if "resource_exhausted" in low or "429" in low or "quota" in low:
        return EngineError("rate_limited", "The free-tier limit was reached.", "Wait a little and try again.")
    if "not found" in low and "model" in low:
        return EngineError("model_missing", "The Gemini model is not available for this key.")
    return EngineError("engine_error", f"Gemini error: {text[:200]}")


def status_from_error(err: EngineError, model: str = "") -> EngineStatus:
    code = err.code if err.code in ("billing_required", "unauthorized") else "error"
    return EngineStatus(code=code, message=err.message, hint=err.hint, fix_url=KEY_URL, model=model,
                        warnings=[PRIVACY_NOTE])


def basic_status(api_key: str, model: str) -> EngineStatus:
    if not genai_available():
        return EngineStatus(code="not_installed", message="The google-genai package is not installed.",
                            hint="Run: pip install google-genai", hint_command="pip install google-genai")
    if not api_key:
        return EngineStatus(code="not_configured", message="Add your Google AI Studio API key.",
                            hint=f"Create a free key at {KEY_URL}.", fix_url=KEY_URL, warnings=[PRIVACY_NOTE])
    return EngineStatus(code="ready", ready=True, message="Gemini key saved.", model=model, warnings=[PRIVACY_NOTE])


class GeminiTextEngine(LLMEngine):
    id = "gemini_live"

    def __init__(self, api_key: str, model: str = "gemini-3.5-flash-lite", live_model: str = "gemini-3.8-live"):
        self._api_key = api_key
        self._model = model
        self.live_model = live_model

    def __repr__(self) -> str:
        return f"GeminiTextEngine(model={self._model!r})"

    @property
    def model(self) -> str:
        return self._model

    async def status(self) -> EngineStatus:
        return basic_status(self._api_key, self.live_model)

    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        if not genai_available():
            raise EngineError("not_installed", "The google-genai package is not installed.")
        from google import genai
        from google.genai import types
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        contents = [types.Content(role="model" if m["role"] == "assistant" else "user",
                                  parts=[types.Part.from_text(text=m["content"])])
                    for m in messages if m["role"] != "system"]
        cfg = types.GenerateContentConfig(
            system_instruction=system or None, temperature=temperature, max_output_tokens=max_tokens,
            response_mime_type="application/json" if json_schema is not None else None,
            response_json_schema=json_schema,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
        client = genai.Client(api_key=self._api_key, http_options=types.HttpOptions(timeout=30000))
        usage.count(self.id)
        try:
            response = await client.aio.models.generate_content(model=self._model, contents=contents, config=cfg)
        except Exception as exc:
            raise classify_error(exc) from exc
        finally:
            await client.aio.aclose()
        yield response.text or ""

    async def test(self) -> EngineStatus:
        """Real request with the key (one tiny text call)."""
        base = basic_status(self._api_key, self.live_model)
        if not base.ready:
            return base
        try:
            await self.complete([{"role": "user", "content": "Reply with OK."}], max_tokens=5)
        except EngineError as exc:
            return status_from_error(exc, self.live_model)
        return base


def drop_last_answer(history: list) -> str:
    """Remove the candidate's last answer and everything after it. Returns the question that is open again."""
    last_user = max((i for i, turn in enumerate(history) if turn["role"] == "user"), default=-1)
    if last_user < 0:
        return ""
    del history[last_user:]
    return next((turn["text"] for turn in reversed(history) if turn["role"] != "user"), "")


class GeminiLiveDriver:
    """Live session driver with the same interface as the local TextDriver."""

    produces_audio = True
    needs_server_stt = False

    def __init__(
        self,
        api_key: str,
        model_name: str,
        voice_name: str,
        system_instruction: str,
        on_audio_chunk: Optional[Callable[[bytes], None]] = None,
        on_turn_start: Optional[Callable[[str], None]] = None,
        on_transcript_delta: Optional[Callable[[str, str, str], None]] = None,
        on_turn_complete: Optional[Callable[[str, str], None]] = None,
        on_interrupted: Optional[Callable[[], None]] = None,
        on_ready: Optional[Callable[[], None]] = None,
        on_response_complete: Optional[Callable[[], None]] = None,
        manual_turns: bool = True,
        **_ignored,
    ) -> None:
        self.api_key = api_key
        self.model_name = model_name
        self.voice_name = voice_name if voice_name in VOICES else "Puck"
        self.system_instruction = system_instruction
        self.on_audio_chunk = on_audio_chunk
        self.on_turn_start = on_turn_start
        self.on_transcript_delta = on_transcript_delta
        self.on_turn_complete = on_turn_complete
        self.on_interrupted = on_interrupted
        self.on_ready = on_ready
        self.on_response_complete = on_response_complete
        self.manual_turns = manual_turns
        self._activity_open = False
        self._user_interim = ""
        self.transcript_history: List[Dict[str, str]] = []
        self._current_speaker: Optional[str] = None
        self._current_user_text = ""
        self._current_model_text = ""
        self._running = False
        self._session = None
        self._session_ready = asyncio.Event()
        self._send_lock = asyncio.Lock()
        self._model_speaking = False

    def replying(self) -> bool:
        return self._model_speaking

    def _build_config(self):
        from google.genai import types
        return types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice_name))),
            system_instruction=types.Content(parts=[types.Part.from_text(text=self.system_instruction)]),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    disabled=self.manual_turns,
                    silence_duration_ms=None if self.manual_turns else 800,
                    prefix_padding_ms=None if self.manual_turns else 40),
                activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS),
        )

    async def handle_user_text_turn(self, text: str) -> None:
        """Send a typed (or browser-recognised) turn. Recorded only after the send succeeds."""
        from google.genai import types
        if not text or not text.strip():
            return
        clean = text.strip()
        try:
            await asyncio.wait_for(self._session_ready.wait(), timeout=12.0)
        except asyncio.TimeoutError:
            raise EngineError("engine_timeout", "Gemini Live connection timed out")
        if self._session and self._running:
            try:
                async with self._send_lock:
                    await self._session.send_client_content(
                        turns=[types.Content(role="user", parts=[types.Part.from_text(text=clean)])],
                        turn_complete=True)
            except Exception as exc:
                raise EngineError("engine_error", "Could not send your message to Gemini") from exc
            self._current_user_text = clean
            self._finalize_turn("user")

    async def redo_answer(self) -> str:
        """The live session cannot be rewound, so the model is told to ignore the last answer."""
        from google.genai import types
        question = drop_last_answer(self.transcript_history)
        if question and self._session and self._running:
            async with self._send_lock:
                await self._session.send_client_content(turns=[types.Content(role="user", parts=[
                    types.Part.from_text(text=(
                        "(Control message, not part of the conversation: the candidate wants to answer your last "
                        "question again. Ignore the previous answer completely and never refer to it. "
                        "Say only a very short 'Sure, go ahead.' and wait.)"))])], turn_complete=True)
        return question

    async def begin_audio_turn(self) -> None:
        """Open a manual turn; this interrupts the model's speech."""
        from google.genai import types
        if self._session and self._running and not self._activity_open:
            async with self._send_lock:
                await self._session.send_realtime_input(activity_start=types.ActivityStart())
            self._activity_open = True

    async def end_audio_stream(self) -> None:
        from google.genai import types
        if self._session and self._running:
            async with self._send_lock:
                if self.manual_turns:
                    if not self._activity_open:
                        return
                    await self._session.send_realtime_input(activity_end=types.ActivityEnd())
                    self._activity_open = False
                else:
                    await self._session.send_realtime_input(audio_stream_end=True)

    async def run(self, audio_input_stream: AsyncGenerator[bytes, None]) -> None:
        from google import genai
        self._running = True
        client = genai.Client(api_key=self.api_key)
        try:
            cfg = self._build_config()
            try:
                async with client.aio.live.connect(model=self.model_name, config=cfg) as session:
                    self._session = session
                    self._session_ready.set()
                    if self.on_ready:
                        self.on_ready()
                    # Ask Mike to open the interview.
                    await self.handle_opening()
                    send_task = asyncio.create_task(self._send_loop(session, audio_input_stream))
                    receive_task = asyncio.create_task(self._receive_loop(session))
                    try:
                        done, _ = await asyncio.wait([send_task, receive_task], return_when=asyncio.FIRST_COMPLETED)
                        for task in done:
                            task.result()
                    finally:
                        send_task.cancel()
                        receive_task.cancel()
                        await asyncio.gather(send_task, receive_task, return_exceptions=True)
            except EngineError:
                raise
            except Exception as exc:
                raise classify_error(exc) from exc
        finally:
            self._session = None
            self._session_ready.clear()
            self._running = False
            await client.aio.aclose()

    async def handle_opening(self) -> None:
        from google.genai import types
        if self._session:
            async with self._send_lock:
                await self._session.send_client_content(turns=[types.Content(role="user", parts=[
                    types.Part.from_text(text="(The call has just started. Say your opening line now.)")])],
                    turn_complete=True)

    async def _send_loop(self, session, audio_stream: AsyncGenerator[bytes, None]) -> None:
        from google.genai import types
        try:
            async for chunk in audio_stream:
                if not self._running:
                    break
                if chunk:
                    async with self._send_lock:
                        await session.send_realtime_input(
                            audio=types.Blob(data=chunk, mime_type=f"audio/pcm;rate={INPUT_RATE}"))
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            if self._running:
                raise EngineError("engine_error", "Microphone stream failed") from exc

    async def _receive_loop(self, session) -> None:
        while self._running:
            try:
                received = False
                async for response in session.receive():
                    received = True
                    if not self._running:
                        break
                    content = getattr(response, "server_content", None)
                    if content is None:
                        continue
                    if getattr(content, "interrupted", False):
                        self._finalize_turn("model")
                        self._model_speaking = False
                        if self.on_interrupted:
                            self.on_interrupted()
                    interim = getattr(content, "interim_input_transcription", None)
                    if interim and getattr(interim, "text", None):
                        self._user_interim = interim.text
                        if self.on_transcript_delta:
                            self.on_transcript_delta("user", "", self._current_user_text + self._user_interim)
                    in_trans = getattr(content, "input_transcription", None)
                    if in_trans and getattr(in_trans, "text", None):
                        self._handle_user_delta(in_trans.text)
                        self._user_interim = ""
                    if in_trans and getattr(in_trans, "finished", False) and not self._activity_open:
                        self._finalize_turn("user")
                    model_turn = getattr(content, "model_turn", None)
                    if model_turn and getattr(model_turn, "parts", None):
                        if self._current_speaker != "model":
                            if self._current_user_text.strip() and not self._activity_open:
                                self._finalize_turn("user")
                            self._current_speaker = "model"
                            self._model_speaking = True
                            if self.on_turn_start:
                                self.on_turn_start("model")
                        for part in model_turn.parts:
                            inline = getattr(part, "inline_data", None)
                            if inline and getattr(inline, "data", None) and self.on_audio_chunk:
                                self.on_audio_chunk(inline.data)
                    out_trans = getattr(content, "output_transcription", None)
                    if out_trans and getattr(out_trans, "text", None):
                        self._handle_model_delta(out_trans.text)
                    if getattr(content, "turn_complete", False):
                        if not self._activity_open:
                            self._finalize_turn("user")
                        if self._current_speaker == "model" or self._current_model_text.strip():
                            self._finalize_turn("model")
                        elif self._current_speaker == "user" or self._current_user_text.strip():
                            self._finalize_turn("user")
                        self._model_speaking = False
                        if self.on_response_complete:
                            self.on_response_complete()
                if not received and self._running:
                    raise EngineError("engine_error", "Gemini Live stream closed")
            except asyncio.CancelledError:
                break
            except EngineError:
                raise
            except Exception as exc:
                if self._running:
                    raise classify_error(exc) from exc

    def _handle_user_delta(self, delta: str) -> None:
        if self._current_speaker != "user":
            self._current_speaker = "user"
            if self.on_turn_start:
                self.on_turn_start("user")
        self._current_user_text += delta
        if self.on_transcript_delta:
            self.on_transcript_delta("user", delta, self._current_user_text)

    def _handle_model_delta(self, delta: str) -> None:
        if self._current_speaker != "model":
            if self._current_user_text.strip() and not self._activity_open:
                self._finalize_turn("user")
            self._current_speaker = "model"
            if self.on_turn_start:
                self.on_turn_start("model")
        self._current_model_text += delta
        if self.on_transcript_delta:
            self.on_transcript_delta("model", delta, self._current_model_text)

    def _finalize_turn(self, speaker: str) -> None:
        if speaker == "user" and self._current_user_text.strip():
            text = self._current_user_text.strip()
            self.transcript_history.append({"role": "user", "text": text})
            if self.on_turn_complete:
                self.on_turn_complete("user", text)
            self._current_user_text = ""
            if self._current_speaker == "user":
                self._current_speaker = None
        elif speaker == "model":
            text = self._current_model_text.strip()
            if text:
                self.transcript_history.append({"role": "model", "text": text})
                if self.on_turn_complete:
                    self.on_turn_complete("model", text)
            self._current_model_text = ""
            self._current_speaker = None

    def stop(self) -> None:
        self._running = False
        if self._user_interim:
            self._current_user_text += self._user_interim
            self._user_interim = ""
        self._finalize_turn("user")
        self._finalize_turn("model")

