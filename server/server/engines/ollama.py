"""Ollama adapter: any installed model, default chosen by RAM."""
from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import AsyncIterator

import httpx

from .. import usage
from .base import EngineDescriptor, EngineError, EngineStatus, LLMEngine, Msg, ThinkFilter
from .locate import find_program

DOWNLOAD_URL = "https://ollama.com/download"
# qwen3:4b on Ollama is the thinking variant: it ignores think:false. The instruct tag is the default
# for machines under 16 GB of RAM.
MODEL_SMALL = "qwen3:4b-instruct"
MODEL_LARGE = "qwen3:8b"
# Voice sessions default to the small model on every machine: 8b misses the 2-3 s reply target (D28).
VOICE_MODEL = MODEL_SMALL
# Tags known to always think (they write reasoning into the reply). We still send think:false
# and strip a leading <think> block, but warn in the status.
THINKING_ONLY_TAGS = {"qwen3:4b", "qwen3:4b-thinking", "deepseek-r1", "qwq"}
NUM_CTX = 4096
# The model family the app recommends (MODEL_SMALL / MODEL_LARGE) and the memory a larger model needs: the same
# 15.5 GB line that picks MODEL_LARGE as the default. Both models stay loaded for the after-call work, so together
# they must fit in about half of the RAM (the speech models and the system need the rest).
FAMILY = MODEL_LARGE.split(":")[0]
LARGE_MIN_RAM_GB = 15.5
LOADED_SHARE_OF_RAM = 0.55

DESCRIPTOR = EngineDescriptor(
    id="ollama",
    name="Ollama (local)",
    kind="text",
    local=True,
    cost="Free. Runs on this computer.",
    data_line="Your words stay on this computer: speech is recognised locally and the model runs in Ollama.",
    needs=["Ollama installed and running", "one downloaded model"],
    setup_url=DOWNLOAD_URL,
)


def total_ram_gb() -> float:
    try:
        import psutil
        return psutil.virtual_memory().total / 1024 ** 3
    except Exception:  # pragma: no cover - psutil missing
        return 8.0


def recommended_model(ram_gb: float | None = None) -> str:
    ram = total_ram_gb() if ram_gb is None else ram_gb
    return MODEL_LARGE if ram >= 15.5 else MODEL_SMALL


def is_thinking_only(model: str) -> bool:
    name = model.lower()
    return name in THINKING_ONLY_TAGS or "thinking" in name or any(name.startswith(tag + ":") for tag in THINKING_ONLY_TAGS
                                             if ":" not in tag)


APP_PATHS = ("/Applications/Ollama.app", "~/Applications/Ollama.app")


def find_app() -> Path | None:
    """The macOS app bundle, which starts the server on open."""
    for p in APP_PATHS:
        path = Path(p).expanduser()
        if path.is_dir():
            return path
    return None


def find_ollama() -> str | None:
    """The `ollama` binary: PATH, the common folders, or inside the app bundle (D83)."""
    return find_program("ollama", tuple(f"{p}/Contents/Resources/ollama" for p in APP_PATHS))


def installed() -> bool:
    return bool(find_ollama() or find_app())


async def start(url: str, wait_s: float = 15.0) -> bool:
    """"Connect" (D83): open the Ollama app (macOS) or run `ollama serve` in the background, then wait for it."""
    app = find_app() if sys.platform == "darwin" else None
    try:
        if app:
            await (await asyncio.create_subprocess_exec("open", "-g", "-a", str(app))).wait()
        else:
            binary = find_ollama()
            if not binary:
                return False
            host = url.split("://", 1)[-1]
            detach = ({"creationflags": subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP}
                      if sys.platform == "win32" else {"start_new_session": True})
            subprocess.Popen([binary, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             env={**os.environ, "OLLAMA_HOST": host}, **detach)
    except OSError:
        return False
    async with httpx.AsyncClient(timeout=2) as client:
        for _ in range(int(wait_s / 0.5)):
            try:
                if (await client.get(f"{url}/api/tags")).status_code == 200:
                    return True
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.5)
    return False


# ---------- model download (D85) ----------
# Download sizes from the Ollama registry (sum of the layers), shown before the download starts.
MODEL_SIZES_GB = {MODEL_SMALL: 2.5, MODEL_LARGE: 5.2}


def pull_error_text(error: str) -> str:
    """Ollama's own words, plus what to do for the errors we have seen (09.11: ~/.ollama was deleted while Ollama
    ran, so its key file was gone and every download stopped at "pull model manifest")."""
    low = error.lower()
    if "id_ed25519" in low or ".ollama" in low and "no such file" in low:
        return ("Ollama's own files are missing (its .ollama folder was probably deleted while it was running). "
                "Quit Ollama (menu bar or tray icon > Quit), open it again, then download.")
    if "no space left" in low:
        return "Not enough free disk space for this model. Free some space, then download again."
    return error[:300]


