"""REST API. Errors use HTTP status codes with a JSON body {"detail": {"code": ..., "message": ...}}."""
from __future__ import annotations

import asyncio
import base64
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, Field

from . import (DATA_VERSION, __version__, config, content, debrief_view, engines, feedback, memory, planner, postcall, storage, stt,
               telemetry, tts, usage)
from .documents import DocumentError, read_file, read_url
from .engines import antigravity_cli, claude_cli, codex_cli
from .engines import ollama as ollama_engine
from .engines.base import EngineError

router = APIRouter(prefix="/api")


def fail(status: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message, **extra})


def check_origin(request: Request) -> None:
    """State-changing calls only from this app's own pages or the Vite dev server (CSRF guard)."""
    origin = request.headers.get("origin")
    if not origin:
        return
    host = request.headers.get("host", "")
    if origin.rstrip("/") not in {f"http://{host}", f"https://{host}"} | config.DEV_ORIGINS:
        raise fail(403, "origin_not_allowed", "This request came from another website.")


# ---------- health, engines, settings ----------

@router.get("/health")
async def health() -> dict:
    return {"ok": True, "version": __version__, "data_version": DATA_VERSION, "data_dir": str(config.data_dir()),
            "web_built": config.web_dist_dir().joinpath("index.html").is_file(),
            "storage_ok": await asyncio.to_thread(config.data_dir_writable)}      # US-23 AC4


@router.get("/engines")
async def list_engines() -> dict:
    settings = config.load_settings()
    return {"selected": settings["engine"], "engines": await engines.all_engines(settings)}


@router.get("/engines/ollama/models")
async def ollama_models() -> dict:
    settings = config.load_settings()
    if config.e2e_enabled():                        # test mode: the scripted engine's one model, no real Ollama asked
        from .engines import scripted
        ready = (await engines.engine_status("ollama", settings)).ready
        return {"models": [{"name": scripted.MODEL, "size": 1, "thinking_only": False}] if ready else [],
                "recommended": ollama_engine.MODEL_SMALL, "ram_gb": 16.0, "selected": scripted.MODEL if ready else "",
                "recommended_voice": ollama_engine.VOICE_MODEL, "selected_voice": ""}
    engine = ollama_engine.OllamaEngine(config.ollama_url(settings), settings["ollama"].get("model", ""))
    try:
        models = await engine.list_models()
    except Exception:
        status = await engine.status()
        return {"models": [], "status": status.model_dump(), "recommended": ollama_engine.recommended_model(),
                "recommended_voice": ollama_engine.VOICE_MODEL}
    return {"models": [{"name": m.get("name"), "size": m.get("size"),
                        "thinking_only": ollama_engine.is_thinking_only(m.get("name", ""))} for m in models],
            "recommended": ollama_engine.recommended_model(), "ram_gb": round(ollama_engine.total_ram_gb(), 1),
            "selected": settings["ollama"].get("model", ""),
            "recommended_voice": ollama_engine.VOICE_MODEL, "selected_voice": settings["ollama"].get("voice_model", "")}


class PullRequest(BaseModel):
    model: str = Field(min_length=1, max_length=100, pattern=r"^[\w.\-/:]+$")


def _pull_state() -> dict:
    return {**ollama_engine.pull.snapshot(), "recommended": ollama_engine.recommended_model(),
            "options": [{"model": m, "size_gb": gb} for m, gb in ollama_engine.MODEL_SIZES_GB.items()]}


@router.get("/engines/ollama/pull")
async def ollama_pull_state() -> dict:
    """The model download (D85): idle | pulling | done | error | cancelled, bytes so far and in all."""
    return _pull_state()


@router.post("/engines/ollama/pull")
async def ollama_pull(body: PullRequest, request: Request) -> dict:
    check_origin(request)
    current = ollama_engine.pull.snapshot()
    if current["state"] == "pulling" and current["model"] != body.model:
        raise fail(409, "pull_busy", f"{current['model']} is downloading. Wait for it or cancel it first.")
    ollama_engine.pull.start(config.ollama_url(config.load_settings()), body.model)
    return _pull_state()


@router.delete("/engines/ollama/pull")
async def ollama_pull_cancel(request: Request) -> dict:
    check_origin(request)
    await ollama_engine.pull.cancel()
    return _pull_state()


