"""OpenAI-compatible adapter ("other AI"): LM Studio, llama.cpp server, Jan, OpenRouter, OpenAI, vLLM...

The API key is sent only to the configured base URL and is never logged.
"""
from __future__ import annotations

import ipaddress
import json
from typing import AsyncIterator
from urllib.parse import urlparse

import httpx

from .. import usage
from .base import EngineDescriptor, EngineError, EngineStatus, LLMEngine, Msg, ThinkFilter

DESCRIPTOR = EngineDescriptor(
    id="openai_compatible",
    name="Other AI (OpenAI-compatible)",
    kind="text",
    local=False,
    cost="Depends on the service. Local servers (LM Studio, llama.cpp, Jan) are free.",
    data_line="Your transcribed words go to the server you configure. Speech is still recognised on this computer.",
    needs=["base URL, e.g. http://localhost:1234/v1", "model name", "API key if the service needs one"],
    privacy_note="With a cloud service, its own privacy terms apply.",
)


def is_local_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if host in ("localhost",) or host.endswith(".localhost"):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class OpenAICompatibleEngine(LLMEngine):
    id = "openai_compatible"

    def __init__(self, base_url: str = "", api_key: str = "", model: str = "", *,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = base_url.strip().rstrip("/")
        self._api_key = api_key.strip()
        self._model = model.strip()
        self._transport = transport
        self._schema_mode = "json_schema"   # json_schema -> json_object -> none, downgraded on 400

    def __repr__(self) -> str:  # never show the key
        return f"OpenAICompatibleEngine(base_url={self.base_url!r}, model={self._model!r})"

    @property
    def model(self) -> str:
        return self._model

    @property
    def single_worker(self) -> bool:
        return is_local_url(self.base_url)

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    def _client(self, timeout) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=timeout, transport=self._transport, headers=self._headers())

    async def list_models(self) -> list[str]:
        async with self._client(8) as client:
            response = await client.get(f"{self.base_url}/models")
        if response.status_code in (401, 403):
            raise EngineError("unauthorized", "The API key was rejected.")
        response.raise_for_status()
        return [str(item.get("id", "")) for item in response.json().get("data", [])]

    async def status(self) -> EngineStatus:
        if not self.base_url or not urlparse(self.base_url).scheme in ("http", "https"):
            return EngineStatus(code="not_configured", message="Set the base URL of your AI server.",
                                hint="For LM Studio use http://localhost:1234/v1; for OpenAI https://api.openai.com/v1")
        try:
            models = await self.list_models()
        except EngineError as exc:
            return EngineStatus(code="unauthorized", message=exc.message, hint="Check the API key in Settings.")
        except (httpx.HTTPError, ValueError):
            return EngineStatus(code="unreachable", message=f"No answer from {self.base_url}.",
                                hint="Check that the server is running and the URL ends with /v1.")
        if not self._model:
            return EngineStatus(code="not_configured", message="Choose a model.",
                                hint=("Available: " + ", ".join(models[:10])) if models else "Enter the model name.")
        if models and self._model not in models:
            return EngineStatus(code="no_model", message=f"The server does not list {self._model}.",
                                hint="Available: " + ", ".join(models[:10]), model=self._model)
        return EngineStatus(code="ready", ready=True, message=f"Connected to {self._model}.", model=self._model)

    def _body(self, messages, stream, temperature, max_tokens, json_schema) -> dict:
        body = {"model": self._model, "messages": messages, "stream": stream, "temperature": temperature,
                "max_tokens": max_tokens}
        if json_schema is not None and self._schema_mode == "json_schema":
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": "reply", "schema": json_schema}}
        elif json_schema is not None and self._schema_mode == "json_object":
            body["response_format"] = {"type": "json_object"}
        return body

    async def chat_stream(self, messages: list[Msg], *, temperature: float = 0.6, max_tokens: int = 300,
                          json_schema: dict | None = None) -> AsyncIterator[str]:
        if not self.base_url or not self._model:
            raise EngineError("not_configured", "The AI server is not configured.")
        think = ThinkFilter()
        for _attempt in range(3):
            body = self._body(messages, True, temperature, max_tokens, json_schema)
            try:
                async with self._client(httpx.Timeout(180, connect=8)) as client:
                    usage.count(self.id)
                    async with client.stream("POST", f"{self.base_url}/chat/completions", json=body) as response:
                        if response.status_code == 400 and json_schema is not None and self._schema_mode != "none":
                            await response.aread()
                            self._schema_mode = "json_object" if self._schema_mode == "json_schema" else "none"
                            continue
                        if response.status_code in (401, 403):
                            raise EngineError("unauthorized", "The API key was rejected.")
                        if response.status_code == 404:
                            raise EngineError("model_missing", f"The server does not know the model {self._model}.")
                        if response.status_code == 429:
                            raise EngineError("rate_limited", "The service is rate limiting requests.")
                        if response.status_code >= 400:
                            raise EngineError("engine_error", f"The AI server answered {response.status_code}.")
                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line.startswith("data:"):
                                continue
                            payload = line[5:].strip()
                            if payload == "[DONE]":
                                return
                            try:
                                event = json.loads(payload)
                            except ValueError:
                                continue
                            choices = event.get("choices") or []
                            delta = ((choices[0].get("delta") or {}).get("content") or "") if choices else ""
                            if delta:
                                out = think.feed(delta)
                                if out:
                                    yield out
                        return
            except httpx.ConnectError as exc:
                raise EngineError("unreachable", f"No answer from {self.base_url}.") from exc
        raise EngineError("engine_error", "The AI server rejected the request format.")
