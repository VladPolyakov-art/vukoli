"""Session WebSocket: origin check, start validation, text turn flow, feedback once, save and debrief."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from server import storage, stt as stt_module, ws
from server.engines.base import EngineStatus

ANSWER = "Last year we has redesigned the onboarding and I led the research with twelve users."


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def receive_until(socket, kind, limit=80):
    seen = []
    for _ in range(limit):
        message = socket.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return message, seen
    raise AssertionError(f"{kind} not received; got {[m['type'] for m in seen]}")


def test_cross_origin_socket_is_rejected(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/session", headers={"origin": "https://unrelated.example"}) as s:
            s.receive_json()


def test_dev_origin_is_allowed():
    assert ws.origin_allowed("http://localhost:5173", "127.0.0.1:8000")
    assert ws.origin_allowed("http://127.0.0.1:8000", "127.0.0.1:8000")
    assert not ws.origin_allowed("https://evil.example", "127.0.0.1:8000")


def test_bad_start_and_engine_not_ready_report_errors_without_saving(client, monkeypatch):
    with client.websocket_connect("/ws/voice") as s:
        s.send_json({"type": "user_turn", "text": "hi"})
        assert s.receive_json()["code"] == "bad_start"

    async def not_ready(settings, engine_id, voice=False):
        return EngineStatus(code="not_running", message="Ollama is installed but not running.",
                            hint="Open the Ollama app, or run: ollama serve", hint_command="ollama serve")
    monkeypatch.setattr(ws, "check_engine", not_ready)
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text"})
        message = s.receive_json()
        assert message["type"] == "error" and message["code"] == "not_running"
        assert message["hint_command"] == "ollama serve"
    assert storage.list_records("sessions") == []


def test_text_turn_feedback_once_save_and_debrief(client, monkeypatch, fake_llm):
    llm = fake_llm({
        "p1": {"gap": "result", "action": "follow_up", "say": "What was the result?"},
        "p2b": {"items": [{"original": "we has redesigned", "better": ["we redesigned"], "reason": "Past tense.",
                           "level": "B1", "class": "N"}]},
        "p2a": {"situation": True, "task": True, "action": True, "result": False, "voice": "mixed",
                "result_type": "none", "relevant": True, "reflection": False, "evidence": "", "praise": ""},
        "suggester": {"story": "Onboarding", "answer": "I ran twelve interviews.", "points": ["research"]},
    })

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    with client.websocket_connect("/ws/session", headers={"origin": "http://testserver"}) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3, "suggest": True})
        started = s.receive_json()
        assert started["type"] == "session_started" and len(started["questions"]) == 3
        assert started["speaks"] is False                     # no Kokoro model in tests: text-only mode
        opening, _ = receive_until(s, "turn_complete")
        assert opening["speaker"] == "model" and opening["full_text"].startswith("Hi, I'm Mike.")
        s.send_json({"type": "user_turn", "text": ANSWER, "turn_id": 1})
        user, _ = receive_until(s, "turn_complete")
        assert user["speaker"] == "user" and user["turn_id"] == 1
        follow_up, during = receive_until(s, "turn_complete")
        assert follow_up["full_text"] == "What was the result?" and follow_up["kind"] == "follow_up"
        suggestion, more = receive_until(s, "suggestion")             # an explicit user request: still works mid-call
        assert suggestion["story"] == "Onboarding"
        # D96: not one feedback event and not one feedback model call while the call is on.
        assert not [m for m in during + more if m["type"].startswith("feedback")]
        assert [c["key"] for c in llm.calls if c["key"] in ("p2a", "p2b", "p2c", "p5b")] == []
        s.send_json({"type": "end_session"})
        saved, rest = receive_until(s, "session_saved")
        debrief, after = receive_until(s, "debrief")
        assert [m["type"] for m in rest] == ["saving", "session_saved"]
        types = [m["type"] for m in after]
        assert after[0] == {"type": "feedback_progress", "done": 0, "total": 1}
        assert types.index("feedback_progress") < types.index("debrief_pending") < types.index("debrief")
        assert [m for m in after if m["type"] == "feedback_progress"][-1]["done"] == 1
        final = [m["feedback"] for m in rest + after if m["type"] == "feedback" and m["feedback"]["complete"]][-1]
        assert final["layers"]["language"]["items"][0]["original"] == "we has redesigned"
        assert final["layers"]["content"]["tag"] == "no_result"
        assert final["layers"]["delivery"]["metrics"]["mode"] == "text"
        assert debrief["debrief"]["too_short"] is True
    p2_calls = [c for c in llm.calls if c["key"] in ("p2b", "p2a")]
    assert len(p2_calls) == 2                                  # feedback ran once per layer, after the call
    record = storage.read_record("sessions", saved["session_id"])
    assert record["transcript"][1]["text"] == ANSWER and len(record["feedback"]) == 1
    assert record["feedback"][0]["complete"] is True
    assert record["feedback"][0]["layers"]["language"]["items"][0]["status"] == "active"
    assert record["debrief"]["too_short"] is True and "post_call" not in record
    assert record["usage"] == {"engine": "ollama", "requests": len(llm.calls)}    # D88: every call of the session


def test_redo_answer_removes_feedback(client, monkeypatch, fake_llm):
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."},
                    "p2b": {"items": []},
                    "p2a": {"situation": True, "task": True, "action": True, "result": True, "voice": "i",
                            "result_type": "number", "relevant": True, "reflection": False, "evidence": "",
                            "praise": ""}})

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 2})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": ANSWER})
        receive_until(s, "turn_complete")
        s.send_json({"type": "redo_answer"})
        reset, _ = receive_until(s, "answer_reset")
        assert len(reset["removed_feedback_ids"]) == 1          # the answer's record leaves the after-call queue
        s.send_json({"type": "end_session"})
        receive_until(s, "session_ended")
    assert storage.list_records("sessions") == []              # no answers left: nothing saved
    assert llm.calls and not [c for c in llm.calls if c["key"] in ("p2a", "p2b")]     # and no feedback was made


def test_text_session_switches_to_voice(client, monkeypatch, fake_llm):
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."}})
    attached = []

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    monkeypatch.setattr(ws.TextDriver, "enable_stt", lambda self, recogniser: attached.append(recogniser))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 2})
        receive_until(s, "turn_complete")
        s.send_json({"type": "input_mode", "input": "voice"})
        s.send_json({"type": "ping", "t": 1})
        receive_until(s, "pong")                               # the switch was accepted, the session goes on
        s.send_json({"type": "end_session"})
        receive_until(s, "session_ended")
    assert len(attached) == 1


def test_drill_flag_is_read_for_interview_only():
    from server import ws
    settings = {"engine": "ollama", "questions_per_session": 3, "strictness": 2, "level": "B1", "voice": ""}
    assert ws.parse_start({"mode": "interview", "drill": True}, settings)["drill"] is True
    assert ws.parse_start({"mode": "interview", "drill": "yes"}, settings)["drill"] is False
    assert ws.parse_start({"mode": "english", "drill": True}, settings)["drill"] is False


class SilentSTT:
    """A recogniser that finds no speech in anything (the clip was a breath)."""
    available = True
    backend = "fake"

    def info(self):
        return {"available": True, "backend": "fake"}

    def warm_up(self):
        pass

    def transcribe(self, pcm, words=True):
        return stt_module.Transcript(text="", backend="fake")

    def transcribe_if_idle(self, pcm):
        return None


def test_a_voice_turn_with_no_speech_is_dropped_not_answered(client, monkeypatch, fake_llm):
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."}})

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    monkeypatch.setattr(stt_module, "get_stt", lambda settings: SilentSTT())
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "voice", "questions": 2, "speak": False})
        receive_until(s, "response_complete")
        s.send_json({"type": "activity_start", "turn_id": 4})
        s.send_bytes(bytes(32000))
        s.send_json({"type": "audio_stream_end"})
        dropped, seen = receive_until(s, "voice_turn_dropped")
        assert dropped["turn_id"] == 4
        s.send_json({"type": "activity_start", "turn_id": 5})            # browser recognition heard nothing
        s.send_json({"type": "activity_cancel", "turn_id": 5})
        again, more = receive_until(s, "voice_turn_dropped")
        assert again["turn_id"] == 5
        assert not [m for m in seen + more if m["type"] in ("interrupted", "user_transcript")]
        s.send_json({"type": "end_session"})
        receive_until(s, "session_ended")
