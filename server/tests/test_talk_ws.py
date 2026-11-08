"""Tough talk over the socket: start validation, a whole negotiation and a whole tough round on the fake model,
the hint, the saved record, History, the debrief recompute, resume, and the REST endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import storage, talk, ws
from server.config import load_settings
from server.engines.base import EngineError, EngineStatus

SAME = {"Origin": "http://testserver"}
NEG = {"role": "Designer", "job_low": 80000, "job_high": 100000, "target": 98000, "currency": "USD",
       "style": "friendly", "has_real_offer": False}


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def patch_llm(monkeypatch):
    def use(llm):
        async def ready(settings, engine_id, voice=False):
            return EngineStatus(code="ready", ready=True, model="fake-model")
        monkeypatch.setattr(ws, "check_engine", ready)
        monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
        return llm
    return use


def receive_until(socket, kind, limit=200):
    seen = []
    for _ in range(limit):
        message = socket.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return message, seen
    raise AssertionError(f"{kind} not received; got {[m['type'] for m in seen]}")


def line_of(s):
    """Mike's next line (and the end of his turn)."""
    seen = receive_until(s, "response_complete")[1]
    return [m for m in seen if m["type"] == "turn_complete" and m["speaker"] == "model"][-1]


def say(s, text, turn_id=1):
    s.send_json({"type": "user_turn", "text": text, "turn_id": turn_id})
    return receive_until(s, "response_complete")[1]


def mike(seen):
    return [m for m in seen if m["type"] == "turn_complete" and m["speaker"] == "model"]


# ---------- start validation ----------

@pytest.mark.parametrize("patch,path", [
    ({"negotiate": None}, "negotiate"), ({"negotiate": {**NEG, "role": ""}}, "negotiate.role"),
    ({"negotiate": {**NEG, "role": "x" * 81}}, "negotiate.role"), ({"negotiate": {**NEG, "target": 0}}, "negotiate.target"),
    ({"negotiate": {**NEG, "target": "98k"}}, "negotiate.target"), ({"negotiate": {**NEG, "target": True}}, "negotiate.target"),
    ({"negotiate": {**NEG, "job_high": None}}, "negotiate.range"),
    ({"negotiate": {**NEG, "job_low": 100000, "job_high": 90000}}, "negotiate.range"),
    ({"negotiate": {**NEG, "target": 70000}}, "negotiate.range"),
    ({"negotiate": {**NEG, "currency": "usd"}}, "negotiate.currency"),
    ({"negotiate": {**NEG, "style": "mean"}}, "negotiate.style"),
    ({"negotiate": {**NEG, "has_real_offer": "yes"}}, "negotiate.has_real_offer"),
    ({"mode": "tough", "tough": {"theme": "pressure"}}, "tough.theme"), ({"mode": "tough", "tough": 3}, "tough")])
