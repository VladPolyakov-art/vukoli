"""Edit what I said (US-18 AC3): one answer is checked again from the corrected text; saved sessions over REST,
live sessions over the socket. The fake engine answers by what the prompt contains."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import config, engines, feedback, storage, ws
from server.engines.base import EngineError, EngineStatus

SAME = {"Origin": "http://testserver"}
OTHER = {"Origin": "https://other.example"}

HEARD = "Last year we has redesigned the onboarding and I led the research with twelve users."
SAID = "Last year we redesigned the onboarding and I led the research with twelve users, um, basically."
CONTENT_OK = {"situation": True, "task": True, "action": True, "result": True, "voice": "i", "result_type": "number",
              "relevant": True, "reflection": False, "evidence": "", "praise": ""}
CONTENT_NO_RESULT = {**CONTENT_OK, "result": False, "result_type": "none"}
ITEM = {"original": "we has redesigned", "better": ["we redesigned"], "reason": "Past tense.", "level": "B1", "class": "N"}


def saved_session(**over):
    language = feedback.language_layer(feedback.validate_language_items([ITEM], HEARD, [], set()))
    language["items"][0]["status"] = "dismissed"           # the user had dismissed it: it must not come back
    main = {"id": "fb-main", "turn_id": 1, "question": "Tell me about a project you led.", "question_id": "q1",
            "competency": "B", "answer_kind": "main", "answer": HEARD, "source": "voice", "complete": True,
            "heard_as_words": [{"w": "has", "start": 1.0, "end": 1.2, "p": 0.3}],
            "layers": {"delivery": {"layer": "delivery", "status": "ok", "severity": 0, "tag": "", "fix": "x",
                                    "metrics": {"words": 15, "fillers": 0, "fillers_per_100w": 0.0, "restarts": 0,
                                                "seconds": 60.0, "wpm": 110, "long_pauses": 0, "mode": "voice"}},
                       "language": language,
                       "content": {"layer": "content", "status": "fix", "severity": 3, "tag": "no_result",
                                   "fix": "Finish with what happened.", "missing": ["no_result"], "tips": []}},
            "stronger": {"rewrite": "I led research with twelve users and [result].", "placeholders": ["[result]"]}}
    other = {**main, "id": "fb-other", "question_id": "q2", "answer": "A different answer that stays as it is.",
             "layers": {}, "stronger": None}
    record = {"id": storage.new_id("s-"), "mode": "interview", "started_at": storage.now_iso(), "title": "Practice",
              "engine": config.load_settings()["engine"], "level": "B1", "questions": [],
              "transcript": [{"role": "model", "text": "Tell me about a project you led.", "kind": "question",
                              "question_id": "q1"},
                             {"role": "user", "text": HEARD, "kind": "main", "question_id": "q1"}],
              "feedback": [main, other], "debrief": None, **over}
    storage.save_session(record)
    return record


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def use_engine(monkeypatch, llm):
    monkeypatch.setattr(engines, "make_llm", lambda *args, **kwargs: llm)


def test_recheck_replaces_the_answer_and_makes_this_answers_feedback_again(client, monkeypatch, fake_llm):
    llm = fake_llm({"p2b": {"items": []}, "p2a": CONTENT_OK,
                    "p2c": {"rewrite": "I led research with twelve users and cut churn.", "placeholders": []}})
    use_engine(monkeypatch, llm)
    session = saved_session()
    reply = client.post(f"/api/sessions/{session['id']}/recheck", headers=SAME,
                        json={"feedback_id": "fb-main", "text": SAID})
    assert reply.status_code == 200, reply.text
    fb = reply.json()["feedback"]
    assert fb["answer"] == SAID and fb["edited"] is True and fb["complete"] is True
    assert fb["heard_as_words"] == []                                   # typed by the user: nothing is "unsure"
    assert fb["layers"]["language"]["items"] == []                      # the old correction is gone
    assert fb["layers"]["content"]["status"] == "ok"                    # content was asked again
    assert fb["stronger"]["rewrite"].startswith("I led research")       # the stronger answer was written again
    delivery = fb["layers"]["delivery"]["metrics"]
    assert (delivery["seconds"], delivery["wpm"], delivery["mode"]) == (60.0, 110, "voice")   # kept from the audio
    assert delivery["fillers"] == 2 and delivery["words"] == 16                                # recounted from the text
    assert reply.json()["transcript"][1]["text"] == SAID
    on_disk = storage.read_record("sessions", session["id"])
    assert on_disk["feedback"][0]["answer"] == SAID and on_disk["transcript"][1]["text"] == SAID
    assert on_disk["feedback"][1]["answer"] == "A different answer that stays as it is."   # only this answer
    assert [c["key"] for c in llm.calls] == ["p2b", "p2a", "p2c"]


def test_recheck_of_one_correction_swaps_only_its_fragment(client, monkeypatch, fake_llm):
    llm = fake_llm({"p2b": {"items": []}, "p2a": CONTENT_NO_RESULT,
                    "p2c": {"rewrite": "I led research with twelve users and [result].", "placeholders": ["[result]"]}})
    use_engine(monkeypatch, llm)
    session = saved_session()
    flag_id = session["feedback"][0]["layers"]["language"]["items"][0]["id"]
    reply = client.post(f"/api/sessions/{session['id']}/recheck", headers=SAME,
                        json={"feedback_id": "fb-main", "flag_id": flag_id, "text": "we had redesigned"})
    assert reply.status_code == 200, reply.text
    assert reply.json()["feedback"]["answer"] == HEARD.replace("we has redesigned", "we had redesigned")
    assert reply.json()["feedback"]["layers"]["content"]["tag"] == "no_result"
    assert "we had redesigned" in llm.calls[0]["messages"][-1]["content"]


def test_recheck_rejects_bad_requests_and_keeps_the_record(client, monkeypatch, fake_llm):
    llm = fake_llm({"p2b": {"items": []}, "p2a": CONTENT_OK})
    use_engine(monkeypatch, llm)
    session = saved_session()
    url = f"/api/sessions/{session['id']}/recheck"
    body = {"feedback_id": "fb-main", "text": SAID}
    assert client.post(url, headers=OTHER, json=body).status_code == 403
    assert client.post(url, headers=SAME, json={**body, "feedback_id": "nope"}).status_code == 404
    assert client.post(url, headers=SAME, json={**body, "flag_id": "nope"}).status_code == 404
    too_short = client.post(url, headers=SAME, json={**body, "text": "Just two"})
    assert too_short.status_code == 422 and too_short.json()["detail"]["code"] == "too_short"
    assert client.post(url, headers=SAME, json={**body, "text": ""}).status_code == 422
    assert client.post("/api/sessions/s-missing/recheck", headers=SAME, json=body).status_code == 404
    assert llm.calls == []
    assert storage.read_record("sessions", session["id"])["feedback"][0]["answer"] == HEARD


def test_recheck_engine_failure_changes_nothing(client, monkeypatch, fake_llm):
    llm = fake_llm({"p2b": {"items": []}, "p2a": EngineError("timeout", "The engine did not answer.")})
    use_engine(monkeypatch, llm)
    session = saved_session()
    reply = client.post(f"/api/sessions/{session['id']}/recheck", headers=SAME,
                        json={"feedback_id": "fb-main", "text": SAID})
    assert reply.status_code == 502 and reply.json()["detail"]["code"] == "timeout"
    on_disk = storage.read_record("sessions", session["id"])
    assert on_disk["feedback"][0]["answer"] == HEARD and not on_disk["feedback"][0].get("edited")
    assert on_disk["transcript"][1]["text"] == HEARD


def test_corrected_answer_and_fragment_helpers():
    record = {"answer": "We  has   redesigned it in the last quarter.", "layers": {"language": {"items": [
        {"id": "f1", "original": "We has redesigned", "heard_as": "We has redesigned"}]}}}
    assert feedback.replace_fragment("a b  c d", "b c", "x") == "a x d"       # whitespace in the answer may differ
    assert feedback.replace_fragment("a b", "z", "x") is None
    assert feedback.corrected_answer(record, " one two three four five ") == "one two three four five"
    assert feedback.corrected_answer(record, "We redesigned", "f1") == "We redesigned it in the last quarter."
    with pytest.raises(feedback.RecheckInputError) as short:
        feedback.corrected_answer({"answer": "We has redesigned it.", "layers": record["layers"]}, "We redesigned", "f1")
    assert short.value.code == "too_short"


# ---------- live session: the same recheck over the socket ----------

def live_engine(monkeypatch, llm):
    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)


def receive_until(socket, kind, accept=lambda m: True, limit=120):
    for _ in range(limit):
        message = socket.receive_json()
        if message["type"] == kind and accept(message):
            return message
    raise AssertionError(f"{kind} not received")


def test_live_recheck_updates_the_record_the_history_and_the_saved_session(client, monkeypatch, fake_llm):
    llm = fake_llm({
        "p1": {"gap": "none", "action": "next_question", "say": "Okay."},
        "p2b": lambda messages: {"items": [] if "we redesigned" in messages[-1]["content"] else [ITEM]},
        "p2a": CONTENT_OK})
    live_engine(monkeypatch, llm)
    with client.websocket_connect("/ws/session", headers=SAME) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": HEARD, "turn_id": 1})
        first = receive_until(s, "feedback", lambda m: m["feedback"]["complete"])["feedback"]
        flag_id = first["layers"]["language"]["items"][0]["id"]
        s.send_json({"type": "recheck", "feedback_id": first["id"], "flag_id": flag_id, "text": "we redesigned"})
        again = receive_until(s, "feedback", lambda m: m["feedback"].get("edited"))["feedback"]
        edited = receive_until(s, "answer_edited")
        assert again["answer"] == HEARD.replace("we has redesigned", "we redesigned")
        assert again["layers"]["language"]["items"] == [] and again["complete"] is True
        assert (edited["feedback_id"], edited["turn_id"], edited["text"]) == (first["id"], 1, again["answer"])
        # Not ready / unknown: told, nothing breaks.
        s.send_json({"type": "recheck", "feedback_id": "fb-unknown", "text": SAID})
        assert receive_until(s, "recheck_failed")["code"] == "not_found"
        s.send_json({"type": "recheck", "feedback_id": first["id"], "text": "too short"})
        assert receive_until(s, "recheck_failed")["code"] == "too_short"
        s.send_json({"type": "end_session"})
        saved = receive_until(s, "session_saved")
    record = storage.read_record("sessions", saved["session_id"])
    assert record["feedback"][0]["answer"] == again["answer"] and record["feedback"][0]["edited"] is True
    assert record["transcript"][1]["text"] == again["answer"]       # what Mike answers from, and the saved chat


def test_live_recheck_failure_leaves_the_answer_as_it_was(client, monkeypatch, fake_llm):
    calls = {"n": 0}

    def p2a(messages):
        calls["n"] += 1
        return CONTENT_OK if calls["n"] == 1 else EngineError("timeout", "The engine did not answer.")
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."},
                    "p2b": {"items": [ITEM]}, "p2a": p2a})
    live_engine(monkeypatch, llm)
    with client.websocket_connect("/ws/session", headers=SAME) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3})
        receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": HEARD, "turn_id": 1})
        first = receive_until(s, "feedback", lambda m: m["feedback"]["complete"])["feedback"]
        s.send_json({"type": "recheck", "feedback_id": first["id"], "text": SAID})
        failed = receive_until(s, "recheck_failed")
        assert failed["feedback_id"] == first["id"] and failed["code"] == "timeout"
        s.send_json({"type": "end_session"})
        saved = receive_until(s, "session_saved")
    record = storage.read_record("sessions", saved["session_id"])
    assert record["feedback"][0]["answer"] == HEARD and not record["feedback"][0].get("edited")
    assert record["transcript"][1]["text"] == HEARD