class Pull:
    """One model download at a time, run in the background; the app polls its progress."""

    def __init__(self) -> None:
        self.model, self.state, self.phase, self.error = "", "idle", "", ""
        self._layers: dict[str, tuple[int, int]] = {}
        self._task: asyncio.Task | None = None

    def snapshot(self) -> dict:
        done = sum(c for c, _ in self._layers.values())
        total = sum(t for _, t in self._layers.values())
        return {"model": self.model, "state": self.state, "phase": self.phase, "error": self.error,
                "completed": done, "total": total}

    def start(self, url: str, model: str) -> None:
        if self.state == "pulling":
            return
        self.model, self.state, self.phase, self.error, self._layers = model, "pulling", "manifest", "", {}
        self._task = asyncio.create_task(self._run(url, model))

    async def cancel(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self, url: str, model: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10, read=None)) as client:
                async with client.stream("POST", f"{url}/api/pull", json={"model": model, "stream": True}) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.strip():
                            self._step(json.loads(line))
            if self.state == "pulling":
                raise EngineError("pull_failed", "Ollama stopped before the model was ready.")
        except asyncio.CancelledError:
            self.state, self.phase = "cancelled", ""
            raise
        except EngineError as exc:
            self.state, self.error = "error", exc.message
        except (httpx.HTTPError, ValueError):
            self.state, self.error = "error", "Ollama stopped answering. Check that it is running and try again."

    def _step(self, event: dict) -> None:
        if event.get("error"):
            raise EngineError("pull_failed", pull_error_text(str(event["error"])))
        status = str(event.get("status", ""))
        if event.get("digest") and event.get("total"):
            self._layers[event["digest"]] = (int(event.get("completed") or 0), int(event["total"]))
            self.phase = "download"
        elif status.startswith("verifying"):
            self.phase = "verify"
        elif status == "success":
            self.state, self.phase = "done", ""


pull = Pull()


def install_hint(model: str) -> str:
    return f"Install Ollama from {DOWNLOAD_URL}, start it, then run: ollama pull {model}"


def _billions(model: dict) -> float:
    """Parameter count in billions: Ollama's "8.2B" label, else the size in the tag, else file size as a guess."""
    for text in (model.get("parameter_size", ""), model.get("name", "")):
        match = re.search(r"(\d+(?:\.\d+)?)\s*b\b", text.lower().replace(":", " "))
        if match:
            return float(match.group(1))
    return model.get("size", 0) / 0.6e9