def test_parse_start_errors_name_the_field(patch, path):
    data = {"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG, **patch}
    with pytest.raises(ValueError) as exc:
        ws.parse_start(data, load_settings())
    assert str(exc.value) == path


def test_parse_start_accepts_valid_blocks_and_defaults():
    s = load_settings()
    opts = ws.parse_start({"mode": "negotiate", "input": "text", "negotiate": {"role": " PM ", "target": 90000.4}}, s)
    assert opts["negotiate"] == {"role": "PM", "job_low": None, "job_high": None, "target": 90000, "currency": "USD",
                                 "style": "friendly", "has_real_offer": False}
    assert opts["suggest"] is False
    assert ws.parse_start({"mode": "tough", "input": "text"}, s)["tough"] == {"theme": "mix"}
    assert ws.parse_start({"mode": "negotiate", "input": "text", "negotiate": {**NEG, "target": 120000}}, s)   # above the range is fine


def test_bad_start_reply_ends_with_the_field(client, patch_llm, fake_llm):
    patch_llm(fake_llm({}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": {**NEG, "target": -1}})
        err, _ = receive_until(s, "error")
        assert err["code"] == "bad_start" and "(negotiate.target)" in err["message"]


# ---------- a whole negotiation ----------

def recruiter_reply(messages):
    text = messages[-1]["content"]
    amount = next((ln.split(": ", 1)[1] for ln in text.splitlines() if ln.startswith("AMOUNT_TO_SAY: ")), "None")
    return {"recruiter_line": "Thanks for that." if amount in ("None", "") else f"Here is where we are: {amount} a year."}


def test_negotiation_end_to_end(client, patch_llm, fake_llm):
    llm = patch_llm(fake_llm({"p7": recruiter_reply}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        started, _ = receive_until(s, "session_started")
        assert started["talk"] is True and started["hint_available"] is True and started["suggester_available"] is False
        assert started["negotiate"]["style"] == "friendly" and started["negotiate"]["target"] == 98000
        assert started["questions"] == [] and "floor" not in str(started) and "ceiling" not in str(started)
        opening = line_of(s)
        assert opening["speaker"] == "model" and opening["kind"] == "turn"

        seen = say(s, "I was hoping for around 98k")
        line = mike(seen)[-1]
        assert "91,000 USD" in line["full_text"] and line["kind"] == "turn"
        assert not any(m["type"] in ("feedback", "suggestion_pending") for m in seen)      # no feedback records

        s.send_json({"type": "hint"})
        hint, _ = receive_until(s, "hint")
        assert hint["card_id"] and hint["title"] and hint["text"] and hint["example"] and hint["mode"] == "negotiate"

        seen = say(s, "Could we do 91k now and 98k after the 3 month probation, in writing?", 2)
        assert "offer letter" in mike(seen)[-1]["full_text"]          # the scripted in-writing line follows the model's
        seen = say(s, "Great, I accept the offer", 3)
        closing = mike(seen)[-1]
        assert closing["kind"] == "closing" and closing["outcome"] == "accepted"
        s.send_json({"type": "end_session"})
        debrief, seen = receive_until(s, "debrief")
    d = debrief["debrief"]
    assert d["kind"] == "negotiate" and d["outcome"] == "accepted" and d["deal"]["after_months"] == 3
    assert d["deal"]["in_writing"] and d["summary"]["year_one"] and d["hidden_range"]["floor"] == 80000
    assert not any(m["type"] == "feedback_progress" for m in seen)
    assert llm.calls and all(c["key"] == "p7" for c in llm.calls)       # only recruiter lines, no feedback layers
    # saved record, History, recompute
    [record] = storage.list_records("sessions")
    assert record["mode"] == "negotiate" and record["negotiation"]["outcome"] == "accepted"
    assert record["title"] == "Negotiation · Designer · Friendly" and record["feedback"] == []
    assert record["negotiation"]["hints_used"]
    listing = client.get("/api/sessions", headers=SAME).json()["sessions"][0]
    assert listing["mode"] == "negotiate" and listing["verdict"] == d["verdict"]
    again = client.post(f"/api/sessions/{record['id']}/debrief", headers=SAME).json()
    assert again["kind"] == "negotiate" and again["summary"]["captured_pct"] == d["summary"]["captured_pct"]
    page = client.get(f"/api/sessions/{record['id']}", headers=SAME).json()
    assert page["debrief"]["kind"] == "negotiate"


def test_model_line_with_a_wrong_number_is_replaced_by_the_scripted_line(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p7": {"recruiter_line": "We can go to 95,000 USD, our budget allows it."}}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        line = mike(say(s, "98k"))[-1]["full_text"]
        assert "95,000" not in line and "budget" not in line and "91,000 USD" in line
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    assert storage.list_records("sessions")[0]["negotiation"]["guard_replacements"] == 1


def test_negotiation_finishes_with_no_model_at_all(client, patch_llm, fake_llm):
    class Down(EngineError):
        pass
    patch_llm(fake_llm({"p7": EngineError("down", "model down")}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        assert "91,000 USD" in mike(say(s, "98k"))[-1]["full_text"]
        assert mike(say(s, "I need a few days to think", 2))[-1]["kind"] == "closing"
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["outcome"] == "time"


def test_surprise_style_is_hidden_during_the_call_and_revealed_after(client, patch_llm, fake_llm):
    patch_llm(fake_llm({}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": {**NEG, "style": "surprise"}})
        started, _ = receive_until(s, "session_started")
        assert started["negotiate"]["style"] == "surprise"
        line_of(s)
        say(s, "98k")
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["surprise"] is True and d["style"] in ("friendly", "firm", "tight")


def test_gemini_live_runs_these_modes_on_the_text_driver(client, patch_llm, fake_llm):
    patch_llm(fake_llm({}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "engine": "gemini_live", "negotiate": NEG})
        started, _ = receive_until(s, "session_started")
        assert started["engine"] == "gemini_live" and started["talk"]
        assert line_of(s)["speaker"] == "model"
        s.send_json({"type": "end_session"})
        receive_until(s, "session_ended")


def test_hint_is_unavailable_in_other_modes(client, patch_llm, fake_llm):
    patch_llm(fake_llm({}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "english", "input": "text"})
        receive_until(s, "session_started")
        s.send_json({"type": "hint"})
        assert receive_until(s, "error")[0]["code"] == "hint_unavailable"
        s.send_json({"type": "end_session"})
        receive_until(s, "session_ended")


def test_session_without_answers_is_not_saved(client, patch_llm, fake_llm):
    patch_llm(fake_llm({}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "tough", "input": "text", "tough": {"theme": "money"}})
        receive_until(s, "session_started")
        line_of(s)
        s.send_json({"type": "end_session"})
        assert receive_until(s, "session_ended")[0]["saved"] is False
    assert storage.list_records("sessions") == []


# ---------- a whole tough round ----------

def check_reply(messages):
    text = messages[-1]["content"]
    flag = {"value": False, "evidence_quote": ""}
    out = {k: dict(flag) for k in ("shares_personal_info", "blames_others", "argues_instead", "redirects_to_work",
                                   "rambling", "no_example")}
    out["calmer_answer"] = "I wanted a new challenge."
    if "my manager was impossible" in text:
        out["blames_others"] = {"value": True, "evidence_quote": "my manager was impossible"}
        out["argues_instead"] = {"value": True, "evidence_quote": "this text is not in the answer"}
    return out


def test_tough_round_end_to_end(client, patch_llm, fake_llm):
    llm = patch_llm(fake_llm({"p8": check_reply}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "tough", "input": "text", "tough": {"theme": "leaving"}})
        started, _ = receive_until(s, "session_started")
        assert started["tough"] == {"theme": "leaving", "theme_name": "Leaving and gaps", "total": 5}
        assert len(started["questions"]) == 5 and all(q["text"] == "" for q in started["questions"])
        first = line_of(s)
        assert first["kind"] == "question" and first["index"] == 1 and first["total"] == 5 and first["question_id"]
        kinds = []
        text = "I left because my manager was impossible and I learned a lot, and it ended up improving my skills."
        for i in range(1, 20):
            seen = say(s, text, i)
            kinds.append(mike(seen)[-1]["kind"])
            if kinds[-1] == "closing":
                break
        assert kinds[-1] == "closing" and kinds.count("question") == 4
        assert not llm.calls                                           # no model in the call
        s.send_json({"type": "hint"})
        hint = receive_until(s, "hint")[0]
        assert hint["card_id"] and hint["mode"] == "tough"
        s.send_json({"type": "end_session"})
        debrief, seen = receive_until(s, "debrief")
    progress = [m for m in seen if m["type"] == "feedback_progress"]
    assert progress and progress[-1]["done"] == progress[-1]["total"] == 5
    d = debrief["debrief"]
    assert d["kind"] == "tough" and d["summary"]["answered"] == 5 and d["summary"]["show_counts"]
    first_row = d["questions"][0]
    flagged = {sig["id"]: sig for sig in first_row["signals"]}
    assert "blames_others" in flagged and flagged["blames_others"]["quote"] in first_row["answers"][0]["text"]
    assert "argues_instead" not in flagged                              # its quote was not in the answer: dropped
    assert d["source"] == "code+model" and len([c for c in llm.calls if c["key"] == "p8"]) == 5
    [record] = storage.list_records("sessions")
    assert record["tough"]["closed"] and record["title"] == "Tough questions · Leaving and gaps"


def test_tough_model_failure_leaves_code_signals_only(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p8": EngineError("down", "model down")}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "tough", "input": "text", "tough": {"theme": "money"}})
        receive_until(s, "session_started")
        line_of(s)
        say(s, "I would like the market rate for this role, plus a flexible package overall.")
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["kind"] == "tough" and d["source"] == "code" and d["summary"]["answered"] >= 1


def test_redo_answer_restores_the_state(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p7": recruiter_reply}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        say(s, "98k")
        say(s, "I accept", 2)
        s.send_json({"type": "redo_answer"})
        receive_until(s, "answer_reset")
        receive_until(s, "response_complete")
        seen = say(s, "I want 98,000 because of my experience leading teams", 3)
        assert "USD" in mike(seen)[-1]["full_text"]
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["outcome"] != "accepted"


# ---------- resume ----------

def test_negotiation_is_continued_with_its_state(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p7": recruiter_reply}))
    start = {"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG}
    with client.websocket_connect("/ws/session") as s:
        s.send_json(start)
        started, _ = receive_until(s, "session_started")
        line_of(s)
        say(s, "98k")
        say(s, "I want 98,000 because of my experience leading teams", 2)
        sid = started["session_id"]
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    before = storage.read_record("sessions", sid)["negotiation"]
    with client.websocket_connect("/ws/session") as s:
        s.send_json({**start, "resume_session_id": sid, "negotiate": None})
        again, _ = receive_until(s, "session_started")
        assert again["session_id"] == sid and again["negotiate"]["role"] == "Designer"
        line = line_of(s)
        assert before["offer"] is not None and f"{before['offer']:,}" in line["full_text"]       # restated, scripted
        seen = say(s, "Could I get a sign-on bonus?", 3)
        assert mike(seen)
        s.send_json({"type": "end_session"})
        receive_until(s, "session_saved")
    after = storage.read_record("sessions", sid)["negotiation"]
    assert after["round"] >= before["round"] and after["offer"] >= before["offer"]
    assert after["floor"] == before["floor"] and after["ceiling"] == before["ceiling"] and after["opening"] == before["opening"]
    assert len(storage.list_records("sessions")) == 1


def test_tough_round_is_continued_at_the_same_question(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p8": EngineError("down", "x")}))
    start = {"type": "start", "mode": "tough", "input": "text", "tough": {"theme": "fit"}}
    with client.websocket_connect("/ws/session") as s:
        s.send_json(start)
        started, _ = receive_until(s, "session_started")
        line_of(s)
        say(s, "I like building products people use every day, and shipped three launches last year.")
        sid = started["session_id"]
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    saved = storage.read_record("sessions", sid)["tough"]
    with client.websocket_connect("/ws/session") as s:
        s.send_json({**start, "resume_session_id": sid, "tough": None})
        receive_until(s, "session_started")
        line = line_of(s)
        current = talk.question(saved["ids"][saved["index"]])
        assert current["text"] in line["full_text"]
        s.send_json({"type": "end_session"})
        receive_until(s, "session_saved")


# ---------- REST ----------

def test_content_endpoint(client):
    body = client.get("/api/tough-talk/content", headers=SAME).json()
    assert {c["id"] for c in body["cards"]} >= {f"N{i}" for i in range(1, 11)} | {"T1", "T2"}
    assert [t["id"] for t in body["themes"]] == ["money", "leaving", "weakness", "fit", "english", "personal", "mix"]
    assert next(t for t in body["themes"] if t["id"] == "personal")["personal"] is True
    assert {x["id"] for x in body["styles"]} >= {"friendly", "firm", "tight", "surprise"}
    assert body["tough_total"] == 5 and body["notes"]["practice"]


def test_salary_range_endpoint(client):
    pad = " Join our friendly team and ship great products with people who care about the details."
    made = client.post("/api/vacancies", headers=SAME, json={"title": "PM at Acme",
                                                             "text": "We pay $95,000 - $110,000 per year." + pad}).json()
    vid = made["id"]
    got = client.get(f"/api/vacancies/{vid}/salary-range", headers=SAME).json()
    assert (got["low"], got["high"], got["currency"]) == (95000, 110000, "USD")
    empty = client.post("/api/vacancies", headers=SAME, json={"title": "x", "text": "Great team, remote friendly." + pad}).json()
    got = client.get(f"/api/vacancies/{empty['id']}/salary-range", headers=SAME).json()
    assert got["low"] is None and got["high"] is None
    assert client.get("/api/vacancies/v-nope/salary-range", headers=SAME).status_code in (404, 422)


def test_salary_range_parser_cases():
    assert talk.salary_range("95-110k EUR") == (95000, 110000, "EUR")
    assert talk.salary_range("between 85k and 100k") == (85000, 100000, None)
    assert talk.salary_range("2-3 years of experience") == (None, None, None)
    assert talk.salary_range("3000-4000 per month") == (None, None, None)


def test_scripted_engine_routes_the_new_schemas():
    from server.content import schema
    from server.engines import scripted
    assert scripted.kind_of(schema("p7_recruiter")) == "p7" and scripted.kind_of(schema("p8_tough_check")) == "p8"
    for old in ("p1_interviewer", "p2a_content", "p3_debrief", "p2c_stronger", "suggester", "p0_questions"):
        assert scripted.kind_of(schema(old)) != "unknown"


def test_sessions_list_has_a_structured_talk_result(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p7": recruiter_reply}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        say(s, "98k")
        say(s, "Could we do 91k now and 98k after the 3 month probation, in writing?", 2)
        say(s, "I accept", 3)
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "tough", "input": "text", "tough": {"theme": "money"}})
        receive_until(s, "session_started")
        line_of(s)
        say(s, "I would like the market rate for this role, plus a flexible package overall.")
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    rows = {r["mode"]: r for r in client.get("/api/sessions", headers=SAME).json()["sessions"]}
    neg = rows["negotiate"]["talk_result"]
    assert neg["kind"] == "negotiate" and neg["outcome"] == "accepted" and neg["currency"] == "USD"
    assert neg["opening"] == 91000 and neg["final_offer"] >= 91000 and neg["gain_now"] == neg["final_offer"] - 91000
    assert neg["step_up"] == {"later": 98000, "after_months": 3, "in_writing": True} and neg["no_offer"] is False
    assert "captured_now_pct" in neg
    t = rows["tough"]["talk_result"]
    assert t["kind"] == "tough" and t["total"] >= 1 and 0 <= t["calm"] <= t["total"]
