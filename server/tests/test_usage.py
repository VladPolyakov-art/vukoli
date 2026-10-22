"""D88: requests per engine, the plan's own limit, and "sessions left"."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import time

import pytest

from server import usage
from server.engines import antigravity_cli, claude_cli, codex_cli
from server.engines.base import EngineError
from tests.test_engines import fake_agy, fake_codex


def claude_limit(five_hour: float, week: float, status: str = "allowed", resets: float | None = None) -> dict:
    resets = resets or time.time() + 3600
    return {"type": "rate_limit_event", "rate_limit_info": {"status": status, "resetsAt": resets, "unifiedWindows": {
        "five_hour": {"utilization": five_hour, "resetsAt": resets},
        "seven_day": {"utilization": week, "resetsAt": resets + 86400}}}}


def test_requests_are_counted_per_engine_and_per_session():
    usage.count("antigravity_cli")
    meter = usage.start_session("antigravity_cli")
    usage.count("antigravity_cli")
    usage.count("antigravity_cli")
    assert meter["requests"] == 2
    assert usage.requests_since("antigravity_cli", time.time() - 60) == 3
    assert usage.requests_since("codex_cli", 0) == 0
    entry = usage.finish_session(meter)
    assert entry == {"engine": "antigravity_cli", "requests": 2}
    saved = json.loads(usage._path().read_text())
    assert "text" not in json.dumps(saved) and saved["sessions"][-1]["requests"] == 2    # numbers only


async def test_week_and_day_counts_for_engines_without_a_published_limit():
    for _ in range(3):
        usage.count("antigravity_cli")
    block = await usage.limits_for("antigravity_cli")
    assert block == {"engine": "antigravity_cli", "kind": "count", "period": "week", "requests": 3}
    usage.count("gemini_live")
    day = await usage.limits_for("gemini_live")
    assert day["kind"] == "count" and day["period"] == "day" and day["requests"] == 1
    resets = dt.datetime.fromisoformat(day["resets_at"])
    from zoneinfo import ZoneInfo
    local = resets.astimezone(ZoneInfo("America/Los_Angeles"))
    assert (local.hour, local.minute) == (0, 0) and resets.timestamp() > time.time()   # midnight Pacific


async def test_claude_limit_comes_from_its_replies():
    assert (await usage.limits_for("claude_cli"))["kind"] == "pending"        # nothing until Vukoli's first request
    assert usage.claude_event(claude_limit(0.28, 0.04)) == "allowed"
    block = await usage.limits_for("claude_cli")
    assert block["kind"] == "percent"
    assert [(w["id"], w["used_percent"], w["stale"]) for w in block["windows"]] == [
        ("five_hour", 28.0, False), ("seven_day", 4.0, False)]
    assert block["estimate"] is None                                         # no session measured yet
    usage.claude_event(claude_limit(0.5, 0.1, resets=time.time() - 10))
    block = await usage.limits_for("claude_cli")
    assert block["windows"][0]["stale"] is True                              # the 5-hour window has reset since


def test_sessions_left_from_what_past_sessions_used():
    for before, after in ((10.0, 12.0), (12.0, 14.0)):                       # 2 % per 10-request session
        meter = usage.start_session("claude_cli")
        for _ in range(10):
            usage.count("claude_cli")
        usage.note_limit("claude_cli", "", [{"id": "five_hour", "used_percent": before, "resets_at": 9e9}])
        usage.note_limit("claude_cli", "", [{"id": "five_hour", "used_percent": after, "resets_at": 9e9}])
        assert usage.finish_session(meter)["windows"] == [{"id": "five_hour", "before": before, "after": after}]
    assert usage.estimate("claude_cli", [{"id": "five_hour", "used_percent": 14.0}]) == {
        "sessions": 43, "at_least": False, "window": "five_hour"}                  # 86 % left ÷ 2 % a session


def test_sessions_left_is_a_lower_bound_when_the_counter_did_not_move():
    meter = usage.start_session("codex_cli")
    for _ in range(10):
        usage.count("codex_cli")
    usage.note_limit("codex_cli", "free", [{"id": "month", "used_percent": 2, "resets_at": 9e9}])
    usage.note_limit("codex_cli", "free", [{"id": "month", "used_percent": 2, "resets_at": 9e9}])
    usage.finish_session(meter)
    # Under 1 % per 10 requests → at least 98 sessions of 10 requests.
    assert usage.estimate("codex_cli", [{"id": "month", "used_percent": 2}]) == {
        "sessions": 98, "at_least": True, "window": "month"}


def test_a_reset_during_the_session_is_not_counted_as_used():
    meter = usage.start_session("claude_cli")
    usage.note_limit("claude_cli", "", [{"id": "five_hour", "used_percent": 90.0, "resets_at": 100}])
    usage.note_limit("claude_cli", "", [{"id": "five_hour", "used_percent": 3.0, "resets_at": 200}])
    assert "windows" not in usage.finish_session(meter)


def fake_codex_server(tmp_path, used: int = 2):
    """A stand-in `codex app-server`: answers initialize and account/rateLimits/read on stdin."""
    fake = tmp_path / "codex-server"
    reply = {"rateLimits": {"primary": {"usedPercent": used, "windowDurationMins": 43200, "resetsAt": 9_000_000_000},
                            "secondary": None, "planType": "free"}}
    fake.write_text(f"""#!/usr/bin/env python3
