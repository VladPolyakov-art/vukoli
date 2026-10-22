"""Engine adapters with mocked HTTP: no real Ollama, OpenAI, Claude or Google calls."""
from __future__ import annotations

import json
import time
from pathlib import Path

import httpx
import pytest

from server import engines
from server.engines import antigravity_cli, claude_cli, codex_cli, gemini_live, ollama, openai_compat
from server.engines.base import EngineError, EngineStatus, ThinkFilter, extract_json, strip_think


def ollama_transport(models=None, chat_chunks=None, fail=False):
    def handler(request: httpx.Request) -> httpx.Response:
        if fail:
            raise httpx.ConnectError("refused", request=request)
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": n, "size": 1} for n in (models or [])]})
        if request.url.path == "/api/chat":
            body = json.loads(request.content)
            assert body["think"] is False and body["keep_alive"] == "30m"
            lines = "\n".join(json.dumps({"message": {"content": c}}) for c in (chat_chunks or ["ok"]))
            return httpx.Response(200, text=lines)
        return httpx.Response(404)
    return httpx.MockTransport(handler)


async def test_ollama_ram_default():
    assert ollama.recommended_model(8) == "qwen3:4b-instruct"
    assert ollama.recommended_model(16) == "qwen3:8b"


async def test_ollama_not_installed_and_not_running(monkeypatch):
    engine = ollama.OllamaEngine("http://127.0.0.1:1", transport=ollama_transport(fail=True), ram_gb=8)
    monkeypatch.setattr(ollama, "installed", lambda: False)
    status = await engine.status()
    assert status.code == "not_installed"
    assert "ollama.com/download" in status.hint and status.hint_command == "ollama pull qwen3:4b-instruct"
    monkeypatch.setattr(ollama, "installed", lambda: True)
    assert (await engine.status()).code == "not_running"


async def test_ollama_no_model_and_ready():
    engine = ollama.OllamaEngine("http://x", transport=ollama_transport(models=["nomic-embed-text"]), ram_gb=16)
    status = await engine.status()
    assert status.code == "no_model" and status.hint_command == "ollama pull qwen3:8b"
    engine = ollama.OllamaEngine("http://x", transport=ollama_transport(models=["qwen3:8b"]), ram_gb=16)
    status = await engine.status()
    assert status.ready and status.model == "qwen3:8b" and not status.warnings


async def test_ollama_thinking_model_warns_and_think_is_stripped():
    transport = ollama_transport(models=["qwen3:4b"], chat_chunks=["<thi", "nk>plan", "ning</think>", "Hello."])
    engine = ollama.OllamaEngine("http://x", "qwen3:4b", transport=transport)
    status = await engine.status()
    assert status.ready and status.warnings
    assert await engine.complete([{"role": "user", "content": "hi"}]) == "Hello."


def test_think_helpers():
    f = ThinkFilter()
    assert "".join(f.feed(x) for x in ["<think>", "abc", "</think> Hi", " there"]) == "Hi there"
    f = ThinkFilter()
    assert "".join(f.feed(x) for x in ["Hel", "lo"]) == "Hello"
    assert strip_think("<think>x</think>{\"a\":1}") == '{"a":1}'
    assert extract_json("```json\n{\"a\": 1}\n```") == '{"a": 1}'


