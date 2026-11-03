"""US-60 (D102): in-app feedback. The payload is exactly what the dialog shows; nothing else leaves; failures are named."""
from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from server import __version__, config, feedback_form


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.delenv("IC_E2E", raising=False)
    monkeypatch.delenv("IC_FEEDBACK_URL", raising=False)
    monkeypatch.setattr(config, "FEEDBACK_URL", "")     # the built-in form is real: tests never reach it
    monkeypatch.setenv("IC_WEB_DIST", str(tmp_path / "no-web"))
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Any send that is not routed through `serving()` fails here instead of reaching a real form service."""
    async def refuse(*args, **kwargs):
        raise AssertionError("a test tried to reach the real feedback service")
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", refuse)


def test_built_in_form_is_https():
    assert feedback_form.urlparse(config.FEEDBACK_URL).scheme == "https"


@pytest.fixture
def e2e_client(monkeypatch, tmp_path):
    monkeypatch.setenv("IC_E2E", "1")
    monkeypatch.setenv("IC_WEB_DIST", str(tmp_path / "no-web"))
    feedback_form.reset_e2e()
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c
    feedback_form.reset_e2e()


REAL_SEND = feedback_form.send


def serving(monkeypatch, handler):
    """The real send(), with the network replaced by `handler` (an httpx.MockTransport function)."""
    real = REAL_SEND
    transport = httpx.MockTransport(handler)

    async def send(payload, **_):
        await real(payload, transport=transport)
    monkeypatch.setattr(feedback_form, "send", send)


# ---------- the payload ----------

def test_payload_has_only_what_the_dialog_shows():
    payload = feedback_form.build_payload(kind="idea", message="  Add a timer.  ", rating=None, email=None, attach_meta=False)
    assert payload == {"kind": "idea", "message": "Add a timer."}


def test_payload_with_everything_ticked():
    payload = feedback_form.build_payload(kind="problem", message="It stops.", rating=4, email=" me@example.com ", attach_meta=True)
    assert set(payload) == {"kind", "message", "rating", "email", "app"}
    assert payload["email"] == "me@example.com" and payload["rating"] == 4
    assert payload["app"] == feedback_form.app_line()


def test_app_line_is_version_system_engine_and_nothing_personal(monkeypatch):
    monkeypatch.setattr(feedback_form.platform, "system", lambda: "Darwin")
    monkeypatch.setattr(feedback_form.platform, "mac_ver", lambda: ("15.2", ("", "", ""), ""))
    line = feedback_form.app_line({"engine": "ollama"})
    assert line == f"Vukoli {__version__} · macOS 15.2 · Ollama (local)"
    for private in (str(config.data_dir()), "/Users", "\\Users"):
        assert private not in line


def test_no_session_text_or_ids_reach_the_payload(isolated_data):
    config.update_settings({"name": "Alex Morgan", "openai_compatible": {"api_key": "sk-secret"}})
    payload = feedback_form.build_payload(kind="session", message="", rating=5, email=None, attach_meta=True)
    text = json.dumps(payload)
    assert "Alex" not in text and "sk-secret" not in text and "session_id" not in text
    assert payload == {"kind": "session", "message": "", "rating": 5, "app": feedback_form.app_line()}


def test_a_message_is_required_except_for_a_rating_alone():
    with pytest.raises(feedback_form.FeedbackError) as exc:
        feedback_form.build_payload(kind="idea", message="   ", rating=None, email=None, attach_meta=False)
    assert exc.value.code == "empty_message"
    with pytest.raises(feedback_form.FeedbackError):
        feedback_form.build_payload(kind="session", message="", rating=None, email=None, attach_meta=False)
    assert feedback_form.build_payload(kind="session", message="", rating=3, email=None, attach_meta=False)["rating"] == 3


def test_bad_email_is_refused():
    with pytest.raises(feedback_form.FeedbackError) as exc:
        feedback_form.build_payload(kind="idea", message="Hi", rating=None, email="not-an-address", attach_meta=False)
    assert exc.value.code == "bad_email"


def test_service_address_must_be_https_or_local(monkeypatch):
    monkeypatch.setattr(config, "FEEDBACK_URL", "")
    monkeypatch.setenv("IC_FEEDBACK_URL", "http://example.com/f/abc")
    assert feedback_form.service_url() == ""
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    assert feedback_form.service_url() == "https://formspree.io/f/abc"
    monkeypatch.setenv("IC_FEEDBACK_URL", "http://127.0.0.1:9/f/abc")
    assert feedback_form.service_url() == "http://127.0.0.1:9/f/abc"
    monkeypatch.setenv("IC_FEEDBACK_URL", "")
    assert feedback_form.configured() is False


# ---------- sending ----------

def test_send_posts_json_with_accept_header(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["accept"], seen["body"] = str(request.url), request.headers["accept"], json.loads(request.content)
        return httpx.Response(200, json={"ok": True})
    serving(monkeypatch, handler)
    res = client.post("/api/feedback", json={"kind": "idea", "message": "More drills", "attach_meta": False})
    assert res.status_code == 200 and res.json() == {"sent": True}
    assert seen == {"url": "https://formspree.io/f/abc", "accept": "application/json",
                    "body": {"kind": "idea", "message": "More drills"}}


def test_metadata_only_when_ticked(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    bodies = []
    serving(monkeypatch, lambda request: (bodies.append(json.loads(request.content)), httpx.Response(200, json={}))[1])
    client.post("/api/feedback", json={"kind": "problem", "message": "A", "attach_meta": False})
    client.post("/api/feedback", json={"kind": "problem", "message": "A", "attach_meta": True})
    assert "app" not in bodies[0]
    assert bodies[1]["app"] == client.get("/api/feedback/config").json()["app_line"]


def test_the_session_id_is_not_forwarded(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    bodies = []
    serving(monkeypatch, lambda request: (bodies.append(json.loads(request.content)), httpx.Response(200, json={}))[1])
    client.post("/api/feedback", json={"kind": "session", "message": "", "rating": 4, "session_id": "s-20261103-1"})
    assert bodies == [{"kind": "session", "message": "", "rating": 4}]


def test_not_configured(client):
    res = client.post("/api/feedback", json={"kind": "idea", "message": "Hi"})
    assert res.status_code == 409 and res.json()["detail"]["code"] == "not_configured"
    assert client.get("/api/feedback/config").json()["configured"] is False


def test_service_error_and_network_error(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    serving(monkeypatch, lambda request: httpx.Response(500, json={"error": "x"}))
    res = client.post("/api/feedback", json={"kind": "idea", "message": "Hi"})
    assert res.status_code == 502 and res.json()["detail"]["code"] == "service_error"

    def offline(request):
        raise httpx.ConnectError("no route", request=request)
    serving(monkeypatch, offline)
    res = client.post("/api/feedback", json={"kind": "idea", "message": "Hi"})
    assert res.status_code == 502 and res.json()["detail"]["code"] == "network"


def test_a_redirect_is_not_followed(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    serving(monkeypatch, lambda request: httpx.Response(302, headers={"location": "https://elsewhere.example/"}))
    res = client.post("/api/feedback", json={"kind": "idea", "message": "Hi"})
    assert res.json()["detail"]["code"] == "service_error"


def test_validation_and_origin(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    assert client.post("/api/feedback", json={"kind": "idea", "message": ""}).json()["detail"]["code"] == "empty_message"
    assert client.post("/api/feedback", json={"kind": "idea", "message": "Hi", "email": "nope"}).json()["detail"]["code"] == "bad_email"
    assert client.post("/api/feedback", json={"kind": "rant", "message": "Hi"}).status_code == 422
    assert client.post("/api/feedback", json={"kind": "session", "message": "", "rating": 6}).status_code == 422
    assert client.post("/api/feedback", json={"kind": "idea", "message": "Hi", "transcript": "x"}).status_code == 422
    res = client.post("/api/feedback", json={"kind": "idea", "message": "Hi"}, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403 and res.json()["detail"]["code"] == "origin_not_allowed"
    res = client.post("/api/feedback/session-finished", json={"session_id": "s-1"}, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403


def test_config_endpoint(client, monkeypatch):
    monkeypatch.setenv("IC_FEEDBACK_URL", "https://formspree.io/f/abc")
    body = client.get("/api/feedback/config").json()
    assert body["configured"] is True
    assert body["issues_url"] == "https://github.com/VladPolyakov-art/vukoli/issues/new"
    assert body["app_line"].startswith(f"Vukoli {__version__} · ")


# ---------- the counter and the switch ----------

def test_counter_counts_a_session_once_in_a_row(client):
    assert client.post("/api/feedback/session-finished", json={"session_id": "s-1"}).json() == {"count": 1, "ask": True, "configured": False}
    assert client.post("/api/feedback/session-finished", json={"session_id": "s-1"}).json()["count"] == 1
    assert client.post("/api/feedback/session-finished", json={"session_id": "s-2"}).json()["count"] == 2
    assert client.get("/api/settings").json()["sessions_finished"] == 2


def test_ask_switch_is_a_setting(client):
    assert client.get("/api/settings").json()["feedback_ask"] is True
    assert client.post("/api/settings", json={"feedback_ask": False}).json()["feedback_ask"] is False
    assert client.post("/api/feedback/session-finished", json={"session_id": "s-1"}).json()["ask"] is False
    assert client.post("/api/settings", json={"sessions_finished": 99}).status_code == 422     # the counter is not editable


# ---------- test mode ----------

def test_e2e_stand_in_keeps_what_was_sent_and_can_fail(e2e_client):
    assert e2e_client.get("/api/feedback/config").json()["configured"] is True
    assert e2e_client.post("/api/feedback", json={"kind": "idea", "message": "One", "attach_meta": True}).json() == {"sent": True}
    sent = e2e_client.get("/api/_e2e/feedback").json()["sent"]
    assert len(sent) == 1 and sent[0]["message"] == "One" and sent[0]["app"].startswith("Vukoli ")

    e2e_client.post("/api/_e2e/feedback", json={"fail": "network"})
    res = e2e_client.post("/api/feedback", json={"kind": "idea", "message": "Two"})
    assert res.status_code == 502 and res.json()["detail"]["code"] == "network"
    e2e_client.post("/api/_e2e/feedback", json={"fail": "service_error"})
    assert e2e_client.post("/api/feedback", json={"kind": "idea", "message": "Two"}).json()["detail"]["code"] == "service_error"
    e2e_client.post("/api/_e2e/feedback", json={"clear_fail": True})
    assert e2e_client.post("/api/feedback", json={"kind": "idea", "message": "Three"}).status_code == 200
    assert [m["message"] for m in e2e_client.get("/api/_e2e/feedback").json()["sent"]] == ["One", "Three"]

    e2e_client.post("/api/_e2e/feedback", json={"configured": False})
    assert e2e_client.get("/api/feedback/config").json()["configured"] is False
    assert e2e_client.post("/api/feedback", json={"kind": "idea", "message": "Four"}).json()["detail"]["code"] == "not_configured"

    e2e_client.post("/api/_e2e/reset")
    assert e2e_client.get("/api/_e2e/feedback").json() == {"configured": True, "fail": None, "sent": []}


def test_e2e_counter_can_be_set(e2e_client):
    e2e_client.post("/api/_e2e/feedback", json={"sessions_finished": 5})
    assert e2e_client.post("/api/feedback/session-finished", json={"session_id": "s-9"}).json()["count"] == 6


def test_stand_in_routes_do_not_exist_without_the_flag(client):
    assert client.get("/api/_e2e/feedback").status_code == 404
    assert client.post("/api/_e2e/feedback", json={}).status_code == 404
