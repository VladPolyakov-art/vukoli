"""C1b: a drill from a debrief works on that debrief's weak spots - the `start` focus reaches the question plan,
the interviewer's prompts, the saved session and the scripted test engine. A start without focus works as before."""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from server import content, feedback, planner, storage, ws
from server.content import Question
from server.engines import scripted
from server.engines.base import EngineStatus
from server.session import TextDriver

WE = {"layer": "content", "tag": "we_not_i"}
NO_RESULT = {"layer": "content", "tag": "no_result"}
NO_REFLECTION = {"layer": "content", "tag": "no_reflection"}
FILLER = {"layer": "delivery", "tag": "filler_high"}
SETTINGS = {"engine": "ollama", "questions_per_session": 3, "strictness": 2, "level": "B1", "voice": ""}


# ---------- start message ----------

def test_focus_is_read_for_a_drill_only_and_checked():
    start = lambda **kw: ws.parse_start({"mode": "interview", **kw}, SETTINGS)["focus"]
    assert start(drill=True, focus=[WE, FILLER]) == [WE, FILLER]
    assert start(drill=True) == [] and start(drill=True, focus=[]) == []         # an old start: no focus
    assert start(focus=[WE]) == []                                                # not a drill: ignored
    assert start(drill=True, focus=[WE, dict(WE), NO_RESULT]) == [WE, NO_RESULT]  # no repeats
    many = [{"layer": "content", "tag": f"t{i}"} for i in range(9)]
    assert len(start(drill=True, focus=many)) == planner.MAX_FOCUS
    for bad in ("we_not_i", [{"layer": "mind", "tag": "x"}], [{"layer": "content", "tag": "No Way"}],
                [{"layer": "content"}], ["content"]):
        with pytest.raises(ValueError):
            start(drill=True, focus=bad)


# ---------- the plan ----------

def test_without_focus_the_plan_is_the_same_as_before():
    assert [q.id for q in planner.plan_questions("mix", 5, seed=3)] == [q.id for q in planner.plan_questions("mix", 5, seed=3, focus=None)]
    # language and delivery tags cannot steer questions: the plan is the usual one
    assert [q.id for q in planner.plan_questions("mix", 3, seed=3, focus=[FILLER])] == [q.id for q in planner.plan_questions("mix", 3, seed=3)]
    assert [q.id for q in planner.plan_questions("mix", 3, seed=3, focus=[{"layer": "language", "tag": "tense"}])] == \
        [q.id for q in planner.plan_questions("mix", 3, seed=3)]
    assert [q.id for q in planner.plan_questions("mix", 3, seed=3, focus=[{"layer": "content", "tag": "off_topic"}])] == \
        [q.id for q in planner.plan_questions("mix", 3, seed=3)]


@pytest.mark.parametrize("seed", range(6))
def test_we_not_i_drill_asks_where_the_speaker_s_own_part_can_be_asked_for(seed):
    plan = planner.plan_questions("mix", 3, seed=seed, focus=[WE])
    assert len(plan) == 3 and len({q.text for q in plan}) == 3
    assert all("YP" in q.follow_ups for q in plan)                      # the follow-up for this gap is ready
    assert all(q.competency in planner.FOCUS_PROFILE["we_not_i"]["comps"] for q in plan)
    assert len({q.competency for q in plan}) == 3                       # not three of the same kind
    assert not any(q.competency == "A" for q in plan)                   # not "what gives you energy"


def test_each_focus_tag_gets_its_own_questions_in_turn():
    plan = planner.plan_questions("mix", 4, seed=1, focus=[WE, NO_REFLECTION, FILLER])   # filler: no steering
    assert plan[0].competency in "BGECF" and "YP" in plan[0].follow_ups
    assert plan[1].competency in "FDBGC" and "WD" in plan[1].follow_ups
    assert plan[2].competency in "BGECF" and "YP" in plan[2].follow_ups
    assert plan[3].competency in "FDBGC" and "WD" in plan[3].follow_ups


def test_questions_from_the_job_join_the_drill_when_they_fit():
    cv_jd = Question("V1", "B", "You led checkout for six people. What did you decide yourself?",
                     {"YP": "What exactly did you do?", "RN": "What changed?"}, source="cv_jd", anchor="x")
    other = Question("V2", "A", "Why Kestrel Pay?", {"CT": "What worried you?", "WD": "What differently?"}, source="cv_jd", anchor="y")
    plan = planner.plan_questions("mix", 3, seed=2, extra=[cv_jd, other], focus=[WE])
    assert cv_jd in plan and other not in plan


def test_the_plan_is_always_as_long_as_asked():
    for count in (1, 3, 10):
        assert len(planner.plan_questions("mix", count, seed=0, focus=[WE, NO_RESULT])) == count


def test_focus_gaps_follow_the_content_tags_only():
    assert planner.focus_gaps([WE, FILLER, NO_RESULT, {"layer": "content", "tag": "vague_result"}]) == ["own_part", "result"]
    assert planner.focus_gaps([FILLER, {"layer": "language", "tag": "we_not_i"}]) == []     # a content tag in another layer
    assert planner.focus_gaps(None) == []


# ---------- the interviewer's prompts ----------

def test_the_live_interviewer_prompt_names_the_focus():
    line = planner.focus_line([WE, NO_REFLECTION, FILLER])
    system = content.system("live_interviewer", max_follow_ups=2, strictness=2, plan="1. Q", context="", focus=line)
    assert "own_part" in system and 'says "we"' in system and "reflection" in system and "filler" not in system
    assert "Do not mention the focus" in system
    plain = content.system("live_interviewer", max_follow_ups=2, strictness=2, plan="1. Q", context="", focus=planner.focus_line([FILLER]))
    assert plain == content.system("live_interviewer", max_follow_ups=2, strictness=2, plan="1. Q", context="")


