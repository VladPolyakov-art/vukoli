"""Feedback after the call (D96): nothing but Mike runs during a live session; every queued answer is processed in
order after End, within a budget that scales with the number of answers, and the work survives the socket closing."""
from __future__ import annotations

import asyncio
import time

import pytest
from fastapi.testclient import TestClient

from server import postcall, storage, stt as stt_module, ws
from server.engines.base import EngineError, EngineStatus
from server.stt import Transcript, Word

SAME = {"Origin": "http://testserver"}
SAID = "I worked on the payments team and we shipped a new checkout flow last spring."
CONTENT_OK = {"situation": True, "task": True, "action": True, "result": True, "voice": "i", "result_type": "number",
              "relevant": True, "reflection": False, "evidence": "", "praise": ""}
ITEM = {"original": "we has redesigned", "better": ["we redesigned"], "reason": "Past tense.", "level": "B1", "class": "N"}
REPLIES = {"p1": {"gap": "none", "action": "next_question", "say": "Okay."}, "p2b": {"items": []}, "p2a": CONTENT_OK}


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def live_engine(monkeypatch, llm):
    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)


def receive_until(socket, kind, limit=120):
    seen = []
    for _ in range(limit):
        message = socket.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return message, seen
    raise AssertionError(f"{kind} not received; got {[m['type'] for m in seen]}")


def answer_record(n: int, text: str = SAID) -> dict:
    return {"id": f"fb-{n}", "turn_id": n, "question": f"Question {n}?", "question_id": f"q{n}", "competency": "B",
            "answer_kind": "main", "answer": f"{text} ({n})", "source": "voice", "complete": False, "layers": {},
            "history_index": n}


class FakeSTT:
    available = True

    def __init__(self, log: list):
        self.log = log

    def transcribe(self, pcm, words=True):
        self.log.append(("words", len(pcm)))
        return Transcript(text=SAID, words=[Word(w, i * 0.4, i * 0.4 + 0.3, 0.9) for i, w in enumerate(SAID.split())],
                          duration_s=6.0, backend="fake")


def make_context(llm, stt=None, *, emitted=None, saves=None, owner_ok=lambda: True):
    emitted = emitted if emitted is not None else []
    saves = saves if saves is not None else []

    async def run(make):
        return await make()

    async def save(done):
        saves.append(done)
        return True
    return postcall.Context(llm=llm, stt=stt, run=run, emit=lambda kind, **data: emitted.append({"type": kind, **data}),
                            settings={}, mode="interview", level="B1", engine="fake", known_terms=[],
                            owner_ok=owner_ok, save=save)


# ---------- the budget ----------

def test_budget_grows_with_the_number_of_answers_and_is_capped():
    assert postcall.budget_s(0) == postcall.POST_CALL_BASE_S
    assert postcall.budget_s(1) == postcall.POST_CALL_BASE_S + postcall.POST_CALL_PER_ANSWER_S
    assert postcall.budget_s(5) - postcall.budget_s(4) == postcall.POST_CALL_PER_ANSWER_S
    assert postcall.budget_s(5) > 90                         # the fixed 90 s cap this replaces could not fit five answers
    assert postcall.budget_s(10_000) == postcall.POST_CALL_MAX_S


def test_the_kept_audio_budget_covers_a_long_session():
    assert postcall.POST_CALL_PER_ANSWER_S >= 2 * 60          # a typical answer's stages (word pass + 2 model calls)
    assert stt_module.KEEP_AUDIO_MAX_BYTES == stt_module.SAMPLE_RATE * 2 * 60 * 45


# ---------- the queue after End ----------

async def test_answers_are_processed_in_order_word_pass_first_and_saved_after_each(fake_llm):
    llm = fake_llm(REPLIES)
    log: list = []
    items = [(answer_record(n), Transcript(text=SAID, audio=bytes(100 + n), backend="fake")) for n in (1, 2, 3)]
    emitted, saves = [], []
    ok = await postcall.run_answers(items, make_context(llm, FakeSTT(log), emitted=emitted, saves=saves))
    assert ok is True and saves == [1, 2, 3]
    assert log == [("words", 101), ("words", 102), ("words", 103)]            # one word pass per recording, in order
    assert [r["complete"] for r, _ in items] == [True, True, True]
    assert all(t.audio is None and t.words for _, t in items)                  # recordings are released, words filled
    progress = [(m["done"], m["total"]) for m in emitted if m["type"] == "feedback_progress"]
    assert progress == [(0, 3), (1, 3), (2, 3), (3, 3)]
    finals = [m["feedback"]["id"] for m in emitted if m["type"] == "feedback" and m["feedback"]["complete"]]
    assert finals == ["fb-1", "fb-2", "fb-3"]
    assert all("history_index" not in m["feedback"] for m in emitted if m["type"] == "feedback")
    # the model calls follow the answer order: language then content for each answer
    answers = [c["messages"][-1]["content"] for c in llm.calls if c["key"] in ("p2b", "p2a")]
    assert [("(1)" in a, "(2)" in a, "(3)" in a) for a in answers] == (
        [(True, False, False)] * 2 + [(False, True, False)] * 2 + [(False, False, True)] * 2)


