"""Storage, settings, telemetry, documents and REST endpoints (isolated data folder)."""
from __future__ import annotations

import base64
import io
import json

import pytest
from fastapi.testclient import TestClient

from server import DATA_VERSION, config, content, documents, memory, storage, telemetry

SAME = {"Origin": "http://testserver"}
OTHER = {"Origin": "https://other.example"}


@pytest.fixture
def client():
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def session_record(text="exact original words"):
    return {"id": storage.new_id("s-"), "mode": "interview", "started_at": storage.now_iso(), "title": "Practice",
            "transcript": [{"role": "model", "text": "Tell me about a project?"}, {"role": "user", "text": text}],
            "feedback": [], "debrief": None}


def test_same_second_sessions_do_not_overwrite():
    a, b = session_record(), session_record()
    storage.save_session(a)
    storage.save_session(b)
    assert a["id"] != b["id"] and len(storage.list_records("sessions")) == 2
    saved = storage.read_record("sessions", a["id"])
    assert saved["data_version"] == DATA_VERSION
    md = storage.record_path("sessions", a["id"]).with_suffix(".md").read_text()
    assert "exact original words" in md and "**Mike:**" in md


def test_empty_history_has_no_fabricated_memory():
    assert memory.summary() == {"sessions_considered": 0, "weak_spots": [], "total_sessions": 0}
    assert memory.past_weak_spots_text() == "none"


def test_trash_restore_and_conflicts(client):
    record = session_record()
    storage.save_session(record)
    sid = record["id"]
    assert client.delete(f"/api/sessions/{sid}", headers=OTHER).status_code == 403
    deleted = client.delete(f"/api/sessions/{sid}", headers=SAME)
    assert deleted.status_code == 200
    assert client.get("/api/sessions").json()["sessions"] == []
    assert client.delete(f"/api/sessions/{sid}", headers=SAME).status_code == 404
    trash_id = client.get("/api/sessions/trash").json()["items"][0]["trash_id"]
    storage.save_session({**record, "transcript": []})                  # the id is taken again
    endpoint = f"/api/sessions/trash/{trash_id}/restore"
    assert client.post(endpoint, headers=SAME).status_code == 409
    storage.record_path("sessions", sid).unlink()
    assert client.post(endpoint, headers=SAME).status_code == 200
    assert client.get(f"/api/sessions/{sid}").json()["transcript"][1]["text"] == "exact original words"
    assert client.post("/api/sessions/trash/unknown-id/restore", headers=SAME).status_code == 404
    assert client.get("/api/sessions/..%2F.env").status_code == 404


def test_purge_from_trash_is_permanent_and_checked(client):
    record = session_record()
    storage.save_session(record)
    sid = record["id"]
    other = {**session_record(), "id": "keep-me"}
    storage.save_session(other)
    client.delete(f"/api/sessions/{sid}", headers=SAME)
    trash_id = client.get("/api/sessions/trash").json()["items"][0]["trash_id"]
    trashed = storage.data_dir() / "trash" / "sessions"
    assert (trashed / f"{trash_id}.json").exists()
    endpoint = f"/api/sessions/trash/{trash_id}"
    assert client.delete(endpoint, headers=OTHER).status_code == 403          # origin-checked like restore
    assert (trashed / f"{trash_id}.json").exists()
    assert client.delete(endpoint, headers=SAME).status_code == 200
    assert not list(trashed.glob(f"{trash_id}.*"))                            # the record and its Markdown are gone
    assert client.get("/api/sessions/trash").json()["items"] == []
    assert client.delete(endpoint, headers=SAME).status_code == 404           # already gone
    assert client.post(f"{endpoint}/restore", headers=SAME).status_code == 404
    assert client.delete("/api/sessions/trash/not.an.id", headers=SAME).status_code == 404
    assert client.get(f"/api/sessions/{other['id']}").status_code == 200       # live records untouched