@router.get("/engines/{engine_id}/status")
async def engine_status(engine_id: str) -> dict:
    if engine_id not in engines.DESCRIPTORS:
        raise fail(404, "unknown_engine", "Unknown engine.")
    return (await engines.engine_status(engine_id)).model_dump()


@router.get("/engines/{engine_id}/limits")
async def engine_limits(engine_id: str) -> dict:
    """D88: how much of the user's plan is used. Codex: read from the CLI (no model request); Claude Code: what its
    last reply said; Antigravity / Gemini: Vukoli's own count. Only for a ready engine."""
    if engine_id not in engines.DESCRIPTORS:
        raise fail(404, "unknown_engine", "Unknown engine.")
    if not (await engines.engine_status(engine_id)).ready:
        return {"engine": engine_id, "kind": "none"}
    return await usage.limits_for(engine_id, codex_cli.find_codex() if engine_id == "codex_cli" else None)


@router.post("/engines/{engine_id}/connect")
async def engine_connect(engine_id: str, request: Request) -> dict:
    """"Connect" (D83): find the engine the user already installed and, for Ollama, start it. The fresh status."""
    check_origin(request)
    if engine_id not in engines.DESCRIPTORS:
        raise fail(404, "unknown_engine", "Unknown engine.")
    settings = config.load_settings()
    if engine_id in settings["disconnected"]:
        settings = config.update_settings({"disconnected": [e for e in settings["disconnected"] if e != engine_id]})
    started = False
    if engine_id == "ollama" and (await engines.engine_status("ollama", settings)).code == "not_running":
        if config.e2e_enabled():                    # test mode: nothing real is launched
            from .engines import scripted
            started = scripted.start()
        else:
            started = await ollama_engine.start(config.ollama_url(settings))
    if engine_id == "claude_cli" and claude_cli.find_claude():
        # D85: one real short request proves the sign-in (it costs one request on the user's plan).
        tested = await claude_cli.ClaudeCLIEngine(settings["claude_cli"].get("model", "haiku")).test()
        if tested.code in ("ready", "unauthorized"):
            settings = config.update_settings({"claude_cli": {"verified": tested.ready}})
        if not tested.ready:
            return {"status": tested.model_dump(), "started": False}
    if engine_id == "codex_cli" and (binary := codex_cli.find_codex()):
        # D86: the same for Codex, once `codex login status` says it's signed in (that check is local and free).
        if not await asyncio.to_thread(codex_cli.signed_in, binary):
            settings = config.update_settings({"codex_cli": {"verified": False}})
        else:
            tested = await codex_cli.CodexCLIEngine(settings["codex_cli"].get("model", "")).test()
            if tested.code in ("ready", "unauthorized"):
                settings = config.update_settings({"codex_cli": {"verified": tested.ready}})
            if not tested.ready:
                return {"status": tested.model_dump(), "started": False}
    if engine_id == "antigravity_cli" and (binary := antigravity_cli.find_agy()):
        # D87: and for Antigravity, once `agy models` says it's signed in (that check sends no prompt).
        if not await asyncio.to_thread(antigravity_cli.signed_in, binary, True):
            settings = config.update_settings({"antigravity_cli": {"verified": False}})
        else:
            tested = await antigravity_cli.AntigravityCLIEngine(settings["antigravity_cli"].get("model", "")).test()
            if tested.code in ("ready", "unauthorized"):
                settings = config.update_settings({"antigravity_cli": {"verified": tested.ready}})
            if not tested.ready:
                return {"status": tested.model_dump(), "started": False}
    return {"status": (await engines.engine_status(engine_id, settings)).model_dump(), "started": started}


