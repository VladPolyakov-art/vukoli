"""Antigravity CLI adapter (D87): runs the user's own installed `agy` binary in print mode, signed in with Google.

The app never handles Google credentials; the user runs `agy` once and signs in themselves. Antigravity is a coding
agent and has no flag that removes its tools, so each run is fenced in: an empty temporary folder, the terminal
sandbox, no slash commands, and print mode, where every tool that needs approval (commands, files outside the folder,
the web browser, MCP) is refused. A few tools run without approval (web search, subagents), so Vukoli stops the run
at the first tool step. Antigravity keeps every run in its history; Vukoli deletes the runs it made (D87).
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import AsyncIterator

from .. import usage
from .base import BACKGROUND, EngineDescriptor, EngineError, EngineStatus, LLMEngine, Msg
from .claude_cli import child_env, to_prompt
from .locate import find_program

INSTALL_URL = "https://antigravity.google/docs/cli"
INSTALL = "curl -fsSL https://antigravity.google/cli/install.sh | bash"
TERMS_NOTE = ("Uses your own Google account via the Antigravity CLI; check Google's terms. "
              "Each request counts against your Antigravity quota.")
DESCRIPTOR = EngineDescriptor(
    id="antigravity_cli",
    name="Antigravity (your Antigravity CLI)",
    kind="text",
    local=False,
    cost="Uses your own Google AI plan or free quota.",
    data_line="Your transcribed words go to Google through your Antigravity CLI. Speech is recognised on this computer.",
    needs=["Antigravity CLI installed and signed in (run `agy` once)"],
    terms_note=TERMS_NOTE,
    setup_url=INSTALL_URL,
)
# Checked live with agy 1.4.4 (D87). The prompt goes in on stdin, so it never shows in the process list.
BASE_FLAGS = ["--input-format", "stream-json", "--output-format", "stream-json", "--sandbox",
              "--disable-slash-commands", "--effort", "low", "--print-timeout", "120s"]
LOGIN = "agy"
NO_TOOLS = "You have no tools in this conversation. Never call any tool or function; answer directly in text."
AUTH_WORDS = ("authentication", "not signed in", "sign in", "unauthenticated", "401")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_SIGN_IN_TTL = 30.0
_signed_in_cache: dict[str, tuple[float, bool]] = {}


def find_agy() -> str | None:
    return find_program("agy")


def signed_in(binary: str, fresh: bool = False) -> bool:
    """`agy models` exits 0 when signed in and 1 with "Please sign in" when not. It sends no prompt (D87).
    It asks Google for the model list, so the answer is kept for half a minute (fresh: ask again)."""
    hit = _signed_in_cache.get(binary)
    if hit and not fresh and time.monotonic() - hit[0] < _SIGN_IN_TTL:
        return hit[1]
    try:
        with tempfile.TemporaryDirectory(prefix="vukoli-agy-") as workdir:
            ok = subprocess.run([binary, "models"], cwd=workdir, env=child_env(), stdin=subprocess.DEVNULL,
                                capture_output=True, timeout=20).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False
    _signed_in_cache[binary] = (time.monotonic(), ok)
    return ok


def remember_sign_in(ok: bool | None) -> None:
    from .. import config
    _signed_in_cache.clear()
    if config.load_settings()["antigravity_cli"].get("verified") is not ok:
        config.update_settings({"antigravity_cli": {"verified": ok}})


def history_dir() -> Path:
    return Path(child_env()["HOME"]) / ".gemini" / "antigravity-cli"


def forget(conversation_ids: set[str]) -> None:
    """Delete the conversations Vukoli's own runs left in Antigravity's history (its own ones only, by id)."""
    root = history_dir()
    for cid in conversation_ids:
        if not _UUID.match(cid):
            continue
        for suffix in (".db", ".db-wal", ".db-shm"):
            (root / "conversations" / f"{cid}{suffix}").unlink(missing_ok=True)
        shutil.rmtree(root / "brain" / cid, ignore_errors=True)


def kill_group(pid: int) -> None:
    """Kill the process group (POSIX) or the process tree (Windows, which has no killpg or SIGKILL)."""
    if sys.platform == "win32":
        done = subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True,
                              creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if done.returncode != 0:
            raise ProcessLookupError(pid)
        return
    os.killpg(pid, signal.SIGKILL)


def stop(proc: asyncio.subprocess.Process) -> None:
    """Kill the run with everything it started: a child left alive would hold the output open (and keep working)."""
    try:
        kill_group(proc.pid)
    except (ProcessLookupError, PermissionError):
        if proc.returncode is None:
            proc.kill()


async def stop_and_wait(proc: asyncio.subprocess.Process, seconds: float = 5.0) -> None:
    """Stop the run and wait until it and its pipes are gone. A child being started at the moment of the first kill
    misses it, so the group is killed again every 0.1 s (with one kill, 18 of 40 test runs waited for that child)."""
    waiter = asyncio.ensure_future(proc.wait())
    for _ in range(int(seconds / 0.1)):
        stop(proc)
        done, _ = await asyncio.wait({waiter}, timeout=0.1)
        if done:
            return
    waiter.cancel()


class Run:
    """One started `agy`: its process, its empty folder and the chats it made. It can start before its message is
    ready (a spare, D87), so its output is read from the start: the chat ids are known even if it is never used."""

    def __init__(self, proc: asyncio.subprocess.Process, workdir: str):
        self.proc, self.workdir = proc, workdir
        self.loop = asyncio.get_running_loop()
        self.ids: set[str] = set()
        self.signed_out = asyncio.Event()
        self.events: asyncio.Queue[dict | None] = asyncio.Queue()
        self._tasks = [asyncio.ensure_future(self._read()), asyncio.ensure_future(self._watch())]

    def _note(self, event: dict) -> None:
        step = event.get("step_update") or {}
        found = [event.get("conversation_id"), step.get("conversation_id"), (event.get("result") or {}).get("conversation_id")]
        found += [agent.get("conversation_id") for agent in (step.get("subagent_info") or {}).get("subagents") or []]
        new = {str(cid) for cid in found if cid} - self.ids
        if new:
            self.ids |= new
            _open_runs(new)

    async def _read(self) -> None:
        try:
            async for raw in self.proc.stdout:
                try:
                    event = json.loads(raw)
                except ValueError:
                    continue
                if isinstance(event, dict):
                    self._note(event)
                    self.events.put_nowait(event)
        except (ValueError, OSError):
            pass
        self.events.put_nowait(None)

    async def _watch(self) -> None:
        # Signed out, print mode prints a sign-in link and waits a minute for a code: stop at once.
        async for line in self.proc.stderr:
            if "authentication" in line.decode(errors="replace").lower():
                self.signed_out.set()
                stop(self.proc)
                self.events.put_nowait(None)    # a child may still hold the output open: don't wait for it
                return

    @property
    def alive(self) -> bool:
        return self.proc.returncode is None and not self.signed_out.is_set()

    async def finish(self) -> None:
        """Stop it, then delete its folder and its chats from Antigravity's history (they're written until it's gone)."""
        if self.proc.returncode is None:
            await stop_and_wait(self.proc)
        for task in self._tasks:
            task.cancel()
        forget(self.ids)
        _open_runs(self.ids, add=False)
        shutil.rmtree(self.workdir, ignore_errors=True)

    def discard(self) -> None:
        """The same without waiting, for a run that belongs to another event loop (or a test's cleanup)."""
        try:
            kill_group(self.proc.pid)
        except (ProcessLookupError, PermissionError):
            pass
        forget(self.ids)
        _open_runs(self.ids, add=False)
        shutil.rmtree(self.workdir, ignore_errors=True)