def openai_transport(status=200, models=("m1",), sse=None, reject_schema=False, seen=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        if status != 200:
            return httpx.Response(status)
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": [{"id": m} for m in models]})
        body = json.loads(request.content)
        if reject_schema and body.get("response_format", {}).get("type") == "json_schema":
            return httpx.Response(400, json={"error": "response_format not supported"})
        events = sse or ["Hel", "lo"]
        text = "".join(f"data: {json.dumps({'choices': [{'delta': {'content': e}}]})}\n\n" for e in events)
        return httpx.Response(200, text=text + "data: [DONE]\n\n")
    return httpx.MockTransport(handler)


async def test_openai_compatible_stream_status_and_key_privacy():
    seen = []
    engine = openai_compat.OpenAICompatibleEngine("http://localhost:1234/v1", "sk-secret", "m1",
                                                  transport=openai_transport(seen=seen))
    assert "sk-secret" not in repr(engine)
    assert (await engine.status()).ready
    assert await engine.complete([{"role": "user", "content": "hi"}]) == "Hello"
    assert seen[0].headers["authorization"] == "Bearer sk-secret"
    assert engine.single_worker   # a local server: feedback waits for the interviewer


async def test_openai_compatible_errors():
    assert (await openai_compat.OpenAICompatibleEngine("", "", "").status()).code == "not_configured"
    bad = openai_compat.OpenAICompatibleEngine("https://api.example.com/v1", "k", "m1", transport=openai_transport(401))
    assert (await bad.status()).code == "unauthorized"
    other = openai_compat.OpenAICompatibleEngine("https://api.example.com/v1", "", "zz", transport=openai_transport())
    assert (await other.status()).code == "no_model"


async def test_openai_compatible_schema_fallback():
    engine = openai_compat.OpenAICompatibleEngine("http://localhost:1/v1", "", "m1",
                                                  transport=openai_transport(reject_schema=True, sse=['{"a": 1}']))
    assert await engine.complete_json([{"role": "user", "content": "x"}], {"type": "object"}) == {"a": 1}
    assert engine._schema_mode == "json_object"


async def test_claude_cli_not_installed_and_command(monkeypatch):
    monkeypatch.setattr(claude_cli, "find_claude", lambda: None)
    status = await claude_cli.ClaudeCLIEngine().status()
    assert status.code == "not_installed" and claude_cli.TERMS_NOTE in status.warnings
    assert claude_cli.DESCRIPTOR.terms_note == claude_cli.TERMS_NOTE
    cmd = claude_cli.build_command("claude", "haiku", "sys", True)
    assert cmd[:2] == ["claude", "-p"] and "--output-format" in cmd and "stream-json" in cmd
    assert not any(part.startswith("/Users/") for part in cmd)
    system, prompt = claude_cli.to_prompt([{"role": "system", "content": "S"}, {"role": "user", "content": "U"}])
    assert (system, prompt) == ("S", "U")


async def test_gemini_status_and_error_classification():
    assert gemini_live.basic_status("", "m").code in ("not_configured", "not_installed")
    err = gemini_live.classify_error(RuntimeError("1011 None. prepayment credits are depleted"))
    assert err.code == "billing_required"
    assert "create a key in a project without billing" in err.hint
    assert gemini_live.classify_error(RuntimeError("API key not valid")).code == "unauthorized"
    assert gemini_live.classify_error(RuntimeError("429 RESOURCE_EXHAUSTED")).code == "rate_limited"
    assert "Free tier" in gemini_live.PRIVACY_NOTE and "paid" not in gemini_live.PRIVACY_NOTE.lower()


async def test_engine_registry_lists_all_with_status(monkeypatch):
    monkeypatch.setattr(ollama, "installed", lambda: False)
    monkeypatch.setattr(claude_cli, "find_claude", lambda: None)
    settings = {"engine": "ollama", "ollama": {"url": "http://127.0.0.1:9", "model": ""},
                "openai_compatible": {"base_url": "", "api_key": "", "model": ""}, "claude_cli": {"model": "haiku"},
                "codex_cli": {"model": ""}, "antigravity_cli": {"model": ""},
                "gemini_live": {"api_key": "", "model": "m", "text_model": "t", "voice": "Puck"}}
    items = await engines.all_engines(settings)
    assert [i["id"] for i in items] == ["ollama", "openai_compatible", "claude_cli", "codex_cli", "antigravity_cli",
                                        "gemini_live"]
    by_id = {i["id"]: i for i in items}
    assert by_id["ollama"]["selected"] and by_id["ollama"]["status"]["code"] == "not_installed"
    assert by_id["openai_compatible"]["status"]["code"] == "not_configured"
    assert by_id["claude_cli"]["status"]["code"] == "not_installed"
    assert by_id["codex_cli"]["status"]["code"] == "not_installed"
    assert by_id["antigravity_cli"]["status"]["code"] == "not_installed"


async def test_ollama_voice_session_defaults_to_small_model():
    from server import engines
    settings = {"engine": "ollama", "ollama": {"url": "http://x", "model": "qwen3:8b", "voice_model": ""}}
    assert engines.make_llm(settings, "ollama").model == "qwen3:8b"
    voice = engines.make_llm(settings, "ollama", voice=True)
    assert voice.model == "qwen3:4b-instruct"
    settings["ollama"]["voice_model"] = "qwen3:8b"
    assert engines.make_llm(settings, "ollama", voice=True).model == "qwen3:8b"


async def test_ollama_voice_default_falls_back_to_installed_large_model():
    engine = ollama.OllamaEngine("http://x", transport=ollama_transport(models=["qwen3:8b"]),
                                 default_model=ollama.VOICE_MODEL)
    status = await engine.status()
    assert status.ready and status.model == "qwen3:8b"


def test_find_program_looks_outside_path(monkeypatch, tmp_path):
    """D83: an installed binary outside this process's PATH is still found."""
    from server.engines import locate
    binary = tmp_path / "claude"
    binary.write_text("#!/bin/sh\n")
    binary.chmod(0o755)
    monkeypatch.setattr(locate.shutil, "which", lambda name: None)
    monkeypatch.setattr(locate, "COMMON_DIRS", (str(tmp_path),))
    assert locate.find_program("claude") == str(binary)
    assert locate.find_program("nothing-here") is None
    assert locate.find_program("x", (str(binary),)) == str(binary)


def test_connect_route_starts_ollama_when_not_running(monkeypatch):
    from fastapi.testclient import TestClient
    from server import api
    from server.main import create_app
    from server.engines.base import EngineStatus
    calls = []
    codes = iter(["not_running", "ready"])

    async def fake_status(engine_id, settings=None):
        code = next(codes)
        return EngineStatus(code=code, ready=code == "ready", message=code)

    async def fake_start(url, wait_s=15.0):
        calls.append(url)
        return True
    monkeypatch.setattr(api.engines, "engine_status", fake_status)
    monkeypatch.setattr(api.ollama_engine, "start", fake_start)
    same = {"Origin": "http://testserver"}
    with TestClient(create_app()) as client:
        r = client.post("/api/engines/ollama/connect", headers=same)
        assert r.status_code == 200 and r.json()["started"] is True and r.json()["status"]["ready"] is True
        assert len(calls) == 1
        assert client.post("/api/engines/nope/connect", headers=same).status_code == 404


def test_disconnect_and_connect_round_trip(monkeypatch):
    """D84: Disconnect switches a local engine off in the app (no process is touched); Connect brings it back.
    A key engine forgets its key."""
    from fastapi.testclient import TestClient
    from server import api, config
    from server.main import create_app

    async def fake_status(self):
        return EngineStatus(code="ready", ready=True, message="ok")
    monkeypatch.setattr(claude_cli.ClaudeCLIEngine, "status", fake_status)
    same = {"Origin": "http://testserver"}
    with TestClient(create_app()) as client:
        r = client.post("/api/engines/claude_cli/disconnect", headers=same)
        assert r.status_code == 200 and r.json()["status"]["code"] == "disconnected"
        assert config.load_settings()["disconnected"] == ["claude_cli"]
        listed = {e["id"]: e["status"]["code"] for e in client.get("/api/engines").json()["engines"]}
        assert listed["claude_cli"] == "disconnected"
        r = client.post("/api/engines/claude_cli/connect", headers=same)
        assert r.json()["status"]["ready"] is True and config.load_settings()["disconnected"] == []
        config.update_settings({"gemini_live": {"api_key": "k-123"}})
        client.post("/api/engines/gemini_live/disconnect", headers=same)
        assert config.load_settings()["gemini_live"]["api_key"] == ""
        assert client.post("/api/engines/nope/disconnect", headers=same).status_code == 404


def test_disconnected_engine_never_runs():
    from server import engines
    llm = engines.make_llm({**config_defaults(), "disconnected": ["ollama"]}, "ollama")
    assert isinstance(llm, engines.DisconnectedEngine)


def config_defaults():
    from server import config
    return config.load_settings()


async def test_claude_status_follows_the_real_sign_in_check():
    """D85: found is not "Ready" until a real request answered; "not logged in" is remembered."""
    engine = lambda verified: claude_cli.ClaudeCLIEngine(binary="/bin/claude", verified=verified)
    assert (await engine(None).status()).code == "unverified"
    assert (await engine(False).status()).code == "unauthorized"
    assert (await engine(True).status()).ready is True


async def test_claude_not_logged_in_forgets_the_sign_in(tmp_path):
    from server import config
    fake = tmp_path / "claude"
    fake.write_text("#!/bin/sh\ncat >/dev/null\necho '" + json.dumps(
        {"type": "result", "is_error": True, "result": "Not logged in · Please run /login"}) + "'\n")
    fake.chmod(0o755)
    config.update_settings({"claude_cli": {"verified": True}})
    status = await claude_cli.ClaudeCLIEngine(binary=str(fake)).test()
    assert status.code == "unauthorized" and not status.ready
    assert config.load_settings()["claude_cli"]["verified"] is False


def test_claude_connect_sends_one_real_request(monkeypatch):
    from fastapi.testclient import TestClient
    from server import config
    from server.main import create_app
    answers = iter([EngineStatus(code="error", message="usage limit"),
                    EngineStatus(code="unauthorized", message="Not logged in"),
                    EngineStatus(code="ready", ready=True, message="Claude answered.")])

    async def fake_test(self):
        return next(answers)
    monkeypatch.setattr(claude_cli, "find_claude", lambda: "/bin/claude")
    monkeypatch.setattr(claude_cli.ClaudeCLIEngine, "test", fake_test)
    same = {"Origin": "http://testserver"}
    with TestClient(create_app()) as client:
        r = client.post("/api/engines/claude_cli/connect", headers=same).json()
        assert r["status"]["message"] == "usage limit" and config.load_settings()["claude_cli"]["verified"] is None
        r = client.post("/api/engines/claude_cli/connect", headers=same).json()
        assert r["status"]["code"] == "unauthorized" and config.load_settings()["claude_cli"]["verified"] is False
        r = client.post("/api/engines/claude_cli/connect", headers=same).json()
        assert r["status"]["ready"] is True and config.load_settings()["claude_cli"]["verified"] is True
        assert client.get("/api/engines/claude_cli/status").json()["code"] == "ready"


def test_ollama_model_download_reports_progress_and_errors(monkeypatch):
    """D85: the model downloads from the app; progress sums the layers; an Ollama error is shown as is."""
    from fastapi.testclient import TestClient
    from server.main import create_app
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        bodies.append(body)
        if body["model"] == "nope:1b":
            return httpx.Response(200, text=json.dumps({"error": "pull model manifest: file does not exist"}))
        lines = [{"status": "pulling manifest"},
                 {"status": "pulling a", "digest": "a", "total": 100, "completed": 100},
                 {"status": "pulling b", "digest": "b", "total": 300, "completed": 150},
                 {"status": "pulling b", "digest": "b", "total": 300, "completed": 300},
                 {"status": "verifying sha256 digest"}, {"status": "success"}]
        return httpx.Response(200, text="\n".join(json.dumps(x) for x in lines))
    real_client = httpx.AsyncClient
    monkeypatch.setattr(ollama.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(ollama, "pull", ollama.Pull())
    same = {"Origin": "http://testserver"}
    with TestClient(create_app()) as client:
        idle = client.get("/api/engines/ollama/pull").json()
        assert idle["state"] == "idle" and {o["model"] for o in idle["options"]} == {ollama.MODEL_SMALL, ollama.MODEL_LARGE}
        client.post("/api/engines/ollama/pull", json={"model": ollama.MODEL_SMALL}, headers=same)
        for _ in range(50):
            done = client.get("/api/engines/ollama/pull").json()
            if done["state"] != "pulling":
                break
        assert done["state"] == "done" and (done["completed"], done["total"]) == (400, 400)
        assert bodies[0] == {"model": ollama.MODEL_SMALL, "stream": True}
        client.post("/api/engines/ollama/pull", json={"model": "nope:1b"}, headers=same)
        for _ in range(50):
            failed = client.get("/api/engines/ollama/pull").json()
            if failed["state"] != "pulling":
                break
        assert failed["state"] == "error" and "does not exist" in failed["error"]
        assert client.post("/api/engines/ollama/pull", json={"model": "x; rm -rf"}, headers=same).status_code == 422


def test_claude_gets_user_and_home_outside_a_terminal(monkeypatch):
    monkeypatch.delenv("USER", raising=False)
    monkeypatch.delenv("LOGNAME", raising=False)
    env = claude_cli.child_env()
    assert env["USER"] and env["LOGNAME"] == env["USER"] and env["HOME"]


def fake_codex(tmp_path, *, signed_in: bool, lines: list[dict]):
    """A stand-in `codex`: `login status` exits 0 or 1, `exec` prints JSONL events and saves its arguments."""
    fake = tmp_path / "codex"
    out = "\n".join(json.dumps(x) for x in lines)
    fake.write_text(f"""#!/bin/sh
if [ "$1" = login ]; then {'exit 0' if signed_in else 'echo "Not logged in"; exit 1'}; fi
echo "$@" > "{tmp_path}/args"
cat > "{tmp_path}/prompt"
cat <<'JSONL'
{out}
JSONL
""")
    fake.chmod(0o755)
    return str(fake)


async def test_codex_status_needs_login_then_a_real_answer(tmp_path):
    """D86: not installed → not signed in (`codex login status`) → unverified until Connect → ready."""
    assert (await codex_cli.CodexCLIEngine(binary=None).status()).code == "not_installed"
    out = fake_codex(tmp_path, signed_in=False, lines=[])
    status = await codex_cli.CodexCLIEngine(binary=out, verified=True).status()
    assert status.code == "unauthorized" and status.hint_command == "codex login"
    out = fake_codex(tmp_path, signed_in=True, lines=[])
    assert (await codex_cli.CodexCLIEngine(binary=out, verified=None).status()).code == "unverified"
    assert (await codex_cli.CodexCLIEngine(binary=out, verified=False).status()).code == "unverified"
    assert (await codex_cli.CodexCLIEngine(binary=out, verified=True).status()).ready


async def test_codex_runs_with_every_tool_switched_off(tmp_path):
    """D86: Codex is a coding agent — no shell, files, web, apps, plugins, MCP, skills, sub-agents or user config;
    the reply is the last agent message (earlier ones are preambles); instructions lead the prompt."""
    out = fake_codex(tmp_path, signed_in=True, lines=[
        {"type": "thread.started", "thread_id": "t"}, {"type": "turn.started"},
        {"type": "item.completed", "item": {"id": "i0", "type": "reasoning", "text": "thinking"}},
        {"type": "item.completed", "item": {"id": "i1", "type": "agent_message", "text": "I'll answer now."}},
        {"type": "item.completed", "item": {"id": "i2", "type": "agent_message", "text": "Hi, I'm Mike."}},
        {"type": "turn.completed", "usage": {}}])
    reply = await codex_cli.CodexCLIEngine(binary=out).complete(
        [{"role": "system", "content": "You are Mike."}, {"role": "user", "content": "Say hi"}])
    assert reply == "Hi, I'm Mike."
    args = (tmp_path / "args").read_text().split()
    for flag in ("--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--json"):
        assert flag in args
    assert args[args.index("--sandbox") + 1] == "read-only"
    disabled = {args[i + 1] for i, a in enumerate(args) if a == "--disable"}
    assert {"shell_tool", "unified_exec", "apps", "plugins", "browser_use", "computer_use", "multi_agent",
            "code_mode"} <= disabled
    for value in ('web_search="disabled"', "skills.include_instructions=false", "skills.bundled.enabled=false",
                  "agents.max_depth=0"):
        assert value in args
    workdir = args[args.index("-C") + 1]
    assert "vukoli-codex-" in workdir and not Path(workdir).exists()      # an empty folder, removed afterwards
    prompt = (tmp_path / "prompt").read_text()
    assert prompt.startswith(codex_cli.NO_TOOLS) and "You are Mike." in prompt and prompt.rstrip().endswith("Say hi")


async def test_codex_stops_a_run_that_reaches_for_a_tool(tmp_path):
    """D86, fail closed: a tool event despite the flags ends the run with an error, its output never reaches Mike."""
    out = fake_codex(tmp_path, signed_in=True, lines=[
        {"type": "turn.started"},
        {"type": "item.started", "item": {"id": "i0", "type": "command_execution", "command": "ls ~"}},
        {"type": "item.completed", "item": {"id": "i1", "type": "agent_message", "text": "Desktop Documents"}}])
    with pytest.raises(EngineError) as err:
        await codex_cli.CodexCLIEngine(binary=out).complete([{"role": "user", "content": "Say hi"}])
    assert err.value.code == "engine_error" and "command_execution" in err.value.message


async def test_codex_401_forgets_the_sign_in(tmp_path):
    from server import config
    out = fake_codex(tmp_path, signed_in=True, lines=[
        {"type": "turn.started"},
        {"type": "error", "message": "Reconnecting... 1/5 (unexpected status 401 Unauthorized: Missing bearer)"},
        {"type": "turn.failed", "error": {"message": "unexpected status 401 Unauthorized"}}])
    config.update_settings({"codex_cli": {"verified": True}})
    status = await codex_cli.CodexCLIEngine(binary=out).test()
    assert status.code == "unauthorized" and status.hint_command == "codex login"
    assert config.load_settings()["codex_cli"]["verified"] is False


def test_codex_connect_checks_login_then_sends_one_request(monkeypatch):
    from fastapi.testclient import TestClient
    from server import config
    from server.main import create_app
    logged = iter([False, True, True])
    answers = iter([EngineStatus(code="error", message="usage limit"),
                    EngineStatus(code="ready", ready=True, message="Codex answered.")])
    sent = []

    async def fake_test(self):
        sent.append(1)
        return next(answers)
    monkeypatch.setattr(codex_cli, "find_codex", lambda: "/bin/codex")
    monkeypatch.setattr(codex_cli, "signed_in", lambda binary: next(logged))
    monkeypatch.setattr(codex_cli.CodexCLIEngine, "test", fake_test)
    monkeypatch.setattr(codex_cli.CodexCLIEngine, "status", lambda self: _ready_status())
    same = {"Origin": "http://testserver"}
    with TestClient(create_app()) as client:
        client.post("/api/engines/codex_cli/connect", headers=same)
        assert not sent and config.load_settings()["codex_cli"]["verified"] is False   # not signed in: no request
        r = client.post("/api/engines/codex_cli/connect", headers=same).json()
        assert r["status"]["message"] == "usage limit" and config.load_settings()["codex_cli"]["verified"] is False
        r = client.post("/api/engines/codex_cli/connect", headers=same).json()
        assert r["status"]["ready"] is True and config.load_settings()["codex_cli"]["verified"] is True
        assert len(sent) == 2
        client.post("/api/engines/codex_cli/disconnect", headers=same)
        assert "codex_cli" in config.load_settings()["disconnected"]


async def _ready_status():
    return EngineStatus(code="ready", ready=True)


AGY_ID = "5064716f-c4e2-4487-b19d-b2e897b75aed"


def fake_agy(tmp_path, *, signed_in: bool, lines: list[dict], stderr: str = "", wait: int = 0):
    """A stand-in `agy`: `models` exits 0 or 1, a run saves its arguments and stdin, then prints NDJSON events."""
    fake = tmp_path / "agy"
    out = "\n".join(json.dumps(x) for x in lines)
    fake.write_text(f"""#!/bin/sh
if [ "$1" = models ]; then {'echo "gemini-3.8-flash-low"; exit 0' if signed_in else 'echo "Please sign in" >&2; exit 1'}; fi
echo "$@" > "{tmp_path}/args"
pwd > "{tmp_path}/cwd"
cat > "{tmp_path}/prompt"
{f'echo "{stderr}" >&2' if stderr else ''}
{f'sleep {wait}' if wait else ''}
cat <<'JSONL'
{out}
JSONL
""")
    fake.chmod(0o755)
    return str(fake)


def agy_turn(text: str, cid: str = AGY_ID) -> list[dict]:
    return [{"event": "init", "conversation_id": cid, "init": {"cwd": "/x", "tools": ["run_command"],
                                                               "permission_mode": "request-review"}},
            {"event": "step_update", "step_update": {"conversation_id": cid, "step_index": 0, "state": "DONE",
                                                     "step_type": "user_input"}},
            {"event": "step_update", "step_update": {"conversation_id": cid, "step_index": 1, "state": "DONE",
                                                     "step_type": "agent_response", "text_delta": text}},
            {"event": "result", "result": {"conversation_id": cid, "status": "SUCCESS", "response": text + "\n"}}]


async def test_antigravity_status_needs_sign_in_then_a_real_answer(tmp_path):
    """D87: not installed → not signed in (`agy models`) → unverified until Connect → ready."""
    status = await antigravity_cli.AntigravityCLIEngine(binary=None).status()
    assert status.code == "not_installed" and "install.sh" in status.hint_command
    out = fake_agy(tmp_path, signed_in=False, lines=[])
    status = await antigravity_cli.AntigravityCLIEngine(binary=out, verified=True).status()
    assert status.code == "unauthorized" and status.hint_command == "agy"
    antigravity_cli._signed_in_cache.clear()
    out = fake_agy(tmp_path, signed_in=True, lines=[])
    assert (await antigravity_cli.AntigravityCLIEngine(binary=out, verified=None).status()).code == "unverified"
    assert (await antigravity_cli.AntigravityCLIEngine(binary=out, verified=True).status()).ready


async def test_antigravity_runs_fenced_in_and_forgets_its_runs(tmp_path):
    """D87: the prompt goes in on stdin (never on the command line), from an empty folder, in the sandbox, without
    slash commands; the reply is the turn's response; Vukoli deletes its own run from Antigravity's history only."""
    history = tmp_path / "agy-history"
    mine, theirs = history / "conversations" / f"{AGY_ID}.db", history / "conversations" / "user-own.db"
    (history / "brain" / AGY_ID).mkdir(parents=True)
    mine.parent.mkdir(parents=True)
    mine.write_text("x")
    theirs.write_text("y")
    out = fake_agy(tmp_path, signed_in=True, lines=agy_turn("Hi, I'm Mike."))
    reply = await antigravity_cli.AntigravityCLIEngine(binary=out).complete(
        [{"role": "system", "content": "You are Mike."}, {"role": "user", "content": "Say hi"}])
    assert reply == "Hi, I'm Mike."
    args = (tmp_path / "args").read_text().split()
    assert "-p" not in args and "Say" not in args and "--dangerously-skip-permissions" not in args
    for flag in ("--sandbox", "--disable-slash-commands"):
        assert flag in args
    assert args[args.index("--input-format") + 1] == "stream-json" and args[args.index("--effort") + 1] == "low"
    workdir = (tmp_path / "cwd").read_text().strip()
    assert "vukoli-agy-" in workdir and not Path(workdir).exists()        # an empty folder, removed afterwards
    message = json.loads((tmp_path / "prompt").read_text())
    content = message["message"]["content"]
    assert message["event"] == "user" and content.startswith(antigravity_cli.NO_TOOLS)
    assert "You are Mike." in content and content.rstrip().endswith("Say hi")
    assert not mine.exists() and not (history / "brain" / AGY_ID).exists() and theirs.exists()


async def test_antigravity_stops_a_run_that_reaches_for_a_tool(tmp_path):
    """D87, fail closed: web search and subagents run without approval, so any tool step ends the run."""
    for step in ({"step_type": "tool", "state": "ACTIVE", "tool_name": "search_web",
                  "tool_info": {"name": "search_web", "parameters": {"query": "weather"}}},
                 {"step_type": "tool", "state": "DONE", "subagent_info": {"subagents": [
                     {"conversation_id": "8885725d-aa0f-4904-ae4f-deb6179bf64d"}]}}):
        lines = agy_turn("It is sunny.")
        lines.insert(2, {"event": "step_update", "step_update": {"conversation_id": AGY_ID, **step}})
        out = fake_agy(tmp_path, signed_in=True, lines=lines)
        with pytest.raises(EngineError) as err:
            await antigravity_cli.AntigravityCLIEngine(binary=out).complete([{"role": "user", "content": "Say hi"}])
        assert err.value.code == "engine_error" and "Vukoli stopped it" in err.value.message


async def test_antigravity_signed_out_stops_at_once_and_forgets_the_sign_in(tmp_path):
    """D87: signed out, print mode waits a minute for a sign-in code; Vukoli stops it at the first notice."""
    from server import config
    out = fake_agy(tmp_path, signed_in=True, lines=agy_turn("late"), wait=30,
                   stderr="Waiting for authentication (timeout 60s)...")
    config.update_settings({"antigravity_cli": {"verified": True}})
    started = time.monotonic()
    status = await antigravity_cli.AntigravityCLIEngine(binary=out).test()
    assert time.monotonic() - started < 10
    assert status.code == "unauthorized" and status.hint_command == "agy"
    assert config.load_settings()["antigravity_cli"]["verified"] is False


def spare_agy(tmp_path, cid: str = AGY_ID):
    """A stand-in `agy` that notes each start and keeps each message in its own file (one run = one message)."""
    fake = tmp_path / "agy"
    out = "\n".join(json.dumps(x) for x in agy_turn("Hello.", cid))
    fake.write_text(f"""#!/bin/sh
echo $$ >> "{tmp_path}/starts"
pwd >> "{tmp_path}/dirs"
cat > "{tmp_path}/prompt.$$"
cat <<'JSONL'
{out}
JSONL
""")
    fake.chmod(0o755)
    return str(fake)


async def wait_for(check, seconds: float = 3.0):
    import asyncio
    for _ in range(int(seconds / 0.02)):
        if check():
            return True
        await asyncio.sleep(0.02)
    return False


async def test_antigravity_session_keeps_one_spare_ready(tmp_path):
    """D87: starting `agy` is half of a reply's wait, so a session keeps one started ahead; each still gets one
    message only (turns never share a chat), and on shutdown nothing is left: no process, folder or chat."""
    history = tmp_path / "agy-history" / "conversations"
    history.mkdir(parents=True)
    binary = spare_agy(tmp_path)
    engine = antigravity_cli.AntigravityCLIEngine(binary=binary)
    starts = lambda: (tmp_path / "starts").read_text().split() if (tmp_path / "starts").exists() else []
    await engine.warm_up([])
    assert await wait_for(lambda: len(starts()) == 1 and antigravity_cli._spares)
    (history / f"{AGY_ID}.db").write_text("x")
    assert await engine.complete([{"role": "user", "content": "One"}]) == "Hello."
    assert await wait_for(lambda: len(starts()) == 2 and antigravity_cli._spares)   # the next one is waiting
    assert await engine.complete([{"role": "user", "content": "Two"}]) == "Hello."
    assert await wait_for(lambda: len(starts()) == 3 and antigravity_cli._spares)
    first, second, third = starts()
    for pid, word in ((first, "One"), (second, "Two")):
        sent = (tmp_path / f"prompt.{pid}").read_text().strip().splitlines()
        assert len(sent) == 1 and json.loads(sent[0])["message"]["content"].endswith(word)
    assert not (history / f"{AGY_ID}.db").exists()
    await antigravity_cli.close_spares()
    assert not antigravity_cli._spares
    assert not any(Path(d).exists() for d in (tmp_path / "dirs").read_text().split())


async def test_antigravity_background_call_leaves_the_spare_for_mike(tmp_path):
    """D87: feedback on an answer runs alongside Mike's reply; it must not take the started agy (live: 5-6 s → 2 s)."""
    from server.engines.base import BACKGROUND
    binary = spare_agy(tmp_path)
    engine = antigravity_cli.AntigravityCLIEngine(binary=binary)
    await engine.warm_up([])
    assert await wait_for(lambda: antigravity_cli._spares)
    spare = next(iter(antigravity_cli._spares.values()))
    mark = BACKGROUND.set(True)
    try:
        assert await engine.complete([{"role": "user", "content": "Feedback"}]) == "Hello."
    finally:
        BACKGROUND.reset(mark)
    assert next(iter(antigravity_cli._spares.values())) is spare and spare.alive
    assert await engine.complete([{"role": "user", "content": "Reply"}]) == "Hello."
    assert spare.proc.returncode is not None                      # Mike's reply used it
    await antigravity_cli.close_spares()


async def test_antigravity_keeps_no_spare_outside_a_session(tmp_path):
    """D87: Connect or the setup check run alone; a spare only lives while a session uses the engine."""
    binary = spare_agy(tmp_path)
    assert await antigravity_cli.AntigravityCLIEngine(binary=binary).complete([{"role": "user", "content": "Hi"}]) == "Hello."
    assert not await wait_for(lambda: antigravity_cli._spares, 0.5)
    assert len((tmp_path / "starts").read_text().split()) == 1


async def test_antigravity_spare_stops_when_the_session_is_over(tmp_path, monkeypatch):
    monkeypatch.setattr(antigravity_cli, "SPARE_IDLE", 0.3)
    binary = spare_agy(tmp_path)
    await antigravity_cli.AntigravityCLIEngine(binary=binary).warm_up([])
    assert await wait_for(lambda: antigravity_cli._spares)
    run = next(iter(antigravity_cli._spares.values()))
    assert await wait_for(lambda: not antigravity_cli._spares and run.proc.returncode is not None)
    assert await wait_for(lambda: not Path(run.workdir).exists())


def test_antigravity_start_deletes_chats_a_killed_vukoli_left(tmp_path):
    """D87: killed with a spare waiting, Vukoli can't delete that spare's chat; the next start does (its own only)."""
    from fastapi.testclient import TestClient
    from server import config
    from server.main import create_app
    history = tmp_path / "agy-history"
    (history / "conversations").mkdir(parents=True)
    (history / "brain" / AGY_ID).mkdir(parents=True)
    (history / "conversations" / f"{AGY_ID}.db").write_text("x")
    (history / "conversations" / "user-own.db").write_text("y")
    config.data_dir().mkdir(parents=True, exist_ok=True)
    (config.data_dir() / "antigravity-runs.json").write_text(json.dumps([AGY_ID]))
    with TestClient(create_app()):
        pass
    assert not (history / "conversations" / f"{AGY_ID}.db").exists() and not (history / "brain" / AGY_ID).exists()
    assert (history / "conversations" / "user-own.db").exists()
    assert json.loads((config.data_dir() / "antigravity-runs.json").read_text()) == []


def test_antigravity_connect_checks_sign_in_then_sends_one_request(monkeypatch):
    from fastapi.testclient import TestClient
    from server import config
    from server.main import create_app
    signed = iter([False, True])
    sent = []

    async def fake_test(self):
        sent.append(1)
        return EngineStatus(code="ready", ready=True, message="Antigravity answered.")
    monkeypatch.setattr(antigravity_cli, "find_agy", lambda: "/bin/agy")
    monkeypatch.setattr(antigravity_cli, "signed_in", lambda binary, fresh=False: next(signed))
    monkeypatch.setattr(antigravity_cli.AntigravityCLIEngine, "test", fake_test)
    monkeypatch.setattr(antigravity_cli.AntigravityCLIEngine, "status", lambda self: _ready_status())
    same = {"Origin": "http://testserver"}
    with TestClient(create_app()) as client:
        client.post("/api/engines/antigravity_cli/connect", headers=same)
        assert not sent and config.load_settings()["antigravity_cli"]["verified"] is False   # signed out: no request
        r = client.post("/api/engines/antigravity_cli/connect", headers=same).json()
        assert r["status"]["ready"] is True and config.load_settings()["antigravity_cli"]["verified"] is True
        assert len(sent) == 1
        client.post("/api/engines/antigravity_cli/disconnect", headers=same)
        assert "antigravity_cli" in config.load_settings()["disconnected"]


def test_engines_import_without_pwd(monkeypatch):
    """Windows has no `pwd`: the engine modules must import, and child_env must fall back (not crash)."""
    import importlib
    import sys
    monkeypatch.setitem(sys.modules, "pwd", None)   # `import pwd` now raises ImportError
    try:
        for module in (claude_cli, antigravity_cli):
            importlib.reload(module)
        monkeypatch.delenv("USER", raising=False)
        monkeypatch.delenv("LOGNAME", raising=False)
        monkeypatch.delenv("HOME", raising=False)
        monkeypatch.setattr(claude_cli.getpass, "getuser", lambda: "winuser")
        env = claude_cli.child_env()
        assert env["USER"] == "winuser" and env["LOGNAME"] == "winuser" and env["HOME"]
    finally:
        monkeypatch.undo()
        importlib.reload(claude_cli)
        importlib.reload(antigravity_cli)


def test_kill_group_windows_uses_taskkill(monkeypatch):
    calls = []

    class Done:
        returncode = 0
    monkeypatch.setattr(antigravity_cli.sys, "platform", "win32")
    monkeypatch.setattr(antigravity_cli.subprocess, "run", lambda cmd, **kw: calls.append(cmd) or Done())
    antigravity_cli.kill_group(123)
    assert calls == [["taskkill", "/PID", "123", "/T", "/F"]]
    Done.returncode = 128
    with pytest.raises(ProcessLookupError):
        antigravity_cli.kill_group(123)