PLAN = [Question("B1", "B", "Tell me about a project you owned.", {"YP": "What was your part?", "RN": "What was the result?"}),
        Question("E1", "E", "Tell me about a hard call.", {"YP": "Your part?", "RN": "The result?"})]
ANSWER = "We shipped the new checkout flow last spring and the team handled the rollout together with design."


async def _ask(fake_llm, focus_gaps):
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."}})
    driver = TextDriver(llm, plan=PLAN, speak=False, focus_gaps=focus_gaps, on_turn_complete=lambda *a, **k: None)
    await driver.handle_user_text_turn(ANSWER)
    for _ in range(200):
        if not driver.replying():
            break
        await asyncio.sleep(0.01)
    (call,) = [c for c in llm.calls if c["key"] == "p1"]
    return call["messages"][1]["content"], call["messages"][0]["content"]


async def test_the_turn_prompt_carries_the_focus_gaps(fake_llm):
    user, system = await _ask(fake_llm, ["own_part", "result"])
    assert "FOCUS_GAPS: own_part, result" in user
    assert "FOCUS_GAPS" in system and "never mention the focus" in system.lower()
    assert system.count("own_part") == 1                    # the system prompt stays the same for every session (cache)


async def test_without_focus_the_turn_prompt_says_none(fake_llm):
    user, _ = await _ask(fake_llm, None)
    assert "FOCUS_GAPS: none" in user


# ---------- the scripted test engine ----------

async def _scripted(answer, focus_gaps, asked="none"):
    question = PLAN[0]
    bank = "; ".join(f"{tag}: {text}" for tag, text in question.follow_ups.items())
    user = content.user("p1_interviewer", question=question.text, next_question="Next?", follow_up_bank=bank,
                        follow_ups_already_asked=asked, focus_gaps=", ".join(focus_gaps) or "none",
                        transcript=answer, **feedback.hints(answer))
    return await scripted.ScriptedEngine().complete_json(
        [{"role": "system", "content": "s"}, {"role": "user", "content": user}], content.schema("p1_interviewer"))


async def test_scripted_interviewer_checks_the_focus_gap_first():
    plain = await _scripted(ANSWER, [])
    assert plain["say"] == PLAN[0].follow_ups["RN"]                       # as before: result first
    drill = await _scripted(ANSWER, ["own_part"])
    assert drill["gap"] == "own_part" and drill["say"] == PLAN[0].follow_ups["YP"]
    again = await _scripted(ANSWER, ["own_part"], asked=drill["say"])
    assert again["say"] == PLAN[0].follow_ups["RN"]                       # the gap was asked: the usual order goes on


async def test_scripted_interviewer_does_not_ask_for_a_part_the_answer_already_has():
    mine = "I decided the rollout order, I wrote the plan and I ran every review myself before the launch week."
    reply = await _scripted(mine, ["own_part"])
    assert reply["say"] != PLAN[0].follow_ups["YP"]


# ---------- the whole socket ----------

@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def _receive_until(socket, kind, limit=80):
    seen = []
    for _ in range(limit):
        message = socket.receive_json()
        seen.append(message)
        if message["type"] == kind:
            return message, seen
    raise AssertionError(kind)


def test_start_with_focus_plans_for_it_and_saves_it(client, monkeypatch, fake_llm):
    llm = fake_llm({"p1": {"gap": "own_part", "action": "follow_up", "say": "What did you do yourself?"}})

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    with client.websocket_connect("/ws/session", headers={"origin": "http://testserver"}) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3, "drill": True, "focus": [WE]})
        started = s.receive_json()
        assert started["type"] == "session_started" and started["focus"] == [WE]
        assert [q["competency"] in "BGECF" and any(f["tag"] == "YP" for f in q["follow_ups"]) for q in started["questions"]] == [True] * 3
        _receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": ANSWER, "turn_id": 1})
        _receive_until(s, "turn_complete")
        _receive_until(s, "turn_complete")
        (call,) = [c for c in llm.calls if c["key"] == "p1"]
        assert "FOCUS_GAPS: own_part" in call["messages"][1]["content"]
        s.send_json({"type": "end_session"})
        saved, _ = _receive_until(s, "session_saved")
    assert storage.read_record("sessions", saved["session_id"])["focus"] == [WE]


def test_start_without_focus_is_as_before(client, monkeypatch, fake_llm):
    llm = fake_llm({"p1": {"gap": "none", "action": "next_question", "say": "Okay."}})

    async def ready(settings, engine_id, voice=False):
        return EngineStatus(code="ready", ready=True, model="fake-model")
    monkeypatch.setattr(ws, "check_engine", ready)
    monkeypatch.setattr(ws, "get_llm", lambda settings, engine_id, voice=False: llm)
    with client.websocket_connect("/ws/session", headers={"origin": "http://testserver"}) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "questions": 3, "drill": True})
        started = s.receive_json()
        assert started["type"] == "session_started" and "focus" not in started and len(started["questions"]) == 3
        _receive_until(s, "turn_complete")
        s.send_json({"type": "user_turn", "text": ANSWER, "turn_id": 1})
        _receive_until(s, "turn_complete")
        s.send_json({"type": "end_session"})
        saved, _ = _receive_until(s, "session_saved")
    assert "focus" not in storage.read_record("sessions", saved["session_id"])


def test_a_malformed_focus_is_a_bad_start(client):
    with client.websocket_connect("/ws/session", headers={"origin": "http://testserver"}) as s:
        s.send_json({"type": "start", "mode": "interview", "input": "text", "drill": True, "focus": "we_not_i"})
        message = s.receive_json()
        assert message["type"] == "error" and message["code"] == "bad_start" and "focus" in message["message"]
