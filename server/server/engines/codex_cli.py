"""Codex CLI adapter (D86): runs the user's own installed `codex` binary (`codex exec`), signed in with ChatGPT.

The app never handles OpenAI credentials; the user runs `codex login` themselves. Codex is a coding agent, so every
tool it has is switched off: no shell, no files, no web, no apps, plugins, MCP or the user's config.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import tempfile
from typing import AsyncIterator

from .. import usage
from .base import EngineDescriptor, EngineError, EngineStatus, LLMEngine, Msg
from .claude_cli import child_env, to_prompt
from .locate import find_program

INSTALL_URL = "https://github.com/openai/codex"
TERMS_NOTE = "Uses your own ChatGPT plan via the Codex CLI; check OpenAI's terms. Each request counts against your Codex limits."
DESCRIPTOR = EngineDescriptor(
    id="codex_cli",
    name="Codex (your Codex CLI)",
    kind="text",
    local=False,
    cost="Uses your own ChatGPT plan.",
    data_line="Your transcribed words go to OpenAI through your Codex CLI. Speech is recognised on this computer.",
    needs=["Codex CLI installed and signed in (run `codex login`)"],
    terms_note=TERMS_NOTE,
    setup_url=INSTALL_URL,
)
# Codex tools that could touch this computer or the web. Checked live with `codex features list` (0.163, D86).
OFF_FEATURES = ("shell_tool", "unified_exec", "unified_exec_tty", "apps", "plugins", "browser_use", "computer_use",
                "in_app_browser", "image_generation", "view_image", "multi_agent", "multi_agent_v2", "hooks", "goals",
                "skill_search", "skill_mcp_dependency_install", "tool_suggest", "tool_call_mcp_elicitation",
                "code_mode", "code_mode_host", "code_mode_interrupt", "workspace_dependencies", "memories",
                "realtime_conversation")
BASE_FLAGS = ["exec", "--json", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only",
              "--ignore-user-config", "--ignore-rules", "--color", "never",
              "-c", 'web_search="disabled"', "-c", 'model_reasoning_effort="low"', "-c", "project_doc_max_bytes=0",
              "-c", "skills.include_instructions=false", "-c", "skills.bundled.enabled=false",
              "-c", "agents.max_threads=1", "-c", "agents.max_depth=0",
              *(arg for name in OFF_FEATURES for arg in ("--disable", name))]
LOGIN = "codex login"
# Fail closed: if Codex starts any tool despite the flags above, Vukoli stops the run instead of waiting it out.
NO_TOOLS = "You have no tools in this conversation. Never call any tool or function; answer directly in text."
TOOL_ITEMS = {"command_execution", "file_change", "mcp_tool_call", "web_search", "collab_tool_call"}


def find_codex() -> str | None:
    return find_program("codex")


def signed_in(binary: str) -> bool:
    """`codex login status` exits 0 when signed in. Local and free: no request is sent."""
    try:
        return subprocess.run([binary, "login", "status"], env=child_env(), capture_output=True,
                              timeout=10).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def remember_sign_in(ok: bool | None) -> None:
    from .. import config
    if config.load_settings()["codex_cli"].get("verified") is not ok:
        config.update_settings({"codex_cli": {"verified": ok}})


def build_command(binary: str, model: str, workdir: str) -> list[str]:
    cmd = [binary, *BASE_FLAGS, "-C", workdir]
    if model:
        cmd += ["-m", model]
    return [*cmd, "-"]


def is_auth_error(message: str) -> bool:
    low = message.lower()
    return "401" in low or "unauthorized" in low or "not logged in" in low or "log in" in low


def is_quota_error(message: str) -> bool:
    low = message.lower()
    return "usage limit" in low or "rate limit" in low or "429" in low


class CodexCLIEngine(LLMEngine):
    id = "codex_cli"

    def __init__(self, model: str = "", binary: str | None = None, verified: bool | None = True):
        self._model = model
        self._binary = binary
        self._verified = verified

    @property
    def model(self) -> str:
        return self._model

    def _bin(self) -> str:
        binary = self._binary or find_codex()
        if not binary:
            raise EngineError("not_installed", "The Codex CLI is not installed.",
                              "Install it with `brew install --cask codex`, then run `codex login`.")
        return binary

    async def status(self) -> EngineStatus:
        binary = self._binary or find_codex()
        if not binary:
            return EngineStatus(code="not_installed", message="The Codex CLI was not found on this computer.",
                                hint="Install Codex, then run `codex login`.", hint_command="brew install --cask codex",
                                fix_url=INSTALL_URL, warnings=[TERMS_NOTE])
        if not await asyncio.to_thread(signed_in, binary):
            return EngineStatus(code="unauthorized", message="Codex isn't signed in.",
                                hint="Run `codex login` in Terminal and sign in with ChatGPT, then press Connect.",
                                hint_command=LOGIN, model=self._model, warnings=[TERMS_NOTE])
        # Signed in locally, but only a real request (Connect) proves the plan answers.
        if self._verified is not True:
            return EngineStatus(code="unverified", message="Codex is signed in. Connect checks that it answers.",
                                hint="Press Connect: it sends one short request on your ChatGPT plan.",
                                model=self._model, warnings=[TERMS_NOTE])
        return EngineStatus(code="ready", ready=True, message="Codex is signed in.", model=self._model,
                            warnings=[TERMS_NOTE])

    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        system, prompt = to_prompt(messages)
        if json_schema is not None:
            prompt += "\n\nReply with ONLY a JSON object matching this schema: " + json.dumps(json_schema)
        else:
            system += ("\n\nOUTPUT FORMAT: plain spoken text only. No markdown, no lists, no emojis, "
                       "no stage directions, no speaker name.")
        # codex exec has no system-prompt flag: the instructions lead the prompt, the turn follows.
        system = NO_TOOLS + ("\n\n" + system.strip() if system.strip() else "")
        full = f"{system}\n\n---\n\n{prompt}"
        with tempfile.TemporaryDirectory(prefix="vukoli-codex-") as workdir:
            proc = await asyncio.create_subprocess_exec(
                *build_command(self._bin(), self._model, workdir), cwd=workdir, env=child_env(),
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                limit=4 * 1024 * 1024)
            usage.count(self.id)
            text, error, blocked = "", "", False
            try:
                proc.stdin.write(full.encode())
                await proc.stdin.drain()
                proc.stdin.close()
                async for raw in proc.stdout:
                    try:
                        event = json.loads(raw)
                    except ValueError:
                        continue
                    kind = event.get("type")
                    item = event.get("item") or {}
                    if kind in ("item.started", "item.completed") and item.get("type") in TOOL_ITEMS:
                        error, blocked = f"Codex tried to use a tool ({item['type']}); Vukoli stopped it.", True
                        break
                    if kind == "item.completed" and item.get("type") == "agent_message" and item.get("text"):
                        text = str(item["text"])    # an earlier message is a preamble ("I'll check…"): the last one counts
                    elif kind == "turn.failed":
                        error = str((event.get("error") or {}).get("message") or "Codex CLI error")
                        if is_auth_error(error) or is_quota_error(error):
                            break               # don't sit through its five reconnects on a missing sign-in
                    elif kind == "error" and is_auth_error(str(event.get("message", ""))):
                        error = str(event.get("message"))
                        break
                if proc.returncode is None and error:
                    proc.kill()
                await proc.wait()
                if blocked:
                    raise EngineError("engine_error", error, "Try again. If it repeats, pick another engine.")
                if error and not text and is_quota_error(error):
                    raise EngineError("rate_limited", "Your Codex limit is used up.",
                                      "Settings → AI engine shows when it resets. Pick another engine meanwhile.")
                if error and not text:
                    code = "unauthorized" if is_auth_error(error) else "engine_error"
                    if code == "unauthorized":
                        remember_sign_in(False)
                    raise EngineError(code, error[:300], f"Run `{LOGIN}` in a terminal and sign in.")
                if text:
                    yield text
            finally:
                if proc.returncode is None:
                    proc.kill()
                    await proc.wait()

    async def test(self) -> EngineStatus:
        """Real round trip: costs one small request on the user's ChatGPT plan."""
        try:
            reply = await asyncio.wait_for(self.complete([{"role": "user", "content": "Reply with OK."}]), 90)
        except EngineError as exc:
            return EngineStatus(code="unauthorized" if exc.code == "unauthorized" else "error",
                                message=exc.message, hint=exc.hint,
                                hint_command=LOGIN if exc.code == "unauthorized" else "", warnings=[TERMS_NOTE])
        except (asyncio.TimeoutError, OSError) as exc:
            return EngineStatus(code="error", message=f"Codex CLI did not answer ({type(exc).__name__}).")
        if not reply.strip():
            return EngineStatus(code="error", message="Codex answered with nothing.", warnings=[TERMS_NOTE])
        return EngineStatus(code="ready", ready=True, message="Codex answered.", model=self._model,
                            warnings=[TERMS_NOTE])