async def test_a_failing_layer_is_marked_unavailable_and_the_rest_goes_on(fake_llm):
    llm = fake_llm({**REPLIES, "p2a": EngineError("timeout", "The engine did not answer.")})
    items = [(answer_record(1), None)]
    emitted = []
    assert await postcall.run_answers(items, make_context(llm, emitted=emitted)) is True
    layers = items[0][0]["layers"]
    assert layers["language"]["status"] != "unavailable" and layers["content"] == {
        "layer": "content", "status": "unavailable", "code": "timeout"}
    assert items[0][0]["complete"] is True


async def test_an_exhausted_budget_closes_the_rest_as_unavailable_and_still_saves(fake_llm, monkeypatch):
    monkeypatch.setattr(postcall, "POST_CALL_BASE_S", 0)
    monkeypatch.setattr(postcall, "POST_CALL_PER_ANSWER_S", 0)
    llm = fake_llm(REPLIES)
    items = [(answer_record(n), None) for n in (1, 2)]
    saves = []
    assert await postcall.run_answers(items, make_context(llm, saves=saves)) is True
    assert saves == [1, 2] and not llm.calls
    for record, _ in items:
        assert record["complete"] is True
        assert record["layers"]["language"] == {"layer": "language", "status": "unavailable", "code": "timeout"}
        assert record["layers"]["delivery"]                                      # the model-free layer is still there


async def test_a_job_that_lost_the_record_stops_quietly(fake_llm):
    llm = fake_llm(REPLIES)
    items = [(answer_record(n), None) for n in (1, 2)]
    emitted = []
    assert await postcall.run_answers(items, make_context(llm, emitted=emitted, owner_ok=lambda: False)) is False
    assert not llm.calls and items[0][0]["complete"] is False


async def test_a_job_waits_for_a_live_call_and_the_wait_is_not_billed(fake_llm, monkeypatch):
    monkeypatch.setattr(postcall, "MACHINE_POLL_S", 0.01)
    monkeypatch.setattr(postcall, "POST_CALL_BASE_S", 0.5)
    monkeypatch.setattr(postcall, "POST_CALL_PER_ANSWER_S", 0)
    llm = fake_llm(REPLIES)
    items = [(answer_record(1), None)]
    postcall.LIVE_SESSIONS["n"] = 1
    try:
        job = asyncio.ensure_future(postcall.run_answers(items, make_context(llm)))
        await asyncio.sleep(0.8)                                                 # longer than the whole budget
        assert not job.done() and not llm.calls                                  # Mike's call has the machine
    finally:
        postcall.LIVE_SESSIONS["n"] = 0
    assert await asyncio.wait_for(job, 5) is True
    assert items[0][0]["layers"]["language"]["status"] != "unavailable"          # the wait did not eat the budget


# ---------- the live socket ----------

def test_nothing_is_made_during_the_call_and_everything_after_end_in_answer_order(client, monkeypatch, fake_llm):
    llm = fake_llm(REPLIES)
    live_engine(monkeypatch, llm)
    with client.websocket_connect("/ws/session", headers=SAME) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3})
        receive_until(s, "turn_complete")
        during = []
        for turn in (1, 2, 3):
            s.send_json({"type": "user_turn", "text": f"{SAID} Number {turn}.", "turn_id": turn})
            _, seen = receive_until(s, "turn_complete")                          # the answer
            _, more = receive_until(s, "turn_complete")                          # Mike's reply
            during += seen + more
        assert not [m for m in during if m["type"].startswith("feedback")]
        assert {c["key"] for c in llm.calls} <= {"p1", "p0", "text"}             # Mike only: no feedback model call
        s.send_json({"type": "end_session"})
        _, before = receive_until(s, "session_saved")
        debrief, after = receive_until(s, "debrief")
    assert [m["type"] for m in before if not m["type"].startswith("turn_")][-2:] == ["saving", "session_saved"]
    assert not [m for m in before if m["type"].startswith("feedback")]          # the record is saved before any feedback
    progress = [(m["done"], m["total"]) for m in after if m["type"] == "feedback_progress"]
    assert progress == [(0, 3), (1, 3), (2, 3), (3, 3)]
    finals = [m["feedback"]["turn_id"] for m in after if m["type"] == "feedback" and m["feedback"]["complete"]]
    assert finals == [1, 2, 3]
    record = storage.read_record("sessions", debrief["session_id"])
    assert [r["complete"] for r in record["feedback"]] == [True, True, True] and "post_call" not in record
    assert record["debrief"]