async def start_run(binary: str, model: str) -> Run:
    workdir = tempfile.mkdtemp(prefix="vukoli-agy-")
    try:
        proc = await asyncio.create_subprocess_exec(
            *build_command(binary, model), cwd=workdir, env=child_env(),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            limit=4 * 1024 * 1024, start_new_session=True)
    except OSError:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    return Run(proc, workdir)


# A spare (D87): starting `agy` takes ~2-3 s of the ~5.5 s a reply takes, so during a session one more is started
# ahead and waits for the next message (checked live: 2.2 s instead of 5.5 s). Each run still gets one message only,
# so turns never share a chat. Kept only while a session uses the engine; idle for SPARE_IDLE, it's stopped.
SPARE_IDLE = 300.0
_spares: dict[tuple[str, str], Run] = {}
_wanted: dict[tuple[str, str], float] = {}
_filling: set[tuple[str, str]] = set()


def want_spares(binary: str, model: str) -> None:
    _wanted[(binary, model)] = time.monotonic()
    refill(binary, model)


def refill(binary: str, model: str) -> None:
    key = (binary, model)
    if key in _spares or key in _filling or time.monotonic() - _wanted.get(key, -SPARE_IDLE * 2) > SPARE_IDLE:
        return
    _filling.add(key)

    async def fill() -> None:
        try:
            run = await start_run(binary, model)
        except OSError:
            return
        finally:
            _filling.discard(key)
        _spares[key] = run
        await asyncio.sleep(SPARE_IDLE)
        if _spares.get(key) is run:             # nobody needed it: the session is over
            del _spares[key]
            await run.finish()

    asyncio.ensure_future(fill())