@router.post("/engines/{engine_id}/disconnect")
async def engine_disconnect(engine_id: str, request: Request) -> dict:
    """"Disconnect" (D84): Ollama / Claude Code / Codex / Antigravity are switched off in the app only (Ollama keeps running for other apps);
    an OpenAI-compatible service or Gemini forgets its key (and the service address)."""
    check_origin(request)
    if engine_id not in engines.DESCRIPTORS:
        raise fail(404, "unknown_engine", "Unknown engine.")
    settings = config.load_settings()
    if engine_id in config.LOCAL_ENGINES:
        patch: dict = {"disconnected": sorted({*settings["disconnected"], engine_id})}
    elif engine_id == "openai_compatible":
        patch = {"openai_compatible": {"api_key": "", "base_url": "", "model": ""}}
    else:
        patch = {"gemini_live": {"api_key": ""}}
    settings = config.update_settings(patch)
    return {"status": (await engines.engine_status(engine_id, settings)).model_dump()}


@router.post("/engines/{engine_id}/test")
async def engine_test(engine_id: str, request: Request) -> dict:
    """A tiny real request to the engine, with its latency."""
    check_origin(request)
    if engine_id not in engines.DESCRIPTORS:
        raise fail(404, "unknown_engine", "Unknown engine.")
    settings = config.load_settings()
    llm = engines.make_llm(settings, engine_id)
    status = await llm.status()
    if not status.ready:
        return {"ok": False, "status": status.model_dump()}
    started = time.perf_counter()
    if hasattr(llm, "test"):                       # Claude CLI and Gemini: their own real round trip
        tested = await llm.test()
        return {"ok": tested.ready, "status": tested.model_dump(),
                "latency_ms": round((time.perf_counter() - started) * 1000)}
    try:
        reply = await asyncio.wait_for(llm.complete(
            [{"role": "system", "content": "Reply with one word."}, {"role": "user", "content": "Say: ready"}],
            temperature=0, max_tokens=8), timeout=90)
    except (EngineError, asyncio.TimeoutError) as exc:
        return {"ok": False, "status": status.model_dump(), "code": getattr(exc, "code", "timeout"),
                "message": getattr(exc, "message", "The engine did not answer in time.")}
    return {"ok": bool(reply.strip()), "status": status.model_dump(),
            "latency_ms": round((time.perf_counter() - started) * 1000), "reply": reply.strip()[:40]}


class SettingsPatch(BaseModel):
    model_config = {"extra": "forbid"}
    engine: Optional[str] = None
    ollama: Optional[dict] = None
    openai_compatible: Optional[dict] = None
    claude_cli: Optional[dict] = None
    codex_cli: Optional[dict] = None
    antigravity_cli: Optional[dict] = None
    gemini_live: Optional[dict] = None
    voice: Optional[str] = None
    kokoro_speed: Optional[float] = None
    stt: Optional[dict] = None
    answer_suggester: Optional[bool] = None
    telemetry_opt_in: Optional[bool] = None
    obsidian_dir: Optional[str] = None
    layer_order: Optional[str] = None
    level: Optional[str] = None
    strictness: Optional[int] = None
    questions_per_session: Optional[int] = None
    name: Optional[str] = Field(default=None, max_length=200)


@router.get("/settings")
async def get_settings() -> dict:
    return config.public_settings()


@router.post("/settings")
async def post_settings(patch: SettingsPatch, request: Request) -> dict:
    check_origin(request)
    data = patch.model_dump(exclude_none=True)
    if "engine" in data and data["engine"] not in config.ENGINES:
        raise fail(422, "unknown_engine", "Unknown engine.")
    if data.get("obsidian_dir"):
        from pathlib import Path
        if not Path(data["obsidian_dir"]).expanduser().is_dir():
            raise fail(422, "folder_not_found", "That folder does not exist.")
    for section in ("openai_compatible", "gemini_live"):
        block = data.get(section)
        if block is not None and "api_key" in block and block["api_key"] is None:
            block.pop("api_key")
    return config.public_settings(config.update_settings(data))


# ---------- speech ----------

@router.get("/voices")
async def voices() -> dict:
    return {"voices": tts.list_voices(), "default": tts.DEFAULT_VOICE, "tts": tts.status()}


@router.get("/voices/sample")
async def voice_sample(voice: str = "") -> Response:
    settings = config.load_settings()
    if not tts.status(settings)["available"]:
        raise fail(503, "tts_unavailable", "Speech is not set up. The app works in text-only mode.")
    wav = await asyncio.to_thread(tts.synthesize_wav, content.copy("voice_sample"), voice,
                                  settings["kokoro_speed"], settings)
    return Response(wav, media_type="audio/wav")


