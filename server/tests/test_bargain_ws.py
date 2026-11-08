"""Negotiation v2 over the socket: start fields, the hiring-manager check, the interview money talk, v1 records."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import bargain, storage, ws
from server.engines.base import EngineStatus
from server.session import TextDriver
from server.negotiation import new_state as v1_state

from .test_talk_ws import NEG, SAME, bargain_reply, line_of, mike, receive_until, say  # noqa: F401

ANSWER = "Last year we redesigned the onboarding and I led the research with twelve users."


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("IC_CHECK_DELAY_S", "0.05")
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


def parse(block, mode="negotiate", **extra):
    return ws.parse_start({"mode": mode, "input": "text", "negotiate": block, **extra}, ws.config.load_settings())


@pytest.mark.parametrize("block,path", [
    ({**NEG, "scenario": "nope"}, "negotiate.scenario"),
    ({**NEG, "scenario": "counteroffer"}, "negotiate.current_pay"),
    ({**NEG, "scenario": "counteroffer", "current_pay": 70000}, "negotiate.new_offer"),
    ({**NEG, "scenario": "counteroffer", "current_pay": 70000, "new_offer": 60000, "leave_reason": "money"}, "negotiate.new_offer"),
    ({**NEG, "scenario": "counteroffer", "current_pay": 70000, "new_offer": 80000, "leave_reason": "boredom"}, "negotiate.leave_reason"),
    ({**NEG, "scenario": "raise", "current_pay": 60000}, "negotiate.ask"),
    ({**NEG, "scenario": "raise", "current_pay": 60000, "ask": 50000}, "negotiate.ask"),
    ({**NEG, "scenario": "raise", "current_pay": 60000, "ask": 70000, "review_month": 13}, "negotiate.review_month"),
    ({**NEG, "seed": -1}, "negotiate.seed"), ({**NEG, "seed": "x"}, "negotiate.seed"),
])
def test_bad_v2_fields_name_the_path(block, path):
    with pytest.raises(ValueError) as exc:
        parse(block)
    assert str(exc.value) == path


def test_scenario_rules_are_applied():
    c = parse({"role": "PM", "scenario": "counteroffer", "current_pay": 70000, "new_offer": 85000, "leave_reason": "growth"})["negotiate"]
    assert c["has_real_offer"] is True and c["target"] == 85000
    r = parse({"role": "PM", "scenario": "raise", "current_pay": 60000, "ask": 72000, "review_month": 6})["negotiate"]
    assert r["target"] == 72000 and r["review_month"] == 6
    with pytest.raises(ValueError) as exc:
        ws.parse_start({"mode": "interview", "input": "text", "money_talk": "yes"}, ws.config.load_settings())
    assert str(exc.value) == "money_talk"


@pytest.mark.parametrize("form", [
    {"scenario": "raise", "role": "PM", "current_pay": 60000, "ask": 72000, "review_month": 6},
    {"scenario": "counteroffer", "role": "PM", "current_pay": 70000, "new_offer": 85000, "leave_reason": "growth"},
    {"scenario": "screening", "role": "PM", "target": 90000},
    {"scenario": "internship", "role": "PM", "target": 60000},
])
def test_every_scenario_starts_and_ends_with_a_v2_debrief(client, patch_llm, fake_llm, form):
    patch_llm(fake_llm({"p9": bargain_reply}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": {**form, "style": "firm", "seed": 3}})
        started, _ = receive_until(s, "session_started")
        assert started["negotiate"]["scenario"] == form["scenario"] and "user_opens" in started["negotiate"]
        line_of(s)
        say(s, "I would like a bit more because I led the migration and shipped three launches.")
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["version"] == 2 and d["scenario"] == form["scenario"]


def test_the_hiring_manager_check_comes_back_by_itself(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p9": bargain_reply}))
    kinds, came = [], []
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text",
                     "negotiate": {**NEG, "style": "firm", "target": 99500, "seed": 11}})
        receive_until(s, "session_started")
        line_of(s)
        text = "I'm looking for 99,500"
        for i in range(1, 14):
            seen = say(s, text, i)
            for m in mike(seen):
                kinds.append(m["kind"])
                if m.get("came_back"):
                    came.append(m)
            if "checking" in kinds:
                while not came:                      # Mike comes back by himself, with no user line in between
                    got = receive_until(s, "response_complete")[1]
                    came += [m for m in mike(got) if m.get("came_back")]
                break
            if kinds[-1] == "closing":
                break
            text = "Because of my experience and the results I delivered, I'm asking for 99,500"
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    assert "checking" in kinds, kinds
    assert came and came[0]["kind"] == "turn"


def test_money_talk_runs_after_the_last_question(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."}, "p9": bargain_reply,
                        "p2b": {"items": []},
                        "p2a": {"situation": True, "task": True, "action": True, "result": True, "voice": "i",
                                "result_type": "number", "relevant": True, "reflection": False, "evidence": "", "praise": ""}}))
    start = {"type": "start", "mode": "interview", "input": "text", "questions": 1, "strictness": 3, "money_talk": True,
             "negotiate": {"role": "Designer", "job_low": 80000, "job_high": 100000, "target": 95000, "currency": "USD"}}
    with client.websocket_connect("/ws/session") as s:
        s.send_json(start)
        started, _ = receive_until(s, "session_started")
        assert started["money_talk"]["enabled"] is True and started["money_talk"]["style"] == "tight"
        assert started["hint_available"] is False
        line_of(s)
        s.send_json({"type": "hint"})
        assert receive_until(s, "error")[0]["code"] == "hint_unavailable"
        seen = say(s, ANSWER)
        assert mike(seen)[-1]["kind"] == "money_start"
        s.send_json({"type": "hint"})
        assert receive_until(s, "hint")[0]["card_id"]
        for i in range(2, 9):
            last = mike(say(s, "I am looking for about 95,000 because of my experience", i))[-1]
            if last["kind"] == "closing":
                break
        assert last["kind"] == "closing" and last["outcome"] == "noted"
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["money_talk"]["scenario"] == "screening" and d["money_talk"]["outcome"] == "noted"
    [record] = storage.list_records("sessions")
    assert record["title"].endswith(" · salary talk") and record["money_plan"]["style"] == "tight"


def test_money_talk_skip_closes_as_usual(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."}, "p9": bargain_reply,
                        "p2b": {"items": []},
                        "p2a": {"situation": True, "task": True, "action": True, "result": True, "voice": "i",
                                "result_type": "number", "relevant": True, "reflection": False, "evidence": "", "praise": ""}}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 1, "money_talk": True,
                     "negotiate": {"role": "Designer", "target": 95000}})
        receive_until(s, "session_started")
        line_of(s)
        assert mike(say(s, ANSWER))[-1]["kind"] == "money_start"
        assert mike(say(s, "Let's skip that, I'd rather not", 2))[-1]["kind"] == "closing"
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")


def test_a_v1_record_is_opened_with_the_v1_engine(fake_llm):
    state = v1_state({"role": "PM", "target": 95000, "job_low": 85000, "job_high": 100000}, "firm", False)
    driver = TextDriver(fake_llm({}), mode="negotiate", resume={"negotiation": state, "history": [], "q_index": 0},
                        plan=[], strictness=2, level="B1", voice="", speed=1.0, speak=False, settings={})
    assert not bargain.is_v2(driver.neg) and driver.neg is state


def test_the_model_intent_drives_the_turn_and_a_bad_one_falls_back(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p9": bargain_reply, "p10": {"intent": "accept", "amounts": [], "months": None, "criteria_named": False,
                                                   "in_writing_asked": False, "lever": None}}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        say(s, "I'm looking for 98k")
        closing = mike(say(s, "Honestly that is a fair place to land", 2))[-1]     # no keyword says accept here
        assert closing["kind"] == "closing" and closing["outcome"] == "accepted"
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")
    patch_llm(fake_llm({"p9": bargain_reply, "p10": {"intent": "teleport"}}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        assert mike(say(s, "I'm looking for 98k"))[-1]["kind"] == "turn"
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")


def test_cli_engines_skip_the_model_intent_call(fake_llm):
    """Owner 08.11 on claude_cli: 10-17 s a turn, ~8 s of it waiting for the intent reading. CLI engines use keywords."""
    import asyncio

    class NoCall:
        def chat_stream(self, *a, **k):
            raise AssertionError("intent must not call the model on a CLI engine")

    st = bargain.new_state(dict(NEG, scenario="offer", seed=1), "firm")
    driver = TextDriver(NoCall(), mode="negotiate", resume={"negotiation": st, "history": [], "q_index": 0}, plan=[],
                        strictness=2, level="B1", voice="", speed=1.0, speak=False, settings={"engine": "claude_cli"})
    assert asyncio.run(driver._intent(st, "Could we do 95,000 now?")) is None


def test_a_hint_card_comes_at_once_and_its_line_follows_from_the_persons_words(client, patch_llm, fake_llm):
    """D117: the fixed example first, then the model's line; a number the person never said becomes [number]."""
    llm = fake_llm({"p9": bargain_reply, "p11": {"candidate_line": "I built our internal tools and they lifted output 30%, so I'm asking for 98,000."}})
    patch_llm(llm)
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": NEG})
        receive_until(s, "session_started")
        line_of(s)
        say(s, "I'm looking for 98,000 because I built our internal tools")
        s.send_json({"type": "hint"})
        card, _ = receive_until(s, "hint")
        update, _ = receive_until(s, "hint_update")
        assert update["n"] == card["n"] and update["card_id"] == card["card_id"]
        assert "[number]" in update["example"] and "98,000" in update["example"] and "30%" not in update["example"]
        p11 = [c for c in llm.calls if c["key"] == "p11"][-1]["messages"][1]["content"]
        assert "internal tools" in p11 and "the number they asked for 98,000" in p11
        s.send_json({"type": "end_session"})
        receive_until(s, "debrief")