import json, sys
open("{tmp_path}/server-args", "w").write(" ".join(sys.argv[1:]))
for line in sys.stdin:
    m = json.loads(line)
    if m.get("method") == "initialize":
        print(json.dumps({{"id": m["id"], "result": {{}}}}), flush=True)
    elif m.get("method") == "account/rateLimits/read":
        print(json.dumps({{"id": m["id"], "result": json.loads({json.dumps(json.dumps(reply))})}}), flush=True)
""")
    fake.chmod(0o755)
    return str(fake)


async def test_codex_limit_is_read_from_its_app_server(tmp_path):
    binary = fake_codex_server(tmp_path)
    block = await usage.limits_for("codex_cli", binary)
    assert (tmp_path / "server-args").read_text() == "app-server"           # no `exec`: no model request
    assert block["kind"] == "percent" and block["plan"] == "free"
    assert block["windows"] == [{"id": "month", "used_percent": 2.0, "resets_at": "2255-03-14T16:00:00+00:00",
                                 "stale": False}]


async def test_codex_limit_unreadable_shows_nothing(tmp_path):
    broken = tmp_path / "codex-broken"
    broken.write_text("#!/bin/sh\nexit 1\n")
    broken.chmod(0o755)
    assert await usage.limits_for("codex_cli", str(broken)) == {"engine": "codex_cli", "kind": "none"}


async def test_used_up_limits_say_so_for_each_engine(tmp_path):
    agy = fake_agy(tmp_path, signed_in=True, lines=[
        {"event": "result", "result": {"status": "ERROR", "error": "RESOURCE_EXHAUSTED: quota exceeded"}}])
    with pytest.raises(EngineError) as exc:
        await antigravity_cli.AntigravityCLIEngine(binary=agy).complete([{"role": "user", "content": "Hi"}])
    assert exc.value.code == "rate_limited" and "weekly" in exc.value.hint

    codex = fake_codex(tmp_path, signed_in=True, lines=[
        {"type": "turn.failed", "error": {"message": "You've hit your usage limit. Try again later."}}])
    with pytest.raises(EngineError) as exc:
        await codex_cli.CodexCLIEngine(binary=codex).complete([{"role": "user", "content": "Hi"}])
    assert exc.value.code == "rate_limited"

    claude = tmp_path / "claude"
    claude.write_text("#!/bin/sh\ncat >/dev/null\necho '" + json.dumps(claude_limit(1.0, 0.3, status="rejected"))
                      + "'\necho '" + json.dumps({"type": "result", "is_error": True, "result": "Limit reached"}) + "'\n")
    claude.chmod(0o755)
    with pytest.raises(EngineError) as exc:
        await claude_cli.ClaudeCLIEngine(binary=str(claude)).complete([{"role": "user", "content": "Hi"}])
    assert exc.value.code == "rate_limited"
    assert usage.requests_since("claude_cli", 0) == 1 and usage.requests_since("codex_cli", 0) == 1
    assert (await usage.limits_for("claude_cli"))["windows"][0]["used_percent"] == 100.0


def test_limits_route_only_for_a_ready_engine(monkeypatch):
    from fastapi.testclient import TestClient
    from server.main import create_app
    with TestClient(create_app()) as client:
        assert client.get("/api/engines/antigravity_cli/limits").json() == {"engine": "antigravity_cli", "kind": "none"}
        assert client.get("/api/engines/nope/limits").status_code == 404
