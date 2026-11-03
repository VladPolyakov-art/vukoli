"""Search across saved practices (D105): matching, AND of words, ranking, snippet, question numbers, archived, odd data."""
from __future__ import annotations

import json
import time

import pytest
from fastapi.testclient import TestClient

from server import search, storage

QUESTIONS = [{"id": "B1", "text": "Describe your proudest project."}, {"id": "C2", "text": "Explain a complex idea simply."},
             {"id": "D3", "text": "Tell me about a conflict with a colleague."}]


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def make(title="Kestrel Pay · Product Manager", *, started="2026-11-01T10:00:00+01:00", mode="interview", archived=False,
         answers=None, vacancy_title="", vacancy_id="", questions=QUESTIONS, **extra):
    """A saved session. `answers`: a list of (question_id, answer text) in the order they were given."""
    transcript, feedback = [], []
    for qid, text in answers or []:
        question = next((q["text"] for q in questions if q["id"] == qid), "A question?")
        transcript += [{"role": "model", "kind": "question", "question_id": qid, "text": "Okay. " + question},
                       {"role": "user", "kind": "main", "question_id": qid, "text": text}]
        feedback.append({"id": f"fb-{len(feedback)}", "question": question, "question_id": qid, "answer": text,
                         "answer_kind": "main", "layers": {}})
    record = {"id": storage.new_id("s-"), "mode": mode, "started_at": started, "title": title, "questions": questions,
              "vacancy_title": vacancy_title, "vacancy_id": vacancy_id, "transcript": transcript, "feedback": feedback,
              "archived": archived, "debrief": None, **extra}
    return storage.save_session(record)


def ids(results):
    return [r["id"] for r in results]


def test_short_or_empty_query_gives_nothing():
    make(answers=[("B1", "I rebuilt the onboarding.")])
    for q in ("", " ", "a", "  x  "):
        assert search.search_sessions(q) == []


def test_matches_title_job_and_conversation_case_insensitively():
    a = make("Kestrel Pay · Product Manager")
    b = make("Quiet title", vacancy_title="Northwind Logistics · Product Owner")
    c = make("Third", answers=[("B1", "We shipped a PRICING experiment last spring.")])
    assert ids(search.search_sessions("KESTREL")) == [a["id"]]
    assert ids(search.search_sessions("northwind")) == [b["id"]]
    assert ids(search.search_sessions("pricing")) == [c["id"]]
    assert search.search_sessions("nonexistent") == []


def test_mode_matches_even_after_a_rename():
    e = make("My talks", mode="english")
    make("Other", mode="interview")
    assert ids(search.search_sessions("english")) == [e["id"]]


def test_vacancy_record_title_is_searched():
    vacancy = storage.save_record("vacancies", {"id": storage.new_id("v-"), "title": "Zephyr Labs · Data Lead", "text": ""})
    s = make("Renamed by the user", vacancy_id=vacancy["id"])
    result = search.search_sessions("zephyr")
    assert ids(result) == [s["id"]] and result[0]["match"]["field"] == "job"
    assert "Zephyr Labs" in result[0]["match"]["snippet"]


def test_every_word_must_match_somewhere():
    both = make("One", answers=[("B1", "I improved the checkout and the onboarding.")])
    make("Two", answers=[("B1", "I improved the checkout.")])
    only_title = make("Onboarding review", answers=[("B1", "I improved the checkout.")])
    assert set(ids(search.search_sessions("checkout onboarding"))) == {both["id"], only_title["id"]}
    assert search.search_sessions("checkout nothing") == []


def test_ranking_head_first_then_hits_then_newest():
    talk_few = make("Older talk", started="2026-10-01T10:00:00+01:00", answers=[("B1", "The budget was tight.")])
    talk_many = make("Many", started="2026-10-02T10:00:00+01:00",
                     answers=[("B1", "Budget budget budget."), ("C2", "More budget talk.")])
    newest = make("Newest", started="2026-11-02T10:00:00+01:00", answers=[("B1", "The budget again.")])
    head = make("Budget planning", started="2026-09-01T10:00:00+01:00")
    assert ids(search.search_sessions("budget")) == [head["id"], talk_many["id"], newest["id"], talk_few["id"]]


def test_snippet_is_about_120_chars_around_the_hit_with_ellipses():
    filler = "word " * 60
    s = make(answers=[("B1", filler + "the migration to Kubernetes went well. " + filler)])
    snippet = search.search_sessions("kubernetes")[0]["match"]["snippet"]
    assert "Kubernetes" in snippet and snippet.startswith("…") and snippet.endswith("…")
    assert 80 <= len(snippet) <= 125
    short = make("Short", answers=[("C2", "Tiny kubernetes note.")])
    hit = next(r for r in search.search_sessions("kubernetes") if r["id"] == short["id"])
    assert hit["match"]["snippet"] == "Tiny kubernetes note."
    assert s["id"] != short["id"]


def test_question_number_is_the_one_the_debrief_shows():
    s = make(answers=[("B1", "First answer."), ("D3", "I argued with the designer about the layout.")])
    hit = search.search_sessions("designer")[0]
    assert hit["id"] == s["id"] and hit["match"]["field"] == "answer" and hit["match"]["q"] == 3     # D3 is third in the list
    ask = search.search_sessions("conflict")[0]
    assert ask["match"]["field"] == "question" and ask["match"]["q"] == 3