async def take_run(binary: str, model: str) -> Run:
    """The spare if one is waiting (and still fine), else a new run; then a new spare for the turn after."""
    run = _spares.pop((binary, model), None)
    if run is not None and not (run.alive and run.loop is asyncio.get_running_loop()):
        if run.loop is asyncio.get_running_loop():
            await run.finish()
        else:
            run.discard()
        run = None
    if run is None:
        run = await start_run(binary, model)
    if (binary, model) in _wanted:
        _wanted[(binary, model)] = time.monotonic()
    refill(binary, model)
    return run


async def close_spares() -> None:
    """On shutdown: stop the waiting spares and delete their (empty) chats."""
    _wanted.clear()
    while _spares:
        _, run = _spares.popitem()
        if run.loop is asyncio.get_running_loop():
            await run.finish()
        else:
            run.discard()


def _open_runs_file() -> Path:
    from .. import config
    return config.data_dir() / "antigravity-runs.json"


def _open_runs(change: set[str] | None = None, *, add: bool = True) -> set[str]:
    """Chats of runs not finished yet, kept on disk: if Vukoli is killed, a waiting spare quits on its own but leaves
    its chat behind, so the next start deletes it (D87)."""
    path = _open_runs_file()
    try:
        ids = set(json.loads(path.read_text()))
    except (OSError, ValueError, TypeError):
        ids = set()
    if change:
        ids = ids | change if add else ids - change
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(sorted(ids)))
        except OSError:
            pass
    return ids


def forget_left_over() -> None:
    """On start: delete the chats a previous Vukoli left behind (killed with a spare waiting)."""
    left = _open_runs()
    if left:
        forget(left)
        _open_runs(left, add=False)


def is_quota_error(message: str) -> bool:
    """🟡 Not seen live (the quota wasn't used up): the words Google's quota errors use."""
    low = message.lower()
    return any(w in low for w in ("quota", "resource_exhausted", "rate limit", "rate_limit", "429"))


def build_command(binary: str, model: str) -> list[str]:
    cmd = [binary, *BASE_FLAGS]
    return [*cmd, "--model", model] if model else cmd


def is_auth_error(message: str) -> bool:
    low = message.lower()
    return any(word in low for word in AUTH_WORDS)


