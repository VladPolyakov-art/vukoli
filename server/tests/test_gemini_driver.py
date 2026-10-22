"""Ported from the prototype's transcript and manual-turn tests (Gemini Live driver, mocked session)."""
from __future__ import annotations

from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

import pytest

from server.engines.base import EngineError
from server.engines.gemini_live import GeminiLiveDriver, drop_last_answer

types = pytest.importorskip("google.genai").types


def driver(**kwargs):
    return GeminiLiveDriver(api_key="test-key", model_name="m", voice_name="Puck", system_instruction="s", **kwargs)


async def test_fragments_are_one_turn_and_empty_model_is_not_invented():
    completed = []
    d = driver(on_turn_complete=lambda *args: completed.append(args))
    d._handle_user_delta("I work ")
    d._handle_user_delta("on interfaces.")
    d._handle_model_delta("Tell me ")
    d._handle_model_delta("more.")
    d._finalize_turn("model")
    d._finalize_turn("model")
    assert completed == [("user", "I work on interfaces."), ("model", "Tell me more.")]


async def test_failed_text_is_not_recorded_as_delivered():
    d = driver()
    d._running = True
    d._session_ready.set()
    d._session = NS(send_client_content=AsyncMock(side_effect=OSError()))
    with pytest.raises(EngineError):
        await d.handle_user_text_turn("Hello")
    assert d.transcript_history == []


async def test_coincident_input_and_model_audio_preserve_order():
    d = driver()
    d._running = True
    responses = [NS(server_content=NS(input_transcription=NS(text="Hello there."),
                                      model_turn=NS(parts=[NS(inline_data=NS(data=b"00"))]),
                                      output_transcription=NS(text="Hi!"), turn_complete=True))]

    class Session:
        async def receive(self):
            for response in responses:
                yield response
            d._running = False

    await d._receive_loop(Session())
    assert d.transcript_history == [{"role": "user", "text": "Hello there."}, {"role": "model", "text": "Hi!"}]


async def test_receive_failure_is_propagated():
    d = driver()
    d._running = True

    class Session:
        async def receive(self):
            raise OSError("disconnected")
            yield

    with pytest.raises(RuntimeError):
        await d._receive_loop(Session())


async def test_manual_activity_start_once_and_end_once():
    d = driver(manual_turns=True)
    d._running = True
    d._session = NS(send_realtime_input=AsyncMock())
    await d.begin_audio_turn()
    await d.begin_audio_turn()
    calls = d._session.send_realtime_input.call_args_list
    assert len(calls) == 1 and isinstance(calls[0].kwargs["activity_start"], types.ActivityStart)
    await d.end_audio_stream()
    await d.end_audio_stream()
    calls = d._session.send_realtime_input.call_args_list
    assert len(calls) == 2 and "activity_end" in calls[1].kwargs and "audio_stream_end" not in calls[1].kwargs


async def test_manual_config():
    config = driver(manual_turns=True)._build_config()
    assert config.realtime_input_config.automatic_activity_detection.disabled
    assert config.realtime_input_config.activity_handling == types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS


async def test_interim_is_replaced_not_committed_twice():
    previews = []
    d = driver(manual_turns=True, on_transcript_delta=lambda r, delta, t: previews.append((r, t)))
    d._running = True
    d._activity_open = True
    responses = [NS(server_content=NS(interim_input_transcription=NS(text=t))) for t in ["I went", "I went to the park"]]
    responses.append(NS(server_content=NS(input_transcription=NS(text="I went to the park.", finished=True))))

    class Session:
        async def receive(self):
            for item in responses:
                yield item
            d._running = False

    await d._receive_loop(Session())
    assert previews[-1] == ("user", "I went to the park.")
    assert d.transcript_history == []
    d.stop()
    assert d.transcript_history == [{"role": "user", "text": "I went to the park."}]


def test_redo_drops_last_answer_and_reopens_question():
    history = [{"role": "model", "text": "Q1?"}, {"role": "user", "text": "A1"}, {"role": "model", "text": "Q2?"},
               {"role": "user", "text": "A2"}, {"role": "model", "text": "Follow?"}]
    assert drop_last_answer(history) == "Q2?"
    assert history[-1] == {"role": "model", "text": "Q2?"}
    assert drop_last_answer([]) == ""