def test_the_work_is_finished_and_saved_after_the_window_closes(client, monkeypatch, fake_llm):
    llm = fake_llm({**REPLIES, "p2b": {"items": [ITEM]}})
    live_engine(monkeypatch, llm)
    with client.websocket_connect("/ws/session", headers=SAME) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3})
        receive_until(s, "turn_complete")
        for turn in (1, 2):
            s.send_json({"type": "user_turn", "text": f"Last year we has redesigned the onboarding, take {turn}.",
                         "turn_id": turn})
            receive_until(s, "turn_complete")
            receive_until(s, "turn_complete")
        s.send_json({"type": "end_session"})
        saved, _ = receive_until(s, "session_saved")
    # The socket is gone here. The record was written before feedback began, with a marker; the job finishes alone.
    deadline = time.time() + 20
    record = storage.read_record("sessions", saved["session_id"])
    while "post_call" in record and time.time() < deadline:
        time.sleep(0.05)
        record = storage.read_record("sessions", saved["session_id"])
    assert "post_call" not in record and record["debrief"]
    assert [r["complete"] for r in record["feedback"]] == [True, True]
    assert all(r["layers"]["language"]["items"] for r in record["feedback"])
    assert not postcall.POST_CALL and not postcall.JOBS - {j for j in postcall.JOBS if j.done()}


def test_a_voice_answer_gets_its_word_timings_only_after_the_call(client, monkeypatch, fake_llm):
    llm = fake_llm(REPLIES)
    calls: list[bool] = []

    class RecordingSTT:
        available = True
        backend = "fake"

        def info(self):
            return {"available": True, "backend": "fake"}

        def warm_up(self):
            pass

        def transcribe(self, pcm, words=True):
            calls.append(words)
            ws_ = [Word(w, i * 0.4, i * 0.4 + 0.3, 0.3 if w == "checkout" else 0.9) for i, w in enumerate(SAID.split())]
            return Transcript(text=SAID, words=ws_ if words else [], duration_s=6.0, backend="fake")

        def transcribe_if_idle(self, pcm):
            return None
    live_engine(monkeypatch, llm)
    monkeypatch.setattr(stt_module, "get_stt", lambda settings: RecordingSTT())
    with client.websocket_connect("/ws/session", headers=SAME) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "voice", "questions": 2, "speak": False})
        receive_until(s, "response_complete")
        s.send_json({"type": "activity_start", "turn_id": 1})
        s.send_bytes(bytes(64000))
        s.send_json({"type": "audio_stream_end"})
        receive_until(s, "response_complete")
        assert calls == [False]                                 # the text pass only, while the call is on
        s.send_json({"type": "end_session"})
        debrief, after = receive_until(s, "debrief")
    assert calls == [False, True]                               # the word pass came after End
    record = storage.read_record("sessions", debrief["session_id"])
    assert [w["w"] for w in record["feedback"][0]["heard_as_words"]] == ["checkout"]


# ---------- REST while a session is being prepared, and after an interrupted run ----------

def preparing_session(running_job: bool) -> dict:
    record = {"id": storage.new_id("s-"), "mode": "interview", "started_at": storage.now_iso(), "title": "Practice",
              "engine": "ollama", "level": "B1", "questions": [], "transcript": [], "debrief": None,
              "feedback": [{**answer_record(1), "layers": {}}, {**answer_record(2), "layers": {}}],
              "post_call": postcall.status(1, 2)}
    for item in record["feedback"]:
        item.pop("history_index")
    record["feedback"][0].update(complete=True, layers={"delivery": {"layer": "delivery", "status": "ok"}})
    storage.save_session(record)
    if running_job:
        postcall.POST_CALL[record["id"]] = record["post_call"]
    return record


def test_edits_wait_while_the_feedback_is_being_prepared(client):
    record = preparing_session(running_job=True)
    try:
        sid = record["id"]
        for path, body in ((f"/api/sessions/{sid}/debrief", None),
                           (f"/api/sessions/{sid}/flags/x", {"feedback_id": "fb-1", "action": "dismiss"}),
                           (f"/api/sessions/{sid}/stronger", {"feedback_id": "fb-1"}),
                           (f"/api/sessions/{sid}/recheck", {"feedback_id": "fb-1", "text": SAID})):
            reply = client.post(path, headers=SAME, json=body)
            assert reply.status_code == 409 and reply.json()["detail"]["code"] == "still_preparing", path
        shown = client.get(f"/api/sessions/{sid}").json()
        assert shown["post_call"] == {"state": "running", "stage": "feedback", "done": 1, "total": 2}
    finally:
        postcall.POST_CALL.clear()


def test_a_session_whose_job_is_gone_is_closed_when_it_is_opened(client):
    record = preparing_session(running_job=False)
    shown = client.get(f"/api/sessions/{record['id']}").json()
    assert "post_call" not in shown and shown["debrief"]
    assert [r["complete"] for r in shown["feedback"]] == [True, True]
    assert shown["feedback"][1]["layers"]["language"] == {"layer": "language", "status": "unavailable",
                                                          "code": "interrupted"}
    assert "post_call" not in storage.read_record("sessions", record["id"])      # and it stays closed


def test_sessions_left_half_prepared_by_a_stopped_server_are_closed_on_start():
    record = preparing_session(running_job=False)
    from server.main import create_app
    with TestClient(create_app()):
        pass
    saved = storage.read_record("sessions", record["id"])
    assert "post_call" not in saved and saved["debrief"] and saved["feedback"][1]["complete"] is True