class AntigravityCLIEngine(LLMEngine):
    id = "antigravity_cli"

    def __init__(self, model: str = "", binary: str | None = None, verified: bool | None = True):
        self._model = model
        self._binary = binary
        self._verified = verified

    @property
    def model(self) -> str:
        return self._model

    def _bin(self) -> str:
        binary = self._binary or find_agy()
        if not binary:
            raise EngineError("not_installed", "The Antigravity CLI is not installed.",
                              f"Install it with `{INSTALL}`, then run `agy` and sign in.")
        return binary

    async def status(self) -> EngineStatus:
        binary = self._binary or find_agy()
        if not binary:
            return EngineStatus(code="not_installed", message="The Antigravity CLI was not found on this computer.",
                                hint="Install the Antigravity CLI, then run `agy` and sign in with Google.",
                                hint_command=INSTALL, fix_url=INSTALL_URL, warnings=[TERMS_NOTE])
        if not await asyncio.to_thread(signed_in, binary):
            return EngineStatus(code="unauthorized", message="Antigravity isn't signed in.",
                                hint="Run `agy` in a new Terminal window, choose Google sign-in, then press Connect.",
                                hint_command=LOGIN, model=self._model, warnings=[TERMS_NOTE])
        # Signed in, but only a real request (Connect) proves the quota answers.
        if self._verified is not True:
            return EngineStatus(code="unverified", message="Antigravity is signed in. Connect checks that it answers.",
                                hint="Press Connect: it sends one short request on your Google account.",
                                model=self._model, warnings=[TERMS_NOTE])
        return EngineStatus(code="ready", ready=True, message="Antigravity is signed in.", model=self._model,
                            warnings=[TERMS_NOTE])

    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        system, prompt = to_prompt(messages)
        if json_schema is not None:
            prompt += "\n\nReply with ONLY a JSON object matching this schema: " + json.dumps(json_schema)
        else:
            system += ("\n\nOUTPUT FORMAT: plain spoken text only. No markdown, no lists, no emojis, "
                       "no stage directions, no speaker name.")
        # Print mode has no system-prompt flag: the instructions lead the message, the turn follows.
        system = NO_TOOLS + ("\n\n" + system.strip() if system.strip() else "")
        message = {"event": "user", "message": {"content": f"{system}\n\n---\n\n{prompt}"}}
        # A background call (feedback) starts its own: the spare is kept for Mike's reply, which runs alongside it.
        run = await (start_run if BACKGROUND.get() else take_run)(self._bin(), self._model)
        usage.count(self.id)
        text, error, blocked = "", "", False
        try:
            run.proc.stdin.write((json.dumps(message) + "\n").encode())
            await run.proc.stdin.drain()
            run.proc.stdin.close()
            while (event := await run.events.get()) is not None:
                step = event.get("step_update") or {}
                if step.get("step_type") == "tool" or step.get("tool_name") or step.get("subagent_info"):
                    name = step.get("tool_name") or "subagent"
                    error, blocked = f"Antigravity tried to use a tool ({name}); Vukoli stopped it.", True
                    break
                if event.get("event") == "result":
                    result = event.get("result") or {}
                    if result.get("status") == "SUCCESS":
                        text = str(result.get("response") or "")
                    else:
                        error = str(result.get("error") or f"Antigravity CLI ended with {result.get('status')}")
                    break
        except (BrokenPipeError, ConnectionResetError):
            pass                                # it ended before reading the message: told below
        finally:
            await run.finish()
        if run.signed_out.is_set():
            error = "Antigravity isn't signed in."
        if blocked:
            raise EngineError("engine_error", error, "Try again. If it repeats, pick another engine.")
        if not text.strip() and is_quota_error(error):
            raise EngineError("rate_limited", "Your Antigravity quota is used up for now.",
                              "On a free Google plan it refreshes weekly. Pick another engine in Settings → AI engine "
                              "meanwhile.")
        if not text.strip():
            error = error or "Antigravity answered with nothing."
            code = "unauthorized" if run.signed_out.is_set() or is_auth_error(error) else "engine_error"
            if code == "unauthorized":
                remember_sign_in(False)
            raise EngineError(code, error[:300], f"Run `{LOGIN}` in a terminal and sign in with Google.")
        yield text.strip()

    async def warm_up(self, messages: list[Msg]) -> None:
        """A session starts: keep a spare `agy` ready from now on, so Mike's replies skip the start-up (D87)."""
        if binary := self._binary or find_agy():
            want_spares(binary, self._model)

    async def test(self) -> EngineStatus:
        """Real round trip: costs one small request on the user's Google account."""
        try:
            reply = await asyncio.wait_for(self.complete([{"role": "user", "content": "Reply with OK."}]), 90)
        except EngineError as exc:
            return EngineStatus(code="unauthorized" if exc.code == "unauthorized" else "error",
                                message=exc.message, hint=exc.hint,
                                hint_command=LOGIN if exc.code == "unauthorized" else "", warnings=[TERMS_NOTE])
        except (asyncio.TimeoutError, OSError) as exc:
            return EngineStatus(code="error", message=f"Antigravity CLI did not answer ({type(exc).__name__}).")
        if not reply.strip():
            return EngineStatus(code="error", message="Antigravity answered with nothing.", warnings=[TERMS_NOTE])
        return EngineStatus(code="ready", ready=True, message="Antigravity answered.", model=self._model,
                            warnings=[TERMS_NOTE])