def test_settings_mask_keys_and_validate(client):
    response = client.post("/api/settings", headers=SAME,
                           json={"engine": "openai_compatible",
                                 "openai_compatible": {"base_url": "http://localhost:1234/v1", "api_key": "sk-test-123",
                                                       "model": "m"}})
    assert response.status_code == 200
    assert "sk-test-123" not in response.text and response.json()["openai_compatible"]["has_api_key"] is True
    assert "sk-test-123" not in client.get("/api/settings").text
    assert config.load_settings()["openai_compatible"]["api_key"] == "sk-test-123"
    assert client.post("/api/settings", headers=SAME, json={"engine": "nope"}).status_code == 422
    assert client.post("/api/settings", headers=SAME, json={"unknown": 1}).status_code == 422
    assert client.post("/api/settings", headers=OTHER, json={"level": "B2"}).status_code == 403
    stored = json.loads((config.data_dir() / "settings.json").read_text())
    assert stored["data_version"] == DATA_VERSION


def test_telemetry_off_by_default_and_local_on_opt_in(client):
    assert client.get("/api/telemetry").json()["opt_in"] is False
    assert telemetry.record("turn", total_ms=900) is False
    assert not telemetry.path().exists()
    assert client.post("/api/telemetry", headers=SAME, json={"opt_in": True}).json()["opt_in"] is True
    assert telemetry.record("turn", total_ms=900, transcript="secret words") is True
    line = json.loads(telemetry.path().read_text().splitlines()[0])
    assert line["total_ms"] == 900 and "transcript" not in line and line["event"] == "turn"
    assert client.get("/api/telemetry").json()["remote"] is False


def test_question_bank_parses_40_questions(client):
    bank = content.question_bank()
    assert len(bank) == 40 and all(len(q.follow_ups) >= 2 for q in bank)
    assert client.get("/api/question-bank").json()["questions"][0]["id"] == "A1"


def test_documents_read_docx_and_txt():
    from docx import Document
    doc = Document()
    doc.add_paragraph("Product designer with eight years of experience in fintech and healthcare. " * 3)
    buffer = io.BytesIO()
    doc.save(buffer)
    text = documents.read_file("cv.docx", base64.b64encode(buffer.getvalue()).decode())
    assert "fintech" in text
    txt = documents.read_file("cv.txt", base64.b64encode(("Hello world. " * 20).encode()).decode())
    assert txt.startswith("Hello world.")
    with pytest.raises(documents.DocumentError):
        documents.read_file("cv.exe", base64.b64encode(b"x" * 200).decode())


def test_url_guard_rejects_bad_schemes_and_private_hosts():
    for url in ("file:///etc/passwd", "ftp://example.com/a", "http://127.0.0.1:8000/api/settings",
                "http://localhost/x", "http://192.168.1.10/jd", "http://169.254.169.254/latest/meta-data"):
        with pytest.raises(documents.DocumentError):
            documents.check_url(url)


def test_profile_and_vacancy_endpoints(client):
    assert client.put("/api/profile", headers=SAME, json={"text": "My CV text"}).json()["text"] == "My CV text"
    created = client.post("/api/vacancies", headers=SAME, json={"title": "Designer", "text": "We are hiring. " * 10})
    assert created.status_code == 200
    vid = created.json()["id"]
    assert client.get("/api/vacancies").json()["vacancies"][0]["id"] == vid
    assert client.post("/api/vacancies", headers=SAME, json={"text": "short"}).status_code == 422
    assert client.delete(f"/api/vacancies/{vid}", headers=SAME).status_code == 200


def test_profile_holds_several_files_and_a_note(client):
    import base64
    up = lambda name, text, **kw: client.post("/api/profile/upload", headers=SAME, json={
        "name": name, "data": base64.b64encode((text + " More about my work. " * 8).encode()).decode(), **kw})
    first = up("cv.txt", "Product designer, 6 years in fintech.").json()
    assert [f["name"] for f in first["files"]] == ["cv.txt"]
    both = up("portfolio.md", "Case: checkout redesign.").json()
    assert [f["name"] for f in both["files"]] == ["cv.txt", "portfolio.md"]
    assert "fintech" in both["text"] and "checkout" in both["text"]
    swapped = up("cv-2026.txt", "Lead designer now.", replace=both["files"][0]["id"]).json()
    assert [f["name"] for f in swapped["files"]] == ["cv-2026.txt", "portfolio.md"] and "fintech" not in swapped["text"]
    noted = client.put("/api/profile", headers=SAME, json={"text": "I also mentor juniors.", "source": "paste"}).json()
    assert noted["note"] == "I also mentor juniors." and len(noted["files"]) == 2 and noted["text"].startswith("I also mentor")
    left = client.delete(f"/api/profile/files/{swapped['files'][1]['id']}", headers=SAME).json()
    assert [f["name"] for f in left["files"]] == ["cv-2026.txt"]
    assert client.delete("/api/profile", headers=SAME).status_code == 200
    assert client.get("/api/profile").json()["files"] == []