class VoiceCheckBody(BaseModel):
    model_config = {"extra": "forbid"}
    audio: Optional[str] = Field(default=None, max_length=2_000_000)   # base64 PCM16 16 kHz mono, up to ~45 s
    text: Optional[str] = Field(default=None, max_length=500)          # what the browser's recogniser heard
    voice: str = Field(default="", max_length=64)


VOICE_CHECK_SYSTEM = ("You are Mike, a friendly interview coach. This is a quick microphone check before the first "
                      "practice round. Reply in one short spoken sentence (at most 15 words): show you heard what "
                      "they said, and say everything works. No questions, no lists.")


@router.post("/check/voice")
async def voice_check(body: VoiceCheckBody, request: Request) -> dict:
    """Setup check (US-02 AC2): what you said → what was recognised → Mike's reply, in his voice when speech is on."""
    check_origin(request)
    settings = config.load_settings()
    started = time.perf_counter()
    heard = (body.text or "").strip()
    if not heard and body.audio:
        recogniser = stt.get_stt(settings)
        if not recogniser.available:
            raise fail(503, "stt_unavailable", "Speech recognition is not set up on this computer.")
        try:
            pcm = base64.b64decode(body.audio, validate=True)
        except ValueError:
            raise fail(422, "bad_audio", "The recording could not be read.")
        heard = (await asyncio.to_thread(recogniser.transcribe, pcm, False)).text.strip()
    if not heard:
        return {"ok": False, "code": "not_heard", "heard": "", "message": "Mike didn't catch anything."}
    llm = engines.make_llm(settings, voice=True)
    status = await llm.status()
    if not status.ready:
        return {"ok": False, "code": status.code, "heard": heard, "message": status.message}
    try:
        reply = await asyncio.wait_for(llm.complete(
            [{"role": "system", "content": VOICE_CHECK_SYSTEM + content.name_line(settings.get("name", ""))},
             {"role": "user", "content": heard}], temperature=0.4, max_tokens=60), timeout=90)
    except (EngineError, asyncio.TimeoutError) as exc:
        return {"ok": False, "code": getattr(exc, "code", "timeout"), "heard": heard,
                "message": getattr(exc, "message", "The engine did not answer in time.")}
    reply = reply.strip() or "I can hear you. Everything works."
    audio = None
    if tts.status(settings)["available"]:
        wav = await asyncio.to_thread(tts.synthesize_wav, reply, body.voice or settings.get("voice", ""),
                                      settings["kokoro_speed"], settings)
        audio = base64.b64encode(wav).decode("ascii")
    return {"ok": True, "heard": heard, "reply": reply, "audio": audio,
            "latency_ms": round((time.perf_counter() - started) * 1000)}


@router.get("/tts")
async def tts_status() -> dict:
    return tts.status()


@router.get("/stt")
async def stt_status() -> dict:
    return stt.get_stt(config.load_settings()).info()


class TranscribeBody(BaseModel):
    data: str = Field(max_length=5_200_000)         # base64 of 16 kHz mono PCM16, up to 2 minutes


DICTATION_MAX_S = 120


@router.post("/stt/transcribe")
async def stt_transcribe(body: TranscribeBody, request: Request) -> dict:
    """Dictation into a text field (D90): one clip of 16 kHz mono PCM16 → its text, on this computer. Nothing is kept."""
    check_origin(request)
    engine = stt.get_stt(config.load_settings())
    if not engine.available:
        raise fail(503, "stt_unavailable", "Speech recognition isn't set up on this computer.")
    try:
        pcm = base64.b64decode(body.data, validate=True)
    except ValueError:
        raise fail(422, "bad_audio", "The recording couldn't be read.")
    if len(pcm) % 2 or len(pcm) / 2 / 16000 > DICTATION_MAX_S:
        raise fail(422, "bad_audio", "The recording couldn't be read.")
    result = await asyncio.to_thread(engine.transcribe, pcm, False)
    return {"text": result.text, "duration_s": round(result.duration_s, 1)}


# ---------- profile (CV / about me) ----------

class ProfileBody(BaseModel):
    text: str = Field(max_length=40000)
    source: str = Field(default="pasted", max_length=300)