def test_question_not_in_the_list_is_numbered_by_the_order_answered():
    s = make(questions=[], answers=[("X1", "Alpha."), ("X2", "The second one has a zebra.")])
    assert search.search_sessions("zebra")[0]["match"]["q"] == 2
    assert s["id"]


def test_english_practice_has_no_question_number():
    make("English practice", mode="english", answers=[("t1", "I went to the market yesterday.")])
    hit = search.search_sessions("market")[0]
    assert hit["match"]["field"] == "answer" and "q" not in hit["match"]


def test_archived_sessions_are_found_and_flagged():
    s = make("Old one", archived=True, answers=[("B1", "A story about gardening.")])
    hit = search.search_sessions("gardening")[0]
    assert hit["id"] == s["id"] and hit["archived"] is True


def test_trashed_sessions_are_not_searched():
    s = make("Gone", answers=[("B1", "Quietly vanishing words.")])
    storage.trash_record("sessions", s["id"])
    assert search.search_sessions("vanishing") == []


def test_feedback_answer_edited_after_the_fact_is_searched():
    s = make(answers=[("B1", "Original words.")])
    record = storage.read_record("sessions", s["id"])
    record["feedback"][0]["answer"] = "Corrected phrase with ledger."
    storage.save_session(record)
    assert ids(search.search_sessions("ledger")) == [s["id"]]


def test_result_shape_subtitle_and_limit():
    for n in range(5):
        make(f"Practice {n}", started=f"2026-11-0{n + 1}T10:00:00+01:00", vacancy_title="Acme · Designer")
    results = search.search_sessions("practice", limit=3)
    assert len(results) == 3 and results[0]["title"] == "Practice 4"
    first = results[0]
    assert set(first) == {"id", "title", "subtitle", "mode", "archived", "started_at", "match"}
    assert first["subtitle"] == "Acme · Designer · 5 Nov 2026" and first["match"]["field"] == "title"
    assert len(search.search_sessions("practice", limit=500)) == 5


def test_subtitle_leaves_out_a_job_that_is_the_title():
    make("Kestrel Pay · Product Manager", vacancy_title="Product Manager at Kestrel Pay")
    assert search.search_sessions("kestrel")[0]["subtitle"] == "1 Nov 2026"


def test_odd_and_missing_fields_do_not_break_it():
    make("Fine one", answers=[("B1", "A normal answer about trains.")])
    folder = storage._folder("sessions")
    odd = {"id": "s-odd-000001", "title": None, "mode": 7, "started_at": None, "questions": "nope",
           "transcript": [None, "x", {"role": "user"}, {"role": "user", "text": 5}, {"role": "model", "text": "trains?"}],
           "feedback": [None, {"answer": None, "question_id": 3}, "bad"], "vacancy_id": None, "archived": "yes"}
    (folder / "s-odd-000001.json").write_text(json.dumps(odd))
    (folder / "s-broken-0001.json").write_text("{not json")
    (folder / "s-array-00001.json").write_text("[1, 2]")
    (folder / "s-noid-000001.json").write_text(json.dumps({"title": "trains without an id"}))
    results = search.search_sessions("trains")
    assert {r["id"] for r in results} >= {"s-odd-000001"} and len(results) == 2
    odd_hit = next(r for r in results if r["id"] == "s-odd-000001")
    assert odd_hit["title"] == "" and odd_hit["archived"] is True and odd_hit["subtitle"] == ""


def test_cache_follows_a_changed_file_and_forgets_a_deleted_one():
    s = make(answers=[("B1", "Talking about zeppelins.")])
    assert ids(search.search_sessions("zeppelins")) == [s["id"]]
    record = storage.read_record("sessions", s["id"])
    record["transcript"][1]["text"] = "Now about airships instead."
    record["feedback"] = []
    storage.save_session(record)
    time.sleep(0.01)
    assert search.search_sessions("zeppelins") == [] and ids(search.search_sessions("airships")) == [s["id"]]
    storage.record_path("sessions", s["id"]).unlink()
    assert search.search_sessions("airships") == []


def test_fast_for_a_few_hundred_sessions():
    for n in range(300):
        make(f"Practice {n}", answers=[("B1", "Some words " * 40 + f"marker{n}"), ("C2", "More words " * 40)])
    search.search_sessions("words")                       # fills the cache
    started = time.perf_counter()
    assert len(search.search_sessions("marker299 words")) == 1
    assert time.perf_counter() - started < 1.0


def test_endpoint(client):
    s = make(answers=[("B1", "I coordinated the warehouse move.")])
    res = client.get("/api/sessions/search", params={"q": "warehouse"})
    assert res.status_code == 200 and ids(res.json()) == [s["id"]] and res.json()[0]["match"]["q"] == 1
    assert client.get("/api/sessions/search", params={"q": "w"}).json() == []
    assert client.get("/api/sessions/search").json() == []
    assert client.get(f"/api/sessions/{s['id']}").status_code == 200               # the id route still works
