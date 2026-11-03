"""A debrief of a session with follow-ups: the numbers the page shows are QUESTION numbers (the tabs), not positions in the
list of all scored answers. The model and the code both write "q<n>" with n = the position among the answers that were
scored (a follow-up answer is a position too); the page gets the question numbers, built at read time, so sessions saved
before this fix read right as well.

Fixture: tests/data/session_followups.json, a real test-engine session ("General questions": 5 questions, 7 scored
answers: Q4 has two follow-ups). Its saved debrief holds the raw positions: no_result = q5, q6, q7 (Q4's two follow-ups
and Q5), no_star_action = q2, q4, too_short = q1, q2, q4, q7."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from server import debrief_view, storage
from server.main import create_app

DATA = Path(__file__).parent / "data" / "session_followups.json"


def session() -> dict:
    return json.loads(DATA.read_text(encoding="utf-8"))


def shown(data: dict | None = None, questions: bool = True) -> dict:
    data = data or session()
    return debrief_view.enrich_debrief(data["debrief"], data["feedback"], data["mode"],
                                       data["questions"] if questions else None)


def spot(debrief: dict, tag: str) -> dict:
    return next(s for s in debrief["weak_spots"] if s["tag"] == tag)


def row(debrief: dict, key: str) -> dict:
    return next(r for r in debrief["scorecard"]["rows"] if r["key"] == key)


def test_fixture_is_the_two_follow_up_session():
    data = session()
    assert [q["id"] for q in data["questions"]] == ["B1", "C2", "D2", "E5", "F1"]
    assert [f["answer_kind"] for f in data["feedback"]] == ["main"] * 4 + ["follow_up"] * 2 + ["main"]
    assert spot(data["debrief"], "no_result")["evidence"] == ["q5", "q6", "q7"]      # raw positions, as saved


def test_weak_spot_questions_are_question_numbers_not_answer_positions():
    for with_questions in (True, False):                       # without the question list: order of appearance
        d = shown(questions=with_questions)
        assert spot(d, "no_result")["questions"] == ["q4", "q5"]          # was "Questions 5, 6, 7" in a 5-question debrief
        assert spot(d, "no_star_action")["questions"] == ["q2", "q4"]
        assert spot(d, "too_short")["questions"] == ["q1", "q2", "q4", "q5"]
        biggest = max(int(q[1:]) for s in d["weak_spots"] for q in s["questions"])
        assert biggest <= 5


def test_the_saved_evidence_is_left_as_it_is_and_never_saved():
    data = session()
    d = shown(data)
    assert spot(d, "no_result")["evidence"] == ["q5", "q6", "q7"]
    assert "questions" in debrief_view.ENRICHED_SPOT_KEYS
    stripped = debrief_view.strip_enriched(d)
    assert all("questions" not in s for s in stripped["weak_spots"])
    assert shown({**data, "debrief": stripped}) == d           # reading again gives the same, no second conversion


def test_scorecard_lost_are_question_numbers_listed_once():
    d = shown()
    assert row(d, "structure")["lost"] == ["q2", "q4", "q5"]
    assert row(d, "own_part")["lost"] == ["q3", "q4"]
    assert row(d, "result")["lost"] == ["q4", "q5"]                   # main answers only: E5 and F1
    assert row(d, "reflection")["lost"] == ["q5"]
    assert row(d, "delivery")["lost"] == ["q1", "q2", "q4", "q5"]
    assert all(int(q[1:]) <= 5 for r in d["scorecard"]["rows"] for q in r["lost"])
    for r in d["scorecard"]["rows"]:
        assert r["lost"] == list(dict.fromkeys(r["lost"]))


def test_what_you_said_comes_from_its_question():
    d = shown()
    no_result = spot(d, "no_result")
    assert no_result["said"].startswith("I called the team together")
    assert no_result["said_from"] == "q4"                              # a follow-up answer of Q4, not "q5"
    assert spot(d, "no_star_action")["said_from"] == "q2"
    assert spot(d, "too_short")["said_from"] == "q1"


def test_plan_steps_carry_their_own_questions_and_tag():
    d = shown()
    steps = d["plan"]
    assert [s["tag"] for s in steps] == ["no_result", "no_star_action", "too_short"]
    assert [s["questions"] for s in steps] == [["q4", "q5"], ["q2", "q4"], ["q1", "q2", "q4", "q5"]]
    assert len({s["text"] for s in steps}) == 3
    assert [s["drill"] for s in steps] == [True, False, False]


def test_numbers_follow_the_session_question_list_when_a_question_has_no_feedback():
    """Q2 got no answer, Q3 did: the tab of Q3 is "3" (its place in the session), as the page numbers it."""
    data = session()
    data["questions"] = [data["questions"][0], {"id": "X9", "text": "unanswered"}, *data["questions"][1:]]
    d = shown(data)
    assert spot(d, "no_star_action")["questions"] == ["q3", "q5"]
    assert spot(d, "no_result")["questions"] == ["q5", "q6"]
    assert row(d, "own_part")["lost"] == ["q4", "q5"]


def test_ids_the_session_does_not_have_are_dropped():
    data = session()
    data["debrief"]["weak_spots"][0]["evidence"] = ["q5", "q99", "x"]
    assert spot(shown(data), "no_result")["questions"] == ["q4"]


def test_old_session_without_question_ids_falls_back_to_one_question_per_answer():
    data = session()
    for f in data["feedback"]:
        f.pop("question_id", None)
    d = shown(data, questions=False)                           # all in one "general" thread, as the page groups them
    assert all(q == "q1" for s in d["weak_spots"] for q in s["questions"])


def test_the_page_gets_question_numbers_over_the_api_and_the_file_stays_raw():
    data = session()
    storage.save_session(copy.deepcopy(data))
    from fastapi.testclient import TestClient
    with TestClient(create_app()) as client:
        got = client.get(f"/api/sessions/{data['id']}").json()["debrief"]
        again = client.get(f"/api/sessions/{data['id']}").json()["debrief"]
    assert spot(got, "no_result")["questions"] == ["q4", "q5"]
    assert row(got, "result")["lost"] == ["q4", "q5"]
    assert got == again
    on_disk = storage.read_record("sessions", data["id"])["debrief"]
    assert spot(on_disk, "no_result")["evidence"] == ["q5", "q6", "q7"]
    assert not any("questions" in s for s in on_disk["weak_spots"])