class UploadBody(BaseModel):
    name: str = Field(max_length=300)
    data: str = Field(max_length=12_000_000)        # base64
    replace: Optional[str] = Field(default=None, max_length=64)   # profile: the file id to swap (D79)


@router.get("/profile")
async def get_profile() -> dict:
    return storage.read_profile()


@router.put("/profile")
async def put_profile(body: ProfileBody, request: Request) -> dict:
    check_origin(request)
    return storage.save_profile(body.text, body.source)


@router.post("/profile/upload")
async def upload_profile(body: UploadBody, request: Request) -> dict:
    check_origin(request)
    try:
        text = await asyncio.to_thread(read_file, body.name, body.data)
    except DocumentError as exc:
        raise fail(422, exc.code, exc.message)
    try:
        return storage.add_profile_file(body.name, text, body.replace)
    except storage.ProfileFull as exc:
        raise fail(422, "too_many_files", str(exc))


@router.delete("/profile/files/{file_id}")
async def delete_profile_file(file_id: str, request: Request) -> dict:
    check_origin(request)
    return storage.delete_profile_file(file_id)


@router.delete("/profile")
async def delete_profile(request: Request) -> dict:
    check_origin(request)
    storage.delete_profile()
    return {"ok": True}


# ---------- vacancies (job postings) ----------

class VacancyBody(BaseModel):
    title: str = Field(default="", max_length=200)
    text: str = Field(default="", max_length=40000)
    url: str = Field(default="", max_length=2000)
    file: Optional[UploadBody] = None


def _vacancy_or_404(vacancy_id: str) -> dict:
    try:
        return storage.read_record("vacancies", vacancy_id)
    except (OSError, ValueError):
        raise fail(404, "not_found", "Job posting not found.")


@router.get("/vacancies")
async def list_vacancies() -> dict:
    items = sorted(storage.list_records("vacancies"), key=lambda v: v.get("created_at", ""), reverse=True)
    return {"vacancies": [{"id": v["id"], "title": v.get("title", ""), "created_at": v.get("created_at", ""),
                           "source": v.get("source", ""), "questions": len(v.get("questions", []))} for v in items]}


@router.post("/vacancies")
async def create_vacancy(body: VacancyBody, request: Request) -> dict:
    check_origin(request)
    text, source = body.text.strip(), "pasted"
    try:
        if not text and body.url:
            text, source = await asyncio.to_thread(read_url, body.url), body.url
        elif not text and body.file:
            text, source = await asyncio.to_thread(read_file, body.file.name, body.file.data), f"file:{body.file.name}"
    except DocumentError as exc:
        raise fail(422, exc.code, exc.message)
    if len(text) < 80:
        raise fail(422, "too_short", "Paste the job posting text (at least a few sentences).")
    title = body.title.strip() or posting_title(text)
    record = {"id": storage.new_id("v-"), "title": title, "text": text, "source": source[:300],
              "created_at": storage.now_iso(), "questions": []}
    return storage.save_record("vacancies", record)


# Section headers job boards put above the posting (LinkedIn's "About the job"): never a title (D69).
POSTING_HEADERS = {"about the job", "about the role", "about this role", "job description", "description",
                   "job details", "the role", "overview", "about us", "about the company"}


def posting_title(text: str) -> str:
    """The first line of a pasted posting that is not a board's section header; "Job posting" when there is none."""
    for line in text.splitlines():
        clean = line.strip().rstrip(":").strip()
        if clean and clean.lower() not in POSTING_HEADERS:
            return storage.job_name(clean[:80])
    return "Job posting"


@router.get("/vacancies/{vacancy_id}")
async def get_vacancy(vacancy_id: str) -> dict:
    return _vacancy_or_404(vacancy_id)


@router.delete("/vacancies/{vacancy_id}")
async def delete_vacancy(vacancy_id: str, request: Request) -> dict:
    check_origin(request)
    try:
        return storage.trash_record("vacancies", vacancy_id)
    except FileNotFoundError:
        raise fail(404, "not_found", "Job posting not found.")


