"""Quick start (D111): `start.mode = "quick"`. Mike asks "interview or English?"; the answer picks the practice, the
session is saved under the chosen mode, and the question itself is neither feedback nor part of the transcript."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import storage, ws
from server.engines.base import EngineStatus
from server.session import classify_choice

ANSWER = "Last year I led the onboarding redesign and we cut drop-off by 20 percent with twelve users."


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def ready(monkeypatch, fake_llm):
    llm = fake_llm({
        "p1": {"gap": "none", "action": "next_question", "say": "Okay."},
        "p2b": {"items": []},
        "p2a": {"situation": True, "task": True, "action": True, "result": True, "voice": "i", "result_type": "number",
                "relevant": True, "reflection": False, "evidence": "", "praise": ""},
        "p5b": {"corrections": [], "phrase_to_keep": None},
        "text": "That sounds interesting. What was the hardest part?",
    })

    async def status(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", status)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    return llm


def receive_until(socket, kind, limit=80):
    seen = []
    for _ in range(limit):
        message = socket.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return message, seen
    raise AssertionError(f"{kind} not received; got {[m['type'] for m in seen]}")


@pytest.mark.parametrize("text,expected", [
    ("English", "english"), ("interview", "interview"), ("let's practise my English please", "english"),
    ("I want a job interview", "interview"), ("English interview", "english"), ("interview in English", "interview"),
    ("\u0434\u0430\u0432\u0430\u0439\u0020\u0430\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439", "english"), ("\u0441\u043e\u0431\u0435\u0441\u0435\u0434\u043e\u0432\u0430\u043d\u0438\u0435", "interview"), ("hmm, I don't know", None), ("", None),
])
def test_classify_choice(text, expected):
    assert classify_choice(text) == expected


def test_start_mode_quick_is_valid_and_never_a_session_mode():
    opts = ws.parse_start({"type": "start", "mode": "quick", "input": "text"}, __import__("server.config", fromlist=["x"]).load_settings())
    assert opts["quick"] is True and opts["mode"] == "interview"
    opts = ws.parse_start({"type": "start", "mode": "interview"}, __import__("server.config", fromlist=["x"]).load_settings())
    assert opts["quick"] is False
    with pytest.raises(ValueError):
        ws.parse_start({"type": "start", "mode": "karaoke"}, __import__("server.config", fromlist=["x"]).load_settings())


def test_quick_english_choice_switches_mode_and_saves_as_english(client, ready):
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "quick", "input": "text"})
        started = s.receive_json()
        assert started["type"] == "session_started" and started["quick"] is True and started["questions"] == []
        asked, _ = receive_until(s, "turn_complete")
        assert asked["speaker"] == "model" and "interview or English" in asked["full_text"]
        s.send_json({"type": "user_turn", "text": "English please, let's chat", "turn_id": 1})
        choice, _ = receive_until(s, "turn_complete")
        assert choice["speaker"] == "user" and choice["kind"] == "quick_choice"
        selected, _ = receive_until(s, "mode_selected")
        assert selected["mode"] == "english" and selected["questions"] == [] and selected["title"] == "English practice"
        opening, _ = receive_until(s, "turn_complete")
        assert "talk about" in opening["full_text"]
        s.send_json({"type": "user_turn", "text": "I went to the cinema yesterday with my sister and we watched a long film.", "turn_id": 2})
        receive_until(s, "turn_complete")
        receive_until(s, "turn_complete")
        s.send_json({"type": "end_session"})
        saved, _ = receive_until(s, "session_saved")
    record = storage.read_record("sessions", saved["session_id"])
    assert record["mode"] == "english" and record["title"] == "English practice" and record["questions"] == []
    assert [t["role"] for t in record["transcript"]] == ["model", "user", "model"]      # the choice is not in it
    assert len(record["feedback"]) == 1


def test_quick_interview_choice_runs_the_plan(client, ready):
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "quick", "input": "text", "questions": 3})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": "Interview", "turn_id": 1})
        selected, _ = receive_until(s, "mode_selected")
        assert selected["mode"] == "interview" and len(selected["questions"]) == 3
        question, _ = receive_until(s, "turn_complete")
        assert question["kind"] == "question" and question["question_id"] == selected["questions"][0]["id"]
        s.send_json({"type": "user_turn", "text": ANSWER, "turn_id": 2})
        receive_until(s, "turn_complete")
        receive_until(s, "turn_complete")
        s.send_json({"type": "end_session"})
        saved, _ = receive_until(s, "session_saved")
    record = storage.read_record("sessions", saved["session_id"])
    assert record["mode"] == "interview" and len(record["questions"]) == 3
    assert record["transcript"][1]["text"] == ANSWER and len(record["feedback"]) == 1


def test_quick_unclear_answer_asks_once_then_interview(client, ready):
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "quick", "input": "text", "questions": 2})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": "hmm not sure what I want really", "turn_id": 1})
        receive_until(s, "turn_complete")
        again, seen = receive_until(s, "turn_complete")
        assert "Interview or English?" in again["full_text"] and not [m for m in seen if m["type"] == "mode_selected"]
        s.send_json({"type": "user_turn", "text": "whatever you think is best for me", "turn_id": 2})
        selected, _ = receive_until(s, "mode_selected")
        assert selected["mode"] == "interview"
        s.send_json({"type": "end_session"})
        receive_until(s, "session_ended")


def test_quick_with_only_the_choice_saves_nothing(client, ready):
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "quick", "input": "text"})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": "I would like to practise an interview, please", "turn_id": 1})
        receive_until(s, "mode_selected")
        s.send_json({"type": "end_session"})
        ended, _ = receive_until(s, "session_ended")
        assert ended["saved"] is False
    assert storage.list_records("sessions") == []


def test_quick_interview_uses_the_newest_saved_job(client, ready):
    storage.save_record("vacancies", {"id": "v-20260101-000000-aaaaaa", "title": "Old role", "text": "x", "created_at": "2026-01-01T00:00:00",
                                      "questions": [{"id": "V1", "text": "Old question one?", "competency": "B",
                                                     "follow_ups": [{"tag": "YP", "text": "a"}, {"tag": "RN", "text": "b"}]}]})
    storage.save_record("vacancies", {"id": "v-20260601-000000-bbbbbb", "title": "Kestrel Pay · Product Manager", "text": "y",
                                      "created_at": "2026-06-01T00:00:00",
                                      "questions": [{"id": "V1", "text": "New question one?", "competency": "B",
                                                     "follow_ups": [{"tag": "YP", "text": "a"}, {"tag": "RN", "text": "b"}]}]})
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "quick", "input": "text", "questions": 2})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": "interview", "turn_id": 1})
        selected, _ = receive_until(s, "mode_selected")
        assert selected["questions"][0]["text"] == "New question one?"
        s.send_json({"type": "user_turn", "text": ANSWER, "turn_id": 2})
        receive_until(s, "turn_complete")
        receive_until(s, "turn_complete")
        receive_until(s, "turn_complete")
        s.send_json({"type": "end_session"})
        saved, _ = receive_until(s, "session_saved")
    record = storage.read_record("sessions", saved["session_id"])
    assert record["vacancy_id"] == "v-20260601-000000-bbbbbb" and "Kestrel Pay" in record["title"]