def test_no_hint_line_from_a_cli_engine(fake_llm):
    import asyncio
    st = bargain.new_state(dict(NEG, scenario="offer", seed=1), "firm")
    driver = TextDriver(fake_llm({"p11": {"candidate_line": "x"}}), mode="negotiate",
                        resume={"negotiation": st, "history": [], "q_index": 0}, plan=[], strictness=2, level="B1",
                        voice="", speed=1.0, speak=False, settings={"engine": "claude_cli"})
    assert asyncio.run(driver.hint_example({"card_id": "N5", "title": "t", "text": "r", "n": 1})) is None


def test_prep_course_sends_the_step_strip_from_the_first_line(client, patch_llm, fake_llm):
    """D118: with the course taken, every Mike line carries talk_step; the debrief has the case and homework."""
    patch_llm(fake_llm({"p9": bargain_reply}))
    prep = {"course": True, "results": ["Cut onboarding drop-off by a third"], "reason": "Market range", "fallbacks": ["step_up"]}
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text",
                     "negotiate": {"role": "PM", "target": 90000, "style": "firm", "seed": 3, "prep": prep}})
        receive_until(s, "session_started")
        first = line_of(s)
        assert first.get("talk_step") == 1
        steps = [m.get("talk_step") for m in mike(say(s, "I cut onboarding drop-off by a third, so I'm looking for 92,000."))]
        assert steps and all(isinstance(x, int) and 2 <= x <= 5 for x in steps)
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["case"]["results"] == prep["results"] and isinstance(d["homework"], list)


def test_no_prep_no_step_strip(client, patch_llm, fake_llm):
    patch_llm(fake_llm({"p9": bargain_reply}))
    with client.websocket_connect("/ws/session") as s:
        s.send_json({"type": "start", "mode": "negotiate", "input": "text", "negotiate": {"role": "PM", "target": 90000, "seed": 3}})
        receive_until(s, "session_started")
        assert "talk_step" not in line_of(s)
        assert all("talk_step" not in m for m in mike(say(s, "I'm looking for 92,000 because I led the migration.")))
        s.send_json({"type": "end_session"})
        d = receive_until(s, "debrief")[0]["debrief"]
    assert d["case"] is None and d["homework"][-1]["id"] == "prep_skipped"