@router.post("/vacancies/{vacancy_id}/questions")
async def vacancy_questions(vacancy_id: str, request: Request) -> dict:
    """P0: questions from the user's CV and this job posting; cached on the vacancy record."""
    check_origin(request)
    vacancy = _vacancy_or_404(vacancy_id)
    settings = config.load_settings()
    llm = engines.make_llm(settings)
    try:
        questions = await planner.generate_questions(llm, storage.read_profile().get("text", ""), vacancy["text"])
    except EngineError as exc:
        raise fail(502, exc.code, exc.message, hint=exc.hint)
    vacancy["questions"] = [q.public() for q in questions]
    storage.save_record("vacancies", vacancy)
    return {"questions": vacancy["questions"]}


@router.get("/question-bank")
async def question_bank() -> dict:
    return {"questions": [q.public() for q in content.question_bank()], "round_types": content.ROUND_TYPES}


# ---------- sessions ----------

def _session_or_404(session_id: str) -> dict:
    try:
        return storage.read_record("sessions", session_id)
    except (OSError, ValueError):
        raise fail(404, "not_found", "Session not found.")


def _repair_if_orphaned(session: dict) -> dict:
    """D96: a record marked as being prepared although no job runs and no call is continuing it (the server stopped, or
    the job died) is closed as interrupted, so its page does not wait for ever."""
    from . import ws
    marker = session.get("post_call")
    if marker and not postcall.is_running(session["id"]) and session["id"] not in ws.OWNER:
        if postcall.repair(session, config.load_settings()["layer_order"]):
            storage.save_session(session)
    return session


def _shown_debrief(session: dict) -> dict | None:
    """The debrief as the page gets it: the saved one plus the scorecard, "what you said / how it lands" and the plan,
    built now from the saved feedback (rubric §9). The saved session never holds these."""
    return debrief_view.enrich_debrief(session.get("debrief"), session.get("feedback") or [], session.get("mode", ""))


def _not_while_preparing(session_id: str) -> None:
    """The feedback of a session being prepared still changes: edits wait for it (409, the page tries again)."""
    if postcall.is_running(session_id):
        raise fail(409, "still_preparing", "The feedback for this session is still being prepared.")


@router.get("/sessions")
async def list_sessions() -> dict:
    items = sorted(storage.list_records("sessions"), key=lambda s: s.get("started_at", ""), reverse=True)
    return {"sessions": [{"id": s["id"], "title": storage.display_title(s.get("title", "")), "mode": s.get("mode", ""),
                          "started_at": s.get("started_at", ""), "duration_s": s.get("duration_s"),
                          "engine": s.get("engine", ""), "answers": (s.get("stats") or {}).get("answers", 0),
                          "verdict": (s.get("debrief") or {}).get("verdict", ""),
                          "too_short": bool((s.get("debrief") or {}).get("too_short")),
                          "planned": len(s.get("questions") or []),
                          "archived": bool(s.get("archived")),
                          "first_question": _first_question(s)} for s in items]}


def _first_question(record: dict) -> str:
    """D69: the first main question asked, so History rows with the same title can be told apart."""
    asked = next((t.get("question_id") for t in record.get("transcript") or [] if t.get("kind") == "question"), None)
    for q in record.get("questions") or []:
        if isinstance(q, dict) and (asked is None or q.get("id") == asked):
            return str(q.get("text") or "")
    return ""


@router.get("/sessions/trash")
async def sessions_trash() -> dict:
    return {"items": storage.list_trash("sessions")}


@router.post("/sessions/trash/{trash_id}/restore")
async def restore_session(trash_id: str, request: Request) -> dict:
    check_origin(request)
    try:
        data = storage.restore_record("sessions", trash_id)
    except FileNotFoundError:
        raise fail(404, "not_found", "Not in the trash.")
    except FileExistsError:
        raise fail(409, "conflict", "A session with this id already exists.")
    return {"ok": True, "id": data.get("id")}


@router.delete("/sessions/trash/{trash_id}")
async def purge_session(trash_id: str, request: Request) -> dict:
    """Delete from the trash for good (US-23 AC2); the app asks first."""
    check_origin(request)
    try:
        storage.purge_trashed("sessions", trash_id)
    except FileNotFoundError:
        raise fail(404, "not_found", "Not in the trash.")
    return {"ok": True, "trash_id": trash_id}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    record = _repair_if_orphaned(_session_or_404(session_id))
    shown = {**record, "title": storage.display_title(record.get("title", ""))}
    if "debrief" in record:
        shown["debrief"] = _shown_debrief(record)
    return shown


