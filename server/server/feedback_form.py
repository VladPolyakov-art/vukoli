"""In-app feedback (US-60, D102): the user's own message, sent to a form service only when they press Send.

What leaves the computer is built here and nowhere else, so the dialog can show it first:
  kind, message, rating (if given), email (if given), and, only when the box is ticked, `app` =
  "Vukoli <version> · <OS> · <engine label>". Answers, transcripts, the CV, jobs, paths, user names and keys are never
  read here. The service address comes from IC_FEEDBACK_URL (a Formspree-style endpoint: JSON POST, `Accept:
  application/json`) or, if the env is empty, from `config.FEEDBACK_URL`; with neither, nothing can be sent and the app
  offers Copy text and the GitHub issues link instead.

In test mode (IC_E2E=1) no request is made: sends are kept in `E2E["sent"]` (GET /api/_e2e/feedback) and a failure can
be switched on (POST /api/_e2e/feedback).
"""
from __future__ import annotations

import os
import platform
import re
from typing import Optional
from urllib.parse import urlparse

import httpx

from . import __version__, config
from .engines import DESCRIPTORS

ISSUES_URL = "https://github.com/VladPolyakov-art/vukoli/issues/new"
KINDS = ("idea", "problem", "other", "session")
TIMEOUT_S = 10
MESSAGE_MAX = 4000
EMAIL_MAX = 200
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Test mode state: what the stand-in service received, and what it should do next.
E2E: dict = {"configured": True, "fail": None, "sent": []}


def reset_e2e() -> None:
    E2E.update(configured=True, fail=None, sent=[])


class FeedbackError(Exception):
    """`code`: not_configured | network | service_error | bad_email | empty_message."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def service_url() -> str:
    """The form service address, or "" when none is set or it is not a web address."""
    url = os.getenv("IC_FEEDBACK_URL", "").strip() or config.FEEDBACK_URL.strip()
    parsed = urlparse(url)
    if parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        return url if parsed.netloc else ""
    return ""


def configured() -> bool:
    return bool(E2E["configured"]) if config.e2e_enabled() else bool(service_url())


def os_label() -> str:
    """"macOS 15.2", "Windows 11", "Linux 6.8": the system and its version, nothing about the machine or the user."""
    system = platform.system()
    if system == "Darwin":
        return f"macOS {platform.mac_ver()[0]}".strip()
    if system == "Windows":
        return f"Windows {platform.release()}".strip()
    if system == "Linux":
        return f"Linux {platform.release().split('-')[0]}".strip()
    return system or "Unknown system"


def engine_label(settings: dict | None = None) -> str:
    settings = settings or config.load_settings()
    descriptor = DESCRIPTORS.get(settings.get("engine", ""))
    return descriptor.name if descriptor else "Unknown engine"


def app_line(settings: dict | None = None) -> str:
    """The one line the "Attach app version, system and AI engine" box adds. Shown in the dialog before sending."""
    return f"Vukoli {__version__} · {os_label()} · {engine_label(settings)}"


def clean_email(email: Optional[str]) -> str:
    email = (email or "").strip()
    if not email:
        return ""
    if len(email) > EMAIL_MAX or not EMAIL_RE.match(email):
        raise FeedbackError("bad_email", "That email address doesn't look right.")
    return email


def build_payload(*, kind: str, message: str, rating: Optional[int], email: Optional[str], attach_meta: bool,
                  settings: dict | None = None) -> dict:
    """Exactly what is sent. A rating-only "session" note may have no message; every other kind needs one."""
    text = (message or "").strip()[:MESSAGE_MAX]
    if not text and not (kind == "session" and rating):
        raise FeedbackError("empty_message", "Write a message first.")
    payload: dict = {"kind": kind, "message": text}
    if rating:
        payload["rating"] = rating
    address = clean_email(email)
    if address:
        payload["email"] = address
    if attach_meta:
        payload["app"] = app_line(settings)
    return payload


async def send(payload: dict, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
    """POST the payload to the form service. Raises FeedbackError (not_configured, network, service_error)."""
    if config.e2e_enabled():
        if not E2E["configured"]:
            raise FeedbackError("not_configured", "Sending isn't set up in this copy of Vukoli.")
        if E2E["fail"] == "network":
            raise FeedbackError("network", "Couldn't reach the feedback service.")
        if E2E["fail"] == "service_error":
            raise FeedbackError("service_error", "The feedback service refused the message.")
        E2E["sent"].append(payload)
        return
    url = service_url()
    if not url:
        raise FeedbackError("not_configured", "Sending isn't set up in this copy of Vukoli.")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S, follow_redirects=False, transport=transport) as client:
            response = await client.post(url, json=payload, headers={"Accept": "application/json"})
    except httpx.HTTPError:
        raise FeedbackError("network", "Couldn't reach the feedback service.")
    if response.status_code // 100 != 2:
        raise FeedbackError("service_error", "The feedback service refused the message.")


# ---------- the counter behind "How did it go?" (D102) ----------

def count_session(session_id: str) -> int:
    """A session that reached its debrief was finished: +1 (the same session twice in a row counts once)."""
    settings = config.load_settings()
    if session_id and settings.get("sessions_counted_last") == session_id:
        return int(settings["sessions_finished"])
    updated = config.update_settings({"sessions_finished": int(settings["sessions_finished"]) + 1,
                                      "sessions_counted_last": session_id})
    return int(updated["sessions_finished"])