class OllamaEngine(LLMEngine):
    id = "ollama"

    def __init__(self, url: str = "http://127.0.0.1:11434", model: str = "", *,
                 transport: httpx.AsyncBaseTransport | None = None, ram_gb: float | None = None,
                 default_model: str = ""):
        self.url = url.rstrip("/")
        self.requested_model = model.strip()
        self._transport = transport
        self._ram_gb = ram_gb
        self._default = default_model.strip()   # replaces the RAM default when no model is chosen
        self._resolved: str | None = None

    def _default_model(self) -> str:
        return self._default or recommended_model(self._ram_gb)

    # ----- helpers -----
    def _client(self, timeout: float | httpx.Timeout = 10) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=timeout, transport=self._transport)

    @property
    def model(self) -> str:
        return self._resolved or self.requested_model or self._default_model()

    @property
    def single_worker(self) -> bool:
        return True

    async def list_models(self) -> list[dict]:
        async with self._client(5) as client:
            response = await client.get(f"{self.url}/api/tags")
            response.raise_for_status()
        models = []
        for item in response.json().get("models", []):
            details = item.get("details") or {}
            models.append({"name": item.get("name", ""), "size": item.get("size", 0),
                           "parameter_size": details.get("parameter_size", ""),
                           "family": details.get("family", ""),
                           "thinking_only": is_thinking_only(item.get("name", ""))})
        return models

    async def bigger_sibling(self) -> "OllamaEngine | None":
        """For the after-call language check in English practice (D106): the best installed model of the
        recommended family that is larger than this one (not a reasoning-only tag), or None when there is none or
        this machine cannot hold both. Same server, same transport; it never downloads anything."""
        ram = total_ram_gb() if self._ram_gb is None else self._ram_gb
        if ram < LARGE_MIN_RAM_GB:
            return None
        models = {m["name"]: m for m in await self.list_models()}
        mine = models.get(await self._ensure_model())
        if not mine:
            return None
        mine_size = _billions(mine)
        options = [m for m in models.values()
                   if m["name"].split(":")[0] == FAMILY and not m["thinking_only"] and _billions(m) > mine_size + 0.5
                   and (m["size"] + mine["size"]) / 1024 ** 3 <= ram * LOADED_SHARE_OF_RAM]
        if not options:
            return None
        best = max(options, key=_billions)
        return OllamaEngine(self.url, best["name"], transport=self._transport, ram_gb=self._ram_gb)

    async def _resolve(self) -> tuple[str, list[str]]:
        """Pick the effective model: the user's choice, else the RAM default, else a close installed one."""
        names = [m["name"] for m in await self.list_models()]
        if self.requested_model:
            wanted = self.requested_model
            match = wanted if wanted in names else (f"{wanted}:latest" if f"{wanted}:latest" in names else "")
            return match, names
        default = self._default_model()
        for candidate in (default, MODEL_LARGE if default == MODEL_SMALL else MODEL_SMALL):
            if candidate in names and not is_thinking_only(candidate):
                return candidate, names
        usable = [n for n in names if not is_thinking_only(n) and "embed" not in n]
        return (usable[0] if usable else ""), names

    async def status(self) -> EngineStatus:
        default = self.requested_model or self._default_model()
        try:
            model, names = await self._resolve()
        except httpx.HTTPError:
            if not installed():
                return EngineStatus(code="not_installed", message="Ollama is not installed.",
                                    hint=install_hint(default), hint_command=f"ollama pull {default}",
                                    fix_url=DOWNLOAD_URL, model=default)
            return EngineStatus(code="not_running", message="Ollama is installed but not running.",
                                hint="Open the Ollama app, or run: ollama serve", hint_command="ollama serve",
                                fix_url=DOWNLOAD_URL, model=default)
        if not model:
            return EngineStatus(code="no_model", message=f"The model {default} is not downloaded.",
                                hint=f"Run: ollama pull {default}", hint_command=f"ollama pull {default}",
                                fix_url=DOWNLOAD_URL, model=default,
                                warnings=[f"Installed models: {', '.join(names)}"] if names else [])
        self._resolved = model
        warnings = []
        if is_thinking_only(model):
            warnings.append(f"{model} is a reasoning model and may be slow or print its thinking. "
                            f"Prefer {MODEL_SMALL} or {MODEL_LARGE}.")
        return EngineStatus(code="ready", ready=True, message=f"Ollama is ready with {model}.", model=model,
                            warnings=warnings)

    async def _ensure_model(self) -> str:
        if self._resolved:
            return self._resolved
        try:
            model, _ = await self._resolve()
        except httpx.HTTPError as exc:
            raise EngineError("ollama_not_running", "Ollama is not running.",
                              "Open the Ollama app, or run: ollama serve") from exc
        if not model:
            want = self.requested_model or self._default_model()
            raise EngineError("model_missing", f"The model {want} is not downloaded.", f"Run: ollama pull {want}")
        self._resolved = model
        return model

    def _body(self, model: str, messages: list[Msg], stream: bool, temperature: float, max_tokens: int,
              json_schema: dict | None) -> dict:
        body = {"model": model, "messages": messages, "stream": stream, "think": False, "keep_alive": "30m",
                "options": {"num_ctx": NUM_CTX, "num_predict": max_tokens, "temperature": temperature}}
        if json_schema is not None:
            body["format"] = json_schema
        return body

    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        model = await self._ensure_model()
        body = self._body(model, messages, True, temperature, max_tokens, json_schema)
        think = ThinkFilter()
        try:
            async with self._client(httpx.Timeout(180, connect=5)) as client:
                usage.count(self.id)
                async with client.stream("POST", f"{self.url}/api/chat", json=body) as response:
                    if response.status_code == 404:
                        raise EngineError("model_missing", f"The model {model} is not downloaded.",
                                          f"Run: ollama pull {model}")
                    if response.status_code >= 400:
                        raise EngineError("engine_error", f"Ollama answered {response.status_code}.")
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        event = json.loads(line)
                        if event.get("error"):
                            raise EngineError("engine_error", str(event["error"])[:300])
                        delta = (event.get("message") or {}).get("content", "")
                        if delta:
                            out = think.feed(delta)
                            if out:
                                yield out
        except httpx.ConnectError as exc:
            raise EngineError("ollama_not_running", "Ollama is not running.",
                              "Open the Ollama app, or run: ollama serve") from exc

    async def warm_up(self, messages: list[Msg]) -> None:
        """Load the model and pre-read the system prompt so the first answer is fast (keep_alive 30m)."""
        try:
            model = await self._ensure_model()
            async with self._client(300) as client:
                await client.post(f"{self.url}/api/chat",
                                  json=self._body(model, messages, False, 0.6, 1, None))
        except (httpx.HTTPError, EngineError):
            pass