@router.get("/sessions/{session_id}/markdown")
async def session_markdown(session_id: str) -> PlainTextResponse:
    return PlainTextResponse(storage.render_session_markdown(_session_or_404(session_id)),
                             media_type="text/markdown; charset=utf-8")


class SessionPatch(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    archived: Optional[bool] = None


@router.patch("/sessions/{session_id}")
async def patch_session(session_id: str, patch: SessionPatch, request: Request) -> dict:
    """D80: rename a session (US-23 AC2) or move it to the Archive and back."""
    check_origin(request)
    record = _session_or_404(session_id)
    if patch.title is not None:
        title = " ".join(patch.title.split())[:80]
        if not title:
            raise fail(422, "title_empty", "The name can't be empty.")
        record["title"] = title
    if patch.archived is not None:
        if patch.archived:
            record["archived"] = True
            record["archived_at"] = storage.now_iso()
        else:
            record.pop("archived", None)
            record.pop("archived_at", None)
    storage.save_record("sessions", record)
    return {"id": record["id"], "title": record.get("title", ""), "archived": bool(record.get("archived"))}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, request: Request) -> dict:
    check_origin(request)
    try:
        return storage.trash_record("sessions", session_id)
    except FileNotFoundError:
        raise fail(404, "not_found", "Session not found.")


@router.post("/sessions/{session_id}/debrief")
async def rerun_debrief(session_id: str, request: Request) -> dict:
    check_origin(request)
    _not_while_preparing(session_id)
    session = _session_or_404(session_id)
    settings = config.load_settings()
    llm = None
    if session.get("mode") == "interview":
        try:
            llm = engines.make_llm(settings)
        except EngineError:
            llm = None
    past = memory.past_weak_spots_text(session_id)
    session["debrief"] = await feedback.debrief(llm, session.get("feedback", []),
                                                layer_order=settings["layer_order"], past=past)
    storage.save_session(session)
    return _shown_debrief(session)


class FlagBody(BaseModel):
    feedback_id: str = Field(max_length=40)
    action: str = Field(max_length=20)


@router.post("/sessions/{session_id}/flags/{flag_id}")
async def session_flag(session_id: str, flag_id: str, body: FlagBody, request: Request) -> dict:
    check_origin(request)
    _not_while_preparing(session_id)
    session = _session_or_404(session_id)
    record = next((r for r in session.get("feedback", []) if r.get("id") == body.feedback_id), None)
    if record is None:
        raise fail(404, "not_found", "Feedback not found.")
    try:
        flag = feedback.apply_flag_action(record, flag_id, body.action)
    except ValueError:
        raise fail(422, "unknown_action", "Use confirm, dismiss or restore.")
    except KeyError:
        raise fail(404, "not_found", "Correction not found.")
    # US-22 AC3: what counts as a weak spot changes with the flag; the saved debrief follows.
    if session.get("debrief"):
        session["debrief"] = feedback.refresh_weak_spots(
            session["debrief"], session.get("feedback", []), config.load_settings()["layer_order"])
    storage.save_session(session)
    return {"flag": flag, "language": record["layers"]["language"], "debrief": _shown_debrief(session)}


class StrongerBody(BaseModel):
    feedback_id: str = Field(max_length=40)


@router.post("/sessions/{session_id}/stronger")
async def session_stronger(session_id: str, body: StrongerBody, request: Request) -> dict:
    check_origin(request)
    _not_while_preparing(session_id)
    session = _session_or_404(session_id)
    record = next((r for r in session.get("feedback", []) if r.get("id") == body.feedback_id), None)
    if record is None:
        raise fail(404, "not_found", "Feedback not found.")
    llm = engines.make_llm(config.load_settings())
    try:
        data = await feedback.stronger_version(llm, question=record.get("question", ""),
                                               missing=(record.get("layers", {}).get("content") or {}).get("missing", []),
                                               transcript=record.get("answer", ""))
    except EngineError as exc:
        raise fail(502, exc.code, exc.message)
    record["stronger"] = data
    storage.save_session(session)
    return data


