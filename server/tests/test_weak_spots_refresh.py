"""US-22 AC3: dismissing (or restoring) a correction in a saved debrief changes the weak spots that debrief carries,
and with them the memory Home's "Drill my weak spots" reads."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import config, feedback, memory, storage

SAME = {"Origin": "http://testserver"}
SLIP = {"original": "since five years", "better": ["for five years"], "reason": "Use 'for' with periods of time.",
        "level": "B1", "class": "N"}
ANSWER = "I am working on this team since five years and activation went up by twelve percent."


def language_record(rid: str, with_slip: bool, *, content_tag: str = "") -> dict:
    items = feedback.validate_language_items([SLIP], ANSWER, [], set()) if with_slip else []
    layers = {"language": feedback.language_layer(items)}
    if content_tag:
        layers["content"] = {"layer": "content", "status": "fix", "severity": 3, "tag": content_tag, "fix": "x",
                             "missing": [content_tag], "tips": []}
    return {"id": rid, "question_id": rid, "answer_kind": "main", "answer": ANSWER, "complete": True, "layers": layers}


def saved(debrief: dict, records: list[dict]) -> str:
    sid = storage.new_id("s-")
    storage.save_session({"id": sid, "mode": "interview", "started_at": storage.now_iso(), "title": "Practice",
                          "engine": config.load_settings()["engine"], "questions": [], "transcript": [],
                          "feedback": records, "debrief": debrief})
    return sid


def model_debrief(*tags: tuple[str, str]) -> dict:
    return {"verdict": "Clear answers. One thing to fix.", "strength": "Structure.", "next_step": "Drill it.",
            "source": "model", "weak_spots": [{"layer": layer, "tag": tag, "text": "x", "evidence": ["q1"]}
                                              for layer, tag in tags]}


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def slip_flag_id(record: dict) -> str:
    return record["layers"]["language"]["items"][0]["id"]


def test_refresh_drops_a_spot_whose_flags_were_all_dismissed():
    records = [language_record("a", True, content_tag="no_result"), language_record("b", True), language_record("c", True)]
    debrief = model_debrief(("content", "no_result"), ("language", "preposition"))
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    debrief["weak_spots"][1]["tag"] = tag
    for r in records:
        feedback.apply_flag_action(r, slip_flag_id(r), "dismiss")
    out = feedback.refresh_weak_spots(debrief, records, "content-first")
    assert [(s["layer"], s["tag"]) for s in out["weak_spots"]] == [("content", "no_result")]
    assert out["verdict"] == debrief["verdict"]            # a model-written verdict keeps its words


def test_refresh_keeps_a_spot_while_one_flag_still_counts_and_recounts_the_evidence():
    records = [language_record("a", True), language_record("b", True), language_record("c", True)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    debrief = model_debrief(("language", tag))
    debrief["weak_spots"][0]["evidence"] = ["q1", "q2", "q3"]
    feedback.apply_flag_action(records[0], slip_flag_id(records[0]), "dismiss")
    out = feedback.refresh_weak_spots(debrief, records, "content-first")
    assert out["weak_spots"][0]["evidence"] == ["q2", "q3"]


def test_refresh_brings_a_restored_spot_back():
    records = [language_record("a", True), language_record("b", False), language_record("c", False)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    feedback.apply_flag_action(records[0], slip_flag_id(records[0]), "dismiss")
    debrief = feedback.refresh_weak_spots(model_debrief(("language", tag)), records, "content-first")
    assert debrief["weak_spots"] == []
    feedback.apply_flag_action(records[0], slip_flag_id(records[0]), "restore")
    again = feedback.refresh_weak_spots(debrief, records, "content-first")
    assert [(s["layer"], s["tag"]) for s in again["weak_spots"]] == [("language", tag)]


def test_refresh_leaves_a_too_short_or_missing_debrief_alone():
    assert feedback.refresh_weak_spots(None, [], "content-first") is None
    short = {"verdict": "Too short.", "too_short": True, "weak_spots": []}
    assert feedback.refresh_weak_spots(short, [language_record("a", True)], "content-first") is short


def test_dismissing_over_rest_updates_the_saved_debrief_and_the_memory(client):
    records = [language_record("a", True, content_tag="no_result"), language_record("b", True), language_record("c", True)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    sid = saved(model_debrief(("content", "no_result"), ("language", tag)), records)
    assert {s["tag"] for s in memory.summary()["weak_spots"]} == {"no_result", tag}

    for r in records:
        res = client.post(f"/api/sessions/{sid}/flags/{slip_flag_id(r)}", headers=SAME,
                          json={"feedback_id": r["id"], "action": "dismiss"})
        assert res.status_code == 200
    body = res.json()
    assert [s["tag"] for s in body["debrief"]["weak_spots"]] == ["no_result"]       # the answer carries it
    assert [s["tag"] for s in storage.read_record("sessions", sid)["debrief"]["weak_spots"]] == ["no_result"]  # and so does the file
    assert [s["tag"] for s in memory.summary()["weak_spots"]] == ["no_result"]       # Home reads this

    # Restoring one brings the language spot back.
    first = records[0]
    res = client.post(f"/api/sessions/{sid}/flags/{slip_flag_id(first)}", headers=SAME,
                      json={"feedback_id": first["id"], "action": "restore"})
    assert {s["tag"] for s in res.json()["debrief"]["weak_spots"]} == {"no_result", tag}


def test_a_session_without_a_debrief_is_saved_without_one(client):
    records = [language_record("a", True)]
    sid = saved(None, records)                                   # type: ignore[arg-type]
    storage.save_session({**storage.read_record("sessions", sid), "debrief": None})
    res = client.post(f"/api/sessions/{sid}/flags/{slip_flag_id(records[0])}", headers=SAME,
                      json={"feedback_id": "a", "action": "dismiss"})
    assert res.status_code == 200
    assert res.json()["debrief"] is None


# ---------- QA-07: the verdict never names a weak spot that is gone ----------

def two_spot_debrief(language_tag: str) -> dict:
    debrief = model_debrief(("content", "no_result"), ("language", language_tag))
    debrief["weak_spots"][0]["text"] = feedback.CONTENT_FIX.get("no_result") or "Finish with what happened."
    debrief["weak_spots"][1]["text"] = f"Work on {language_tag.replace('_', ' ')}."
    return debrief


def test_a_removed_spot_is_replaced_in_the_verdict_from_the_refreshed_list():
    records = [language_record("a", True, content_tag="no_result"), language_record("b", True), language_record("c", True)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    debrief = two_spot_debrief(tag)
    debrief["verdict"] = f"Your answers were clear. The one thing to fix: {tag.replace('_', ' ')}."
    debrief["next_step"] = f"Drill {tag.replace('_', ' ')} out loud."
    for r in records:
        feedback.apply_flag_action(r, slip_flag_id(r), "dismiss")
    out = feedback.refresh_weak_spots(debrief, records, "content-first")
    assert [s["tag"] for s in out["weak_spots"]] == ["no_result"]
    assert tag.replace("_", " ") not in out["verdict"].lower()
    assert out["verdict"].startswith("Your answers were clear. ")            # the model's other sentence stays
    assert out["verdict"].endswith(feedback.main_fix_sentence(out["weak_spots"]))
    assert tag.replace("_", " ") not in out["next_step"].lower()
    assert out["next_step"] == "Practise the content layer next."


def test_a_verdict_that_names_nothing_that_is_gone_keeps_its_words():
    records = [language_record("a", True, content_tag="no_result"), language_record("b", True), language_record("c", True)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    debrief = two_spot_debrief(tag)
    debrief["verdict"] = "Solid structure. Lead with the result."
    for r in records:
        feedback.apply_flag_action(r, slip_flag_id(r), "dismiss")
    assert feedback.refresh_weak_spots(debrief, records, "content-first")["verdict"] == "Solid structure. Lead with the result."


def test_with_no_spot_left_the_verdict_says_nothing_repeated_stood_out():
    records = [language_record("a", True), language_record("b", True), language_record("c", True)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    debrief = model_debrief(("language", tag))
    debrief["weak_spots"][0]["text"] = f"Work on {tag.replace('_', ' ')}."
    debrief["verdict"] = f"Nice work. The one thing to fix: {tag.replace('_', ' ')}."
    for r in records:
        feedback.apply_flag_action(r, slip_flag_id(r), "dismiss")
    out = feedback.refresh_weak_spots(debrief, records, "content-first")
    assert out["weak_spots"] == []
    assert out["verdict"] == "Nice work. No repeated problem stood out."
    assert out["next_step"] == debrief["next_step"] or out["next_step"] == "Try a harder round next."


def test_a_spot_named_twice_is_replaced_once():
    spot = {"layer": "language", "tag": "preposition", "text": "Work on preposition."}
    line = "Mind the preposition. The one thing to fix: preposition. Then drill."
    out = feedback.follow_weak_spots(line, [spot], "The main thing to fix: pace.")
    assert out == "The main thing to fix: pace. Then drill."


def test_rechecking_an_answer_rewrites_the_verdict_in_the_saved_debrief_response(client):
    records = [language_record("a", True, content_tag="no_result"), language_record("b", True), language_record("c", True)]
    tag = records[0]["layers"]["language"]["items"][0]["tag"]
    debrief = two_spot_debrief(tag)
    debrief["verdict"] = f"Your answers were clear. The one thing to fix: {tag.replace('_', ' ')}."
    sid = saved(debrief, records)
    for r in records:
        res = client.post(f"/api/sessions/{sid}/flags/{slip_flag_id(r)}", headers=SAME,
                          json={"feedback_id": r["id"], "action": "dismiss"})
    body = res.json()["debrief"]
    assert tag.replace("_", " ") not in body["verdict"].lower()
    assert storage.read_record("sessions", sid)["debrief"]["verdict"] == body["verdict"]
