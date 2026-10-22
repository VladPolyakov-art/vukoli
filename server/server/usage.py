"""How much of the user's plan Vukoli uses (D88): requests sent to each engine, what the plan itself says about its
limit, and a rough "sessions left".

- Codex and Claude Code report their own limit: Codex through `codex app-server` (account/rateLimits/read, no model
  request), Claude Code in every reply (`rate_limit_event`). Vukoli shows those percents as they are.
- Antigravity and Gemini publish no number Vukoli can read, so it shows its own count: requests this week (Antigravity's
  free quota refreshes weekly) or today (Gemini's per-day limit resets at midnight Pacific time).
- "Sessions left" divides what is left by what past sessions used. Only an estimate: other apps share the same plan.

Kept in `usage.json` in the data folder: request times (8 days), the last limit each engine reported, and the last
sessions' numbers. No text of any request is kept.
"""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import threading
import time
from contextvars import ContextVar
from pathlib import Path

from . import config

KEEP_S = 8 * 86400
SESSIONS_KEPT = 30
CODEX_CACHE_S = 60.0
WINDOWS = {300: "five_hour", 10080: "week", 43200: "month"}     # Codex window lengths in minutes
COUNTED = {"antigravity_cli": "week", "gemini_live": "day"}     # engines Vukoli counts for, and over what

# The session a call belongs to: {"engine", "requests", "first", "last"} (first/last limit seen during it).
SESSION: ContextVar[dict | None] = ContextVar("vukoli_usage_session", default=None)
_lock = threading.Lock()
_codex_cache: dict = {}


def _path() -> Path:
    return config.data_dir() / "usage.json"


def _load() -> dict:
    try:
        data = json.loads(_path().read_text())
        if isinstance(data, dict):
            return data
    except (OSError, ValueError):
        pass
    return {}


def _save(data: dict) -> None:
    try:
        path = _path()
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data))
        tmp.replace(path)
    except OSError:
        pass


def count(engine: str) -> None:
    """One request sent to `engine` (call it where the request actually goes out)."""
    now = time.time()
    with _lock:
        data = _load()
        times = [t for t in data.get("requests", {}).get(engine, []) if t > now - KEEP_S]
        data.setdefault("requests", {})[engine] = [*times, round(now)]
        _save(data)
    current = SESSION.get()
    if current is not None:
        current["requests"] = current.get("requests", 0) + 1


def note_limit(engine: str, plan: str, windows: list[dict]) -> None:
    """What the plan reported: windows of {id, used_percent, resets_at (unix s), minutes?}."""
    snapshot = {"plan": plan, "windows": windows, "as_of": round(time.time())}
    with _lock:
        data = _load()
        data.setdefault("limits", {})[engine] = snapshot
        _save(data)
    current = SESSION.get()
    if current is not None and current.get("engine") == engine:
        current.setdefault("first", snapshot)
        current["last"] = snapshot


def start_session(engine: str) -> dict:
    """Count this session's requests from here on (tasks started after this inherit it)."""
    current = {"engine": engine, "requests": 0}
    SESSION.set(current)
    return current


def finish_session(current: dict) -> dict:
    """The session's numbers for its record, and kept for the estimate."""
    engine = current["engine"]
    entry: dict = {"engine": engine, "at": round(time.time()), "requests": current.get("requests", 0)}
    first, last = current.get("first"), current.get("last")
    if first and last:
        spent = []
        for w in last["windows"]:
            was = next((x for x in first["windows"] if x["id"] == w["id"]), None)
            if was and was.get("resets_at") == w.get("resets_at"):     # same window: no reset in between
                spent.append({"id": w["id"], "before": was["used_percent"], "after": w["used_percent"]})
        if spent:
            entry["windows"] = spent
    with _lock:
        data = _load()
        data["sessions"] = [*data.get("sessions", []), entry][-SESSIONS_KEPT:]
        _save(data)
    return {k: v for k, v in entry.items() if k != "at"}


# ---------- reading the plan's limit ----------

def claude_event(event: dict) -> str:
    """Claude Code's `rate_limit_event`: note the windows; returns its status ("allowed", "rejected", …)."""
    info = event.get("rate_limit_info") or {}
    windows = []
    for wid, w in (info.get("unifiedWindows") or {}).items():
        if isinstance(w, dict) and isinstance(w.get("utilization"), (int, float)):
            windows.append({"id": wid, "used_percent": round(float(w["utilization"]) * 100, 1),
                            "resets_at": w.get("resetsAt")})
    if windows:
        note_limit("claude_cli", "", windows)
    return str(info.get("status") or "")