class RecheckBody(BaseModel):
    model_config = {"extra": "forbid"}
    feedback_id: str = Field(max_length=40)
    text: str = Field(min_length=1, max_length=4000)
    flag_id: Optional[str] = Field(default=None, max_length=40)


def _swap_user_line(transcript: list[dict], record: dict, old: str, new: str) -> None:
    """The saved transcript carries what the user said too: change that line, so the chat matches the answer."""
    lines = [t for t in transcript if t.get("role") == "user" and feedback.norm(t.get("text", "")) == feedback.norm(old)]
    line = next((t for t in lines if t.get("kind") == record.get("answer_kind")
                 and t.get("question_id") == record.get("question_id")), lines[0] if lines else None)
    if line is not None:
        line["text"] = new


@router.post("/sessions/{session_id}/recheck")
async def session_recheck(session_id: str, body: RecheckBody, request: Request) -> dict:
    """US-18 AC3, "Edit what I said" in the debrief. `text` is the whole corrected answer or, with `flag_id`, what the
    user really said instead of that correction's "Heard as" fragment. Only this answer's feedback is made again
    (language, content, delivery recounted, stronger answer if there was one); the session is saved."""
    from .documents import known_terms
    check_origin(request)
    _not_while_preparing(session_id)
    session = _session_or_404(session_id)
    feedbacks = session.get("feedback", [])
    record = next((r for r in feedbacks if r.get("id") == body.feedback_id), None)
    if record is None:
        raise fail(404, "not_found", "Feedback not found.")
    try:
        text = feedback.corrected_answer(record, body.text, body.flag_id)
    except feedback.RecheckInputError as exc:
        raise fail(404 if exc.code == "not_found" else 422, exc.code, exc.message)
    settings = config.load_settings()
    engine_id = session.get("engine") if session.get("engine") in config.ENGINES else settings["engine"]
    llm = engines.make_llm(settings, engine_id)
    if engine_id != settings["engine"] and not (await llm.status()).ready:
        llm = engines.make_llm(settings)                      # the session's engine is gone: the one chosen now
    vacancy_text = ""
    if session.get("vacancy_id"):
        try:
            vacancy_text = storage.read_record("vacancies", session["vacancy_id"]).get("text", "")
        except (OSError, ValueError):
            pass
    try:
        fields = await asyncio.wait_for(feedback.recheck_answer(
            llm, record, text, mode=session.get("mode", "interview"), level=session.get("level") or settings["level"],
            known=known_terms(storage.read_profile().get("text", ""), vacancy_text),
            ignored=feedback.ignored_fragments(feedbacks)), timeout=180)
    except EngineError as exc:
        raise fail(502, exc.code, exc.message)
    except asyncio.TimeoutError:
        raise fail(504, "timeout", "The AI engine did not answer in time. Your answer was not changed.")
    session = _session_or_404(session_id)          # read again: a flag may have changed while the engine worked
    record = next((r for r in session.get("feedback", []) if r.get("id") == body.feedback_id), None)
    if record is None:
        raise fail(404, "not_found", "Feedback not found.")
    old = record.get("answer", "")
    feedback.apply_recheck(record, fields)
    _swap_user_line(session.get("transcript") or [], record, old, record["answer"])
    if session.get("debrief"):                     # the corrected answer may add or remove a weak spot (US-22 AC3)
        session["debrief"] = feedback.refresh_weak_spots(
            session["debrief"], session.get("feedback", []), settings["layer_order"])
    storage.save_session(session)
    return {"feedback": record, "transcript": session.get("transcript") or [], "debrief": _shown_debrief(session)}


@router.get("/memory")
async def get_memory() -> dict:
    return memory.summary()


# ---------- telemetry (opt-in, local file only) ----------

class TelemetryBody(BaseModel):
    opt_in: bool
    clear: bool = False


@router.get("/telemetry")
async def get_telemetry() -> dict:
    return telemetry.info()


@router.post("/telemetry")
async def post_telemetry(body: TelemetryBody, request: Request) -> dict:
    check_origin(request)
    settings = config.update_settings({"telemetry_opt_in": body.opt_in})
    if body.clear:
        telemetry.clear()
    return telemetry.info(settings)