def test_profile_v1_reads_as_one_file():
    storage.write_json(storage.profile_path(), {"v": 1, "text": "Old CV", "source": "file:old.pdf", "updated": "2026-01-01T00:00:00Z"})
    view = storage.read_profile()
    assert view["text"] == "## old.pdf\nOld CV" and view["files"][0]["name"] == "old.pdf" and view["note"] == ""
    added = storage.add_profile_file("new.txt", "New CV")
    assert [f["name"] for f in added["files"]] == ["old.pdf", "new.txt"]


def test_known_terms():
    terms = documents.known_terms("Built dashboards in Figma and JavaScript for HubSpot. The team grew.")
    assert {"Figma", "HubSpot"} <= set(terms) and "The" not in terms


def test_session_list_names_the_first_question_and_short_sessions(client):
    record = session_record()
    record["questions"] = [{"id": "A5", "text": "Where do you want to be in two years?"}, {"id": "B1", "text": "Tell me about a conflict."}]
    record["transcript"][0].update({"kind": "question", "question_id": "A5"})
    record["debrief"] = {"verdict": "This session was too short for a full debrief.", "too_short": True}
    storage.save_session(record)
    row = client.get("/api/sessions").json()["sessions"][0]
    assert row["first_question"] == "Where do you want to be in two years?"
    assert row["too_short"] is True and row["planned"] == 2


def test_posting_title_skips_board_headers():
    from server.api import posting_title
    assert posting_title("About the job\n\nSenior Product Designer at Kestrel Pay\nWe build...") == "Kestrel Pay · Senior Product Designer"
    assert posting_title("Job description:\n") == "Job posting"


def test_session_rename_and_archive(client):
    record = storage.save_session(session_record())
    sid = record["id"]
    assert client.patch(f"/api/sessions/{sid}", json={"title": "x"}, headers=OTHER).status_code == 403
    renamed = client.patch(f"/api/sessions/{sid}", json={"title": "  Kestrel   Pay · round 2 "}, headers=SAME).json()
    assert renamed["title"] == "Kestrel Pay · round 2"
    assert client.patch(f"/api/sessions/{sid}", json={"title": "   "}, headers=SAME).status_code == 422
    assert client.patch(f"/api/sessions/{sid}", json={"archived": True}, headers=SAME).json()["archived"] is True
    assert client.get("/api/sessions").json()["sessions"][0]["archived"] is True
    client.patch(f"/api/sessions/{sid}", json={"archived": False}, headers=SAME)
    assert client.get("/api/sessions").json()["sessions"][0]["archived"] is False
    assert client.patch("/api/sessions/s-missing", json={"archived": True}, headers=SAME).status_code == 404


def test_name_setting_and_greeting(client):
    from server import content
    saved = client.post("/api/settings", json={"name": "  Alex \n Morgan  "}, headers=SAME).json()
    assert saved["name"] == "Alex Morgan"
    assert content.copy("english_opening", name="Alex").startswith("Hi Alex, I'm Mike")
    assert content.copy("english_opening").startswith("Hi, I'm Mike")
    assert "Alex" in content.name_line("Alex") and content.name_line("") == ""


