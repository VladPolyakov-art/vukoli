"""US-23 AC4 (storage probe in /api/health) and US-13 AC5 (a cut-off session is continued from its saved record)."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server import config, storage, ws
from server.engines.base import EngineStatus

ANSWER = "Last year we redesigned the onboarding and I led the research with twelve users."
SAME = {"Origin": "http://testserver"}


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def receive_until(socket, kind, limit=120):
    seen = []
    for _ in range(limit):
        message = socket.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return message, seen
    raise AssertionError(f"{kind} not received; got {[m['type'] for m in seen]}")


def test_health_reports_a_writable_data_folder(client):
    body = client.get("/api/health", headers=SAME).json()
    assert body["storage_ok"] is True
    assert body["ok"] is True and body["data_dir"]                      # the existing fields stay
    assert list(Path(body["data_dir"]).glob(".write-test-*")) == []     # the probe cleans up after itself


def test_health_reports_a_read_only_data_folder(client, monkeypatch):
    def refuse(self, *args, **kwargs):
        raise PermissionError("read-only file system")
    monkeypatch.setattr(Path, "write_text", refuse)
    assert config.data_dir_writable() is False
    body = client.get("/api/health", headers=SAME).json()
    assert body["storage_ok"] is False and body["ok"] is True           # the app is up; only saving is blocked


def test_session_is_continued_from_its_saved_record(client, monkeypatch, fake_llm):
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."},
                    "p2b": {"items": []},
                    "p2a": {"situation": True, "task": True, "action": True, "result": True, "voice": "i",
                            "result_type": "number", "relevant": True, "reflection": False, "evidence": "",
                            "praise": ""}})

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    start = {"type": "start", "mode": "interview", "input": "text", "questions": 3}
    with client.websocket_connect("/ws/session") as s:
        s.send_json(start)
        started, _ = receive_until(s, "session_started")
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": ANSWER, "turn_id": 1})
        receive_until(s, "feedback_pending")
        receive_until(s, "turn_complete")                           # Mike's reply (the next question)
        session_id = started["session_id"]
        s.send_json({"type": "end_session"})                        # the record a cut-off session leaves behind
        receive_until(s, "debrief")

    with client.websocket_connect("/ws/session") as s:
        s.send_json({**start, "resume_session_id": session_id})
        again, _ = receive_until(s, "session_started")
        assert again["session_id"] == session_id and len(again["questions"]) == 3
        line, seen = receive_until(s, "turn_complete")
        assert line["speaker"] == "model" and line["full_text"].startswith("Sorry about that")
        assert line["kind"] == "repeat" and line["question_id"]     # asks again what Mike was waiting for
        assert any(m["type"] == "feedback" for m in seen)           # the saved feedback is sent again
        s.send_json({"type": "user_turn", "text": ANSWER + " It shipped in May.", "turn_id": 2})
        receive_until(s, "turn_complete")
        s.send_json({"type": "end_session"})
        saved, _ = receive_until(s, "session_saved")
        assert saved["session_id"] == session_id                    # the same record, not a second one
    records = storage.list_records("sessions")
    assert [r["id"] for r in records] == [session_id]
    answers = [t["text"] for t in records[0]["transcript"] if t["role"] == "user"]
    assert answers[0] == ANSWER and len(answers) == 2


def test_resume_refuses_a_missing_session_and_gemini(client, monkeypatch, fake_llm):
    llm = fake_llm({})

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "resume_session_id": "s-20260101-000000-aaaa"})
        message = s.receive_json()
        assert message["type"] == "error" and message["code"] == "resume_unavailable"
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "resume_session_id": "../etc/passwd"})
        assert s.receive_json()["code"] == "bad_start"
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "voice", "engine": "gemini_live",
                     "resume_session_id": "s-20260101-000000-aaaa"})
        assert s.receive_json()["code"] == "resume_unavailable"
    assert storage.list_records("sessions") == []