async def read_codex(binary: str, *, fresh: bool = False) -> dict | None:
    """Codex's limit from the local app-server (sends no model request). Cached for a minute."""
    cached = _codex_cache.get(binary)
    if cached and not fresh and time.time() - cached[0] < CODEX_CACHE_S:
        return cached[1]
    from .engines.claude_cli import child_env
    try:
        proc = await asyncio.create_subprocess_exec(binary, "app-server", stdin=asyncio.subprocess.PIPE,
                                                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                                                    env=child_env(), limit=4 * 1024 * 1024)
    except OSError:
        return None
    try:
        result = await asyncio.wait_for(_ask_codex(proc), 15)
    except (asyncio.TimeoutError, OSError, ValueError, KeyError, TypeError):
        result = None
    finally:
        if proc.returncode is None:
            proc.kill()
        await proc.wait()
    snapshot = None
    if result:
        limits = result.get("rateLimits") or {}
        windows = []
        for w in (limits.get("primary"), limits.get("secondary")):
            if isinstance(w, dict) and isinstance(w.get("usedPercent"), (int, float)):
                minutes = int(w.get("windowDurationMins") or 0)
                windows.append({"id": WINDOWS.get(minutes, f"{minutes}min"), "minutes": minutes,
                                "used_percent": float(w["usedPercent"]), "resets_at": w.get("resetsAt")})
        if windows:
            note_limit("codex_cli", str(limits.get("planType") or ""), windows)
            snapshot = _load()["limits"]["codex_cli"]
    _codex_cache[binary] = (time.time(), snapshot)
    return snapshot


async def _ask_codex(proc) -> dict | None:
    async def send(message: dict) -> None:
        proc.stdin.write((json.dumps(message) + "\n").encode())
        await proc.stdin.drain()

    async def reply(request_id: int) -> dict:
        async for raw in proc.stdout:
            message = json.loads(raw)
            if message.get("id") == request_id:
                return message
        raise ValueError("no reply")

    await send({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"clientInfo": {"name": "vukoli", "version": "1"}}})
    await reply(1)
    await send({"jsonrpc": "2.0", "method": "initialized"})
    await send({"jsonrpc": "2.0", "id": 2, "method": "account/rateLimits/read", "params": None})
    return (await reply(2)).get("result")


# ---------- what the UI shows ----------

def pacific_midnight(now: float | None = None) -> tuple[float, float]:
    """Start of today and of tomorrow in Pacific time (Gemini's per-day limits reset then)."""
    try:
        from zoneinfo import ZoneInfo
        zone = ZoneInfo("America/Los_Angeles")
    except Exception:                                   # no time zone data: Pacific standard time
        zone = dt.timezone(dt.timedelta(hours=-8))
    local = dt.datetime.fromtimestamp(now or time.time(), zone)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.timestamp(), (start + dt.timedelta(days=1)).timestamp()


def requests_since(engine: str, since: float) -> int:
    return sum(1 for t in _load().get("requests", {}).get(engine, []) if t >= since)


def estimate(engine: str, windows: list[dict]) -> dict | None:
    """Sessions left in the window that runs out first: what is left ÷ what a session used. None until a session
    with this engine has been measured. `at_least` when past sessions didn't move the (whole-percent) counter."""
    sessions = [s for s in _load().get("sessions", []) if s.get("engine") == engine]
    if not sessions:
        return None
    per_session = sum(s.get("requests", 0) for s in sessions) / len(sessions)
    best = None
    for w in windows:
        measured = [x for s in sessions for x in s.get("windows", []) if x["id"] == w["id"]]
        asked = sum(s.get("requests", 0) for s in sessions if any(x["id"] == w["id"] for x in s.get("windows", [])))
        if not measured or not asked or not per_session:
            continue
        spent = sum(max(0.0, x["after"] - x["before"]) for x in measured)
        left = max(0.0, 100.0 - float(w["used_percent"]))
        if spent > 0:
            n, at_least = left / (spent / asked * per_session), False
        else:                                           # under one step of the counter over `asked` requests
            n, at_least = left * asked / per_session, True
        if best is None or n < best["sessions"]:
            best = {"sessions": min(999, int(n)), "at_least": at_least, "window": w["id"]}
    return best


async def limits_for(engine: str, binary: str | None = None) -> dict:
    """The block the AI engine settings show for `engine`."""
    now = time.time()
    if engine == "codex_cli" and binary:
        snapshot = await read_codex(binary)
        if snapshot:
            return _percent(engine, snapshot, now)
        return {"engine": engine, "kind": "none"}
    if engine == "claude_cli":
        snapshot = _load().get("limits", {}).get(engine)
        if not snapshot:
            return {"engine": engine, "kind": "pending"}          # shown after Vukoli's first request
        return _percent(engine, snapshot, now)
    if engine in COUNTED:
        if COUNTED[engine] == "day":
            start, resets = pacific_midnight(now)
            return {"engine": engine, "kind": "count", "period": "day",
                    "requests": requests_since(engine, start), "resets_at": _iso(resets)}
        return {"engine": engine, "kind": "count", "period": "week",
                "requests": requests_since(engine, now - 7 * 86400)}
    return {"engine": engine, "kind": "none"}


def _percent(engine: str, snapshot: dict, now: float) -> dict:
    windows = []
    for w in snapshot["windows"]:
        passed = isinstance(w.get("resets_at"), (int, float)) and w["resets_at"] < now
        windows.append({"id": w["id"], "used_percent": w["used_percent"],
                        "resets_at": _iso(w["resets_at"]) if w.get("resets_at") else None, "stale": passed})
    live = [w for w in snapshot["windows"] if not (isinstance(w.get("resets_at"), (int, float)) and w["resets_at"] < now)]
    return {"engine": engine, "kind": "percent", "plan": snapshot.get("plan", ""), "as_of": _iso(snapshot["as_of"]),
            "windows": windows, "estimate": estimate(engine, live)}


def _iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat(timespec="seconds")
