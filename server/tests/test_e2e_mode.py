"""The test-only scripted engine and /api/_e2e/* (IC_E2E=1): they work under the flag and do not exist without it."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import config, content, feedback, planner, storage
from server.engines import make_llm, ollama, scripted
from server.engines.base import EngineError

PROFILE = "Alex Morgan, product manager at Kestrel Pay. Led the checkout team and owned the payments roadmap."
JOB = ("Product Manager at Kestrel Pay\nYou will own the checkout experience, work with engineering and design, "
       "and use data to decide what to build next.")
NO_RESULT = ("I lead the checkout team and I own the roadmap for payments. Last year I rebuilt the onboarding flow "
             "with a designer and I wrote the brief and decided what to cut when we were late.")
WITH_RESULT = NO_RESULT + " Activation went up by twelve percent in one quarter."


@pytest.fixture
def e2e_client(monkeypatch, tmp_path):
    monkeypatch.setenv("IC_E2E", "1")
    monkeypatch.setenv("IC_WEB_DIST", str(tmp_path / "no-web"))
    scripted.reset()
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c
    scripted.reset()


@pytest.fixture
def plain_client(monkeypatch, tmp_path):
    monkeypatch.delenv("IC_E2E", raising=False)
    monkeypatch.setenv("IC_WEB_DIST", str(tmp_path / "no-web"))
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


# ---------- the flag ----------

def test_flag_is_off_by_default_and_exact(monkeypatch):
    monkeypatch.delenv("IC_E2E", raising=False)
    assert config.e2e_enabled() is False
    for value in ("0", "true", "yes", ""):
        monkeypatch.setenv("IC_E2E", value)
        assert config.e2e_enabled() is False
    monkeypatch.setenv("IC_E2E", "1")
    assert config.e2e_enabled() is True


def test_without_the_flag_the_routes_do_not_exist(plain_client):
    assert plain_client.post("/api/_e2e/reset").status_code == 404
    assert plain_client.get("/api/_e2e/engine").status_code == 404
    assert plain_client.post("/api/_e2e/seed", json={}).status_code == 404
    assert plain_client.post("/api/_e2e/engine", json={"status": "ready"}).status_code == 404
    assert plain_client.post("/api/_e2e/storage", json={"writable": False}).status_code == 404


def test_storage_can_be_reported_as_not_writable_until_reset(e2e_client):
    assert e2e_client.get("/api/health").json()["storage_ok"] is True
    assert e2e_client.post("/api/_e2e/storage", json={"writable": False}).json() == {"ok": True, "writable": False}
    body = e2e_client.get("/api/health").json()
    assert body["storage_ok"] is False and body["ok"] is True
    e2e_client.post("/api/_e2e/reset")
    assert e2e_client.get("/api/health").json()["storage_ok"] is True


def test_the_storage_switch_does_nothing_without_the_flag(monkeypatch):
    monkeypatch.delenv("IC_E2E", raising=False)
    monkeypatch.setattr(config, "E2E_STORAGE_BLOCKED", True)
    assert config.data_dir_writable() is True


def test_without_the_flag_ollama_is_the_real_engine(monkeypatch, plain_client):
    monkeypatch.delenv("IC_E2E", raising=False)
    assert isinstance(make_llm(config.load_settings(), "ollama"), ollama.OllamaEngine)
    listed = plain_client.get("/api/engines").json()["engines"]
    assert [e["id"] for e in listed] == ["ollama", "openai_compatible", "claude_cli", "codex_cli", "antigravity_cli",
                                         "gemini_live"]                       # no extra engine is listed
    assert all(scripted.MODEL not in (e["status"].get("model") or "") for e in listed)
    assert plain_client.get("/api/health").json()["ok"] is True


def test_with_the_flag_the_wizard_lists_a_ready_engine(e2e_client):
    listed = {e["id"]: e for e in e2e_client.get("/api/engines").json()["engines"]}
    assert listed["ollama"]["status"]["ready"] is True and listed["ollama"]["status"]["model"] == scripted.MODEL
    assert listed["ollama"]["name"] == "Ollama (local)"
    assert e2e_client.get("/api/engines/ollama/models").json()["models"][0]["name"] == scripted.MODEL
    assert e2e_client.post("/api/engines/ollama/test", headers={"Origin": "http://testserver"}).json()["ok"] is True


# ---------- reset and steering ----------

def test_reset_wipes_the_data_folder_and_the_engine(e2e_client):
    storage.save_profile(PROFILE, "pasted")
    config.update_settings({"name": "Alex"})
    e2e_client.post("/api/_e2e/engine", json={"status": "not_running", "fail": ["p2a"], "delay_ms": 5})
    assert e2e_client.post("/api/_e2e/reset").json() == {"ok": True}
    assert e2e_client.get("/api/profile").json()["text"] == ""
    assert e2e_client.get("/api/settings").json()["name"] == ""
    assert e2e_client.get("/api/_e2e/engine").json() == {"status": "ready", "fail": [], "delay_ms": 0, "calls": {}}


def test_engine_can_be_taken_down_and_brought_back_with_connect(e2e_client):
    assert e2e_client.post("/api/_e2e/engine", json={"status": "not_running"}).json()["status"] == "not_running"
    status = e2e_client.get("/api/engines/ollama/status").json()
    assert status["code"] == "not_running" and status["hint_command"] == "ollama serve" and not status["ready"]
    for code in ("not_installed", "no_model"):
        e2e_client.post("/api/_e2e/engine", json={"status": code})
        assert e2e_client.get("/api/engines/ollama/status").json()["code"] == code
    e2e_client.post("/api/_e2e/engine", json={"status": "not_running"})
    connected = e2e_client.post("/api/engines/ollama/connect", headers={"Origin": "http://testserver"}).json()
    assert connected["started"] is True and connected["status"]["ready"] is True      # nothing was launched


def test_unknown_kinds_are_ignored_and_failures_are_reported(e2e_client):
    assert e2e_client.post("/api/_e2e/engine", json={"fail": ["p3", "nope"]}).json()["fail"] == ["p3"]


# ---------- the replies ----------

async def test_interviewer_follows_up_until_the_answer_has_a_number():
    llm = scripted.ScriptedEngine()
    question = planner.plan_questions("mix", 3, seed=1)[0]
    bank = "; ".join(f"{tag}: {text}" for tag, text in question.follow_ups.items())

    def ask(answer: str, asked: str = "none") -> dict:
        user = content.user("p1_interviewer", question=question.text, next_question="Another question?",
                            follow_up_bank=bank, follow_ups_already_asked=asked, transcript=answer,
                            **feedback.hints(answer))
        return [{"role": "system", "content": "s"}, {"role": "user", "content": user}]

    schema = content.schema("p1_interviewer")
    first = await llm.complete_json(ask(NO_RESULT), schema)
    assert first["action"] == "follow_up" and first["say"] in question.follow_ups.values()
    second = await llm.complete_json(ask(NO_RESULT, first["say"]), schema)
    assert second["action"] == "follow_up" and second["say"] != first["say"]
    assert (await llm.complete_json(ask(WITH_RESULT), schema))["action"] == "next_question"
    assert await llm.complete_json(ask(WITH_RESULT), schema) == await llm.complete_json(ask(WITH_RESULT), schema)


async def test_feedback_layers_come_out_of_the_real_pipeline():
    llm = scripted.ScriptedEngine()
    bare = await feedback.analyze_content(llm, question="Tell me about a project?", competency="B",
                                          transcript=NO_RESULT, low=[])
    assert bare["status"] == "fix" and bare["tag"] == "no_result" and bare["severity"] == 3
    good = await feedback.analyze_content(llm, question="Tell me about a project?", competency="B",
                                          transcript=WITH_RESULT, low=[])
    assert good["status"] == "ok"
    said = "I am working on this team since five years and I like it. We shipped on time."
    layer = await feedback.analyze_language(llm, said, level="B1", known=[], low=[])
    item = layer["items"][0]
    assert item["original"] == "since five years" and item["better"] == ["for five years"] and layer["status"] == "fix"
    clean = await feedback.analyze_language(llm, "I run the checkout team and I like the work.", level="B1",
                                            known=[], low=[])
    assert clean["items"] == [] and clean["status"] == "ok"
    english = await feedback.analyze_language(llm, "I am agree with you about this plan.", level="B1", known=[],
                                              low=[], english_track=True)
    assert english["items"][0]["better"] == ["I agree"] and english["phrase_to_keep"]["phrase"] == "I am agree with"


async def test_questions_are_anchored_and_debrief_and_suggestion_work():
    llm = scripted.ScriptedEngine()
    questions = await planner.generate_questions(llm, PROFILE, JOB)
    assert len(questions) >= 3 and all(q.source == "cv_jd" and len(q.follow_ups) >= 2 for q in questions)
    records = []
    for n, answer in enumerate([NO_RESULT] * 3):
        records.append({"id": f"fb{n}", "competency": "B", "answer": answer, "layers": {
            "content": await feedback.analyze_content(llm, question="q", competency="B", transcript=answer, low=[]),
            "delivery": feedback.delivery_layer(answer, None)}})
    result = await feedback.debrief(llm, records, layer_order="content-first")
    assert result["source"] == "model" and result["weak_spots"][0]["tag"] == "no_result"
    assert result["weak_spots"][0]["evidence"] == ["q1", "q2", "q3"]
    tip = await feedback.suggest_answer(llm, question="Tell me about a project?", history=[], profile=PROFILE, jd=JOB,
                                        level="B1")
    assert tip["answer"] and tip["points"]
    better = await feedback.stronger_version(llm, question="q", missing=["no_result"], transcript=NO_RESULT)
    assert "[your number]" in better["rewrite"] and better["placeholders"] == ["[your number]"]


async def test_plain_replies_and_forced_failures():
    llm = scripted.ScriptedEngine()
    turn = lambda text: {"role": "user", "content": f"<turn>{text}</turn>"}   # noqa: E731
    tutor = {"role": "system", "content": "You are Mike, an English practice partner."}
    first = await llm.complete([tutor, turn("I like my job a lot.")])
    second = await llm.complete([tutor, turn("I like my job a lot."), {"role": "assistant", "content": first},
                                 turn("It is about payments.")])
    assert first.endswith("?") and second != first
    check = await llm.complete([{"role": "system", "content": "a quick microphone check"}, {"role": "user", "content": "hi"}])
    assert "works" in check
    scripted.reset()
    scripted.configure(fail=["p2b"])
    try:
        with pytest.raises(EngineError) as raised:
            await feedback.analyze_language(llm, NO_RESULT, level="B1", known=[], low=[])
        assert raised.value.code == "e2e_failure"
        assert scripted.snapshot()["calls"]["p2b"] == 1
    finally:
        scripted.reset()


def test_from_schema_builds_a_valid_minimal_object():
    schema = content.schema("p4_drill")
    value = scripted.from_schema(schema)
    item = value["items"][0]
    assert item["type"] == "question" and item["layer"] == "content" and item["success_check"]
    assert scripted.kind_of(schema) == "p4" and scripted.kind_of(content.schema("p2b_language")) == "p2b"
    assert scripted.kind_of(content.schema("p5b_corrections")) == "p5b"
    assert scripted.kind_of(None) == "text"


# ---------- the seeded returning user ----------

def test_seed_makes_a_returning_user_with_weak_spots(e2e_client):
    made = e2e_client.post("/api/_e2e/seed", json={"fixture": "returning"}).json()
    assert len(made["sessions"]) == 3 and len(made["vacancies"]) == 2
    sessions = e2e_client.get("/api/sessions").json()["sessions"]
    assert [s["answers"] for s in sessions] == [3, 3, 3] and all(s["verdict"] for s in sessions)
    weak = e2e_client.get("/api/memory").json()["weak_spots"]
    assert weak[0]["tag"] == "no_result" and weak[0]["sessions"] == 3 and weak[0]["layer"] == "content"
    assert any(spot["layer"] == "language" for spot in weak)
    assert e2e_client.get("/api/profile").json()["text"].startswith("Alex Morgan")
    e2e_client.post("/api/_e2e/reset")
    assert e2e_client.get("/api/sessions").json()["sessions"] == []


async def test_scripted_first_question_quotes_a_duty_not_the_title():
    llm = scripted.ScriptedEngine()
    questions = await planner.generate_questions(llm, PROFILE, JOB)
    first = questions[0]
    assert first.anchor == "You will own the checkout experience"
    assert "Product Manager at Kestrel Pay" not in first.text