def test_voice_check_recognises_and_replies(client, monkeypatch, fake_llm):
    """US-02 AC2: recognised text and Mike's reply; text from the browser's recogniser skips the server STT."""
    from server import engines, stt
    llm = fake_llm({"text": "I hear you, Alex. Everything works."})
    monkeypatch.setattr(engines, "make_llm", lambda settings=None, engine_id=None, voice=False: llm)
    client.post("/api/settings", json={"name": "Alex"}, headers=SAME)
    typed = client.post("/api/check/voice", json={"text": "Hi Mike"}, headers=SAME).json()
    assert typed["ok"] and typed["heard"] == "Hi Mike" and typed["reply"].startswith("I hear you")
    assert typed["audio"] is None                                   # no Kokoro in tests: text-only reply
    assert "Alex" in llm.calls[-1]["messages"][0]["content"]

    class Heard:
        available = True
        def transcribe(self, pcm, words=True):
            return stt.Transcript(text="Hello there")
    monkeypatch.setattr(stt, "get_stt", lambda settings: Heard())
    pcm = base64.b64encode(b"\0\0" * 16000).decode()
    assert client.post("/api/check/voice", json={"audio": pcm}, headers=SAME).json()["heard"] == "Hello there"
    silent = client.post("/api/check/voice", json={"text": "  "}, headers=SAME).json()
    assert not silent["ok"] and silent["code"] == "not_heard"
    assert client.post("/api/check/voice", json={"text": "hi"}, headers=OTHER).status_code == 403


def test_dictation_transcribes_one_clip_and_keeps_nothing(client, monkeypatch):
    """D90: the chat's mic sends one clip; the text comes back from the local STT."""
    from server import stt as stt_module

    class FakeSTT:
        available = True
        seen: list[bytes] = []

        def transcribe(self, pcm, words=True):
            FakeSTT.seen.append(pcm)
            assert words is False                                   # text only: no word timing for dictation
            return stt_module.Transcript(text="I have a behavioural round", duration_s=len(pcm) / 32000, backend="fake")

    monkeypatch.setattr(stt_module, "get_stt", lambda settings: FakeSTT())
    pcm = b"\x01\x00" * 16000                                       # one second
    before = sorted(p.name for p in config.data_dir().rglob("*"))
    r = client.post("/api/stt/transcribe", headers=SAME, json={"data": base64.b64encode(pcm).decode()})
    assert r.json() == {"text": "I have a behavioural round", "duration_s": 1.0} and FakeSTT.seen == [pcm]
    assert sorted(p.name for p in config.data_dir().rglob("*")) == before
    assert client.post("/api/stt/transcribe", headers=OTHER, json={"data": ""}).status_code == 403
    assert client.post("/api/stt/transcribe", headers=SAME, json={"data": "not base64!"}).json()["detail"]["code"] == "bad_audio"
    too_long = base64.b64encode(b"\x00\x00" * 16000 * 121).decode()
    assert client.post("/api/stt/transcribe", headers=SAME, json={"data": too_long}).status_code == 422


def test_dictation_without_local_stt_says_so(client, monkeypatch):
    from server import stt as stt_module
    monkeypatch.setattr(stt_module, "get_stt", lambda settings: stt_module.STT(None))
    r = client.post("/api/stt/transcribe", headers=SAME, json={"data": ""})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "stt_unavailable"


def test_session_naming_rule():
    from server.storage import display_title, job_name, session_title
    assert job_name("Product Manager at Kestrel Pay") == "Kestrel Pay · Product Manager"
    assert job_name("Kestrel Pay - Product Manager") == "Kestrel Pay · Product Manager"
    assert job_name("Kestrel Pay · Product Manager") == "Kestrel Pay · Product Manager"
    assert session_title("interview", "Product Manager at Kestrel Pay") == "Kestrel Pay · Product Manager"
    assert session_title("interview", "") == "General questions"
    assert session_title("english", "Kestrel Pay · PM") == "English practice"
    assert session_title("interview", "Kestrel Pay · PM", drill=True) == "Drill · Kestrel Pay · PM"
    assert session_title("interview", "", drill=True) == "Drill · General questions"
    # records saved before 13 keep their stored title but are shown by the new rule
    assert display_title("Interview practice · Kestrel Pay · Product Manager") == "Kestrel Pay · Product Manager"
    assert display_title("Interview practice") == "General questions"
    assert display_title("English practice") == "English practice"
    assert display_title("My own name") == "My own name"
