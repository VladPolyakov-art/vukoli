"""Practice session WebSocket: /ws/session (alias /ws/voice). Protocol: app/server/PROTOCOL.md."""
from __future__ import annotations

import asyncio
import datetime
import json
import logging
import secrets
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import __version__, config, content, debrief_view, engines, feedback, memory, planner, postcall, storage, stt, telemetry, tts, usage
from .engines.base import BACKGROUND, EngineError, LLMEngine
from .engines.gemini_live import GeminiLiveDriver, basic_status
from .priority import ModelGate
from .session import TextDriver

log = logging.getLogger("uvicorn.error")
router = APIRouter()

MAX_AUDIO_PACKET = 65536
MAX_MESSAGE = 12000
MAX_TEXT_TURN = 4000
MODES = ("interview", "english")
ROUND_TYPES = tuple(content.ROUND_TYPES)


def origin_allowed(origin: str | None, host: str | None) -> bool:
    """Same-origin pages and the Vite dev server only. Non-browser clients send no Origin."""
    if not origin:
        return True
    origin = origin.rstrip("/")
    return origin in {f"http://{host}", f"https://{host}"} or origin in config.DEV_ORIGINS


def get_llm(settings: dict, engine_id: str, voice: bool = False) -> LLMEngine:          # patched in tests
    return engines.make_llm(settings, engine_id, voice=voice)


async def check_engine(settings: dict, engine_id: str, voice: bool = False):             # patched in tests
    if engine_id == "gemini_live" and engine_id not in settings.get("disconnected", []):
        block = settings["gemini_live"]
        return basic_status(block.get("api_key", ""), block.get("model", ""))
    return await get_llm(settings, engine_id, voice).status()


def asks_for_answer(kind: str | None, text: str) -> bool:
    """Mike asked something to answer, so a sample answer fits: every question and follow-up, including
    imperatives ("Give an example of..."); a reply without a kind only when it asks with a question mark."""
    if kind in ("question", "follow_up"):
        return True
    return kind is None and "?" in text


def parse_start(data: dict, settings: dict) -> dict:
    mode = data.get("mode", "interview")
    if mode not in MODES:
        raise ValueError("mode")
    round_type = data.get("round_type", "mix")
    if round_type not in ROUND_TYPES:
        raise ValueError("round_type")
    engine = data.get("engine") or settings["engine"]
    if engine not in config.ENGINES:
        raise ValueError("engine")
    questions = data.get("questions", settings["questions_per_session"])
    if not isinstance(questions, int) or not 1 <= questions <= 10:
        raise ValueError("questions")
    strictness = data.get("strictness", settings["strictness"])
    if not isinstance(strictness, int) or not 1 <= strictness <= 3:
        raise ValueError("strictness")
    input_mode = data.get("input", "voice")
    if input_mode not in ("voice", "text", "browser_stt"):
        raise ValueError("input")
    vacancy_id = data.get("vacancy_id") or ""
    if vacancy_id and not storage.RECORD_ID.fullmatch(str(vacancy_id)):
        raise ValueError("vacancy_id")
    topic = str(data.get("topic") or "")[:80]
    drill = data.get("drill") is True and mode == "interview"      # a weak-spot drill: only its name differs (13)
    resume_id = str(data.get("resume_session_id") or "")
    if resume_id and not storage.RECORD_ID.fullmatch(resume_id):
        raise ValueError("resume_session_id")
    voice = str(data.get("voice") or settings.get("voice") or "")
    return {"mode": mode, "round_type": round_type, "engine": engine, "questions": questions,
            "strictness": strictness, "input": input_mode, "vacancy_id": vacancy_id, "topic": topic,
            "drill": drill, "level": config.normalize_level(data.get("level") or settings["level"]),
            "voice": voice, "speak": data.get("speak", True) is not False,
            "suggest": bool(data.get("suggest", False)), "resume": resume_id}


# US-13 AC5: a session cut off by the connection can be picked up again from its saved record.
SAVED: dict[str, asyncio.Event] = {}      # session id -> set once the cut-off socket has written its record
OWNER: dict[str, object] = {}             # session id -> the socket that runs it now (a resumed one replaces the old)


class ResumeError(Exception):
    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.message = message
        self.retryable = retryable


def resume_state(saved: dict) -> tuple[list[content.Question], dict]:
    """The plan and the interviewer's position (question, follow-ups, round over) rebuilt from a saved record."""
    plan = [content.Question(id=q["id"], competency=q.get("competency", ""), text=q["text"],
                             follow_ups={f["tag"]: f["text"] for f in q.get("follow_ups", [])},
                             source=q.get("source", "bank"), anchor=q.get("anchor", ""))
            for q in saved.get("questions", [])]
    history = [{k: v for k, v in turn.items()} for turn in saved.get("transcript", [])]
    q_index, follow_ups, finished = 0, [], False
    for turn in history:
        if turn["role"] != "model":
            continue
        kind = turn.get("kind")
        if kind == "question" and turn.get("question_id"):
            q_index = next((i for i, q in enumerate(plan) if q.id == turn["question_id"]), q_index)
            follow_ups = []
        elif kind == "follow_up":
            follow_ups.append(turn["text"])
        elif kind == "closing":
            finished = True
    return plan, {"history": history, "q_index": q_index, "follow_ups": follow_ups, "finished": finished}


def resume_records(saved: dict, history: list[dict]) -> list[dict]:
    """Saved feedback records with their history index back (it is not stored): matched by the answer text."""
    used: set[int] = set()
    records = []
    for record in saved.get("feedback", []):
        record = dict(record)
        index = next((i for i, turn in enumerate(history)
                      if turn["role"] == "user" and i not in used and turn["text"] == record.get("answer")),
                     len(history) - 1)
        used.add(index)
        record["history_index"] = index
        records.append(record)
    return records


async def load_resume(session_id: str) -> dict:
    """The saved record to continue. The cut-off socket may still be writing it (feedback in progress): wait for it."""
    waiting = SAVED.get(session_id)
    if waiting is not None:
        try:
            await asyncio.wait_for(waiting.wait(), timeout=100)
        except asyncio.TimeoutError:
            raise ResumeError("Your answers are still being saved. Try again in a few seconds.", retryable=True)
    try:
        return await asyncio.to_thread(storage.read_record, "sessions", session_id)
    except (OSError, ValueError):
        raise ResumeError("This session isn't saved on this computer, so it can't be continued.")


@router.websocket("/ws/session")
@router.websocket("/ws/voice")
async def session_socket(websocket: WebSocket) -> None:
    if not origin_allowed(websocket.headers.get("origin"), websocket.headers.get("host")):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    outgoing: asyncio.Queue = asyncio.Queue(maxsize=1024)
    audio_queue: asyncio.Queue = asyncio.Queue(maxsize=80)
    backlog: list[tuple[dict, stt.Transcript | None]] = []   # D96: answers waiting for feedback, until the call is over
    suggest_queue: asyncio.Queue = asyncio.Queue(maxsize=1)
    overflow = asyncio.Event()
    saved_event = asyncio.Event()      # set once this socket's session is written (a resume waits for it)
    state = {"suggest": False, "voice_turn": 0, "pending_voice": False, "connected": True, "normal": False,
             "saved": saved_event, "owner": object()}
    resume_saved: dict | None = None
    records: list[dict] = []           # feedback records, in answer order
    dropped: set[str] = set()          # feedback ids removed by "redo answer"
    ignored_terms: set[str] = set()
    rechecking: set[str] = set()       # feedback ids being checked again after "Edit what I said"
    side_tasks: set[asyncio.Task] = set()
    driver = None
    opts: dict = {}
    session: dict = {}
    llm: LLMEngine | None = None
    gate = ModelGate(enabled=False)    # enabled for single-model engines once the engine is known
    settings = config.load_settings()
    tasks: list[asyncio.Task] = []

    def emit(msg_type: str, /, **payload) -> None:
        try:
            outgoing.put_nowait({"type": msg_type, **payload})
        except asyncio.QueueFull:
            overflow.set()

    def audio(data: bytes) -> None:
        try:
            outgoing.put_nowait(bytes(data))
        except asyncio.QueueFull:
            overflow.set()

    def error(code: str, message: str, hint: str = "", retryable: bool = True, **extra) -> None:
        emit("error", code=code, message=message, hint=hint, retryable=retryable, **extra)

    async def writer() -> None:
        while True:
            packet = await outgoing.get()
            try:
                if isinstance(packet, bytes):
                    await websocket.send_bytes(packet)
                else:
                    await websocket.send_json(packet)
            finally:
                outgoing.task_done()

    # ---------- driver callbacks ----------

    def queue_suggestion(question: str) -> None:
        while not suggest_queue.empty():
            suggest_queue.get_nowait()
            suggest_queue.task_done()
        suggest_queue.put_nowait(question)

    def turn_complete(speaker: str, text: str, meta: dict | None = None) -> None:
        meta = dict(meta or {})
        payload = {k: meta.get(k) for k in ("kind", "question_id", "thread_id", "turn_id", "interrupted")
                   if meta.get(k) is not None}
        if speaker == "user" and payload.get("turn_id") is None and state["pending_voice"]:
            payload["turn_id"] = state["voice_turn"]
        emit("turn_complete", speaker=speaker, full_text=text, **payload)
        if speaker == "model":
            if (opts.get("mode") == "interview" and state["suggest"] and settings["answer_suggester"]
                    and asks_for_answer(meta.get("kind"), text)):
                queue_suggestion(text)
            return
        state["pending_voice"] = False
        history = driver.transcript_history
        if not meta.get("question"):
            meta["question"] = next((t["text"] for t in reversed(history[:-1]) if t["role"] == "model"), "")
        record = {"id": "fb-" + secrets.token_hex(4), "history_index": len(history) - 1,
                  "turn_id": payload.get("turn_id"), "question": meta.get("question", ""),
                  "question_id": meta.get("question_id", ""), "competency": meta.get("competency", ""),
                  "answer_kind": meta.get("answer_kind") or ("main" if opts.get("mode") == "interview" else "turn"),
                  "answer": text, "source": meta.get("source", "voice"), "created_at": storage.now_iso(),
                  "layers": {}, "complete": False}
        transcript = meta.get("transcript")
        if len(feedback.WORD.findall(text)) < 5:
            release_audio(transcript)
            return                                      # too short to coach (Mike asks to elaborate)
        # D96: no feedback work runs during the call. The record and the recording wait for End (post_call below).
        backlog.append((record, transcript))
        records.append(record)

    def release_audio(transcript: stt.Transcript | None) -> None:
        """Release a recording that no feedback will use (a too-short answer, a redone one)."""
        if isinstance(driver, TextDriver):
            driver.audio_keep.free(transcript)

    def user_transcript(transcript: stt.Transcript, turn_id: int | None) -> None:
        emit("user_transcript", turn_id=turn_id, text=transcript.text, backend=transcript.backend,
             low_conf=[w.public() for w in transcript.low_confidence()])

    def metrics(data: dict) -> None:
        emit("turn_metrics", **data)
        telemetry.record("turn", settings, engine=opts.get("engine", ""), **{k: v for k, v in data.items()
                                                                          if k.endswith("_ms") or k == "path"})

    # ---------- workers ----------

    async def wait_for_interviewer() -> None:
        """Gemini Live (no gate): wait until Mike has finished his turn before a background call."""
        if llm is not None and llm.single_worker and not gate.enabled:
            for _ in range(600):
                if not driver.replying():
                    return
                await asyncio.sleep(0.2)

    async def in_background(job):
        """Feedback and suggestions: after Mike (one local model serves both, D33). Cancelled and re-run if
        Mike needs the model while the call is running."""
        await wait_for_interviewer()
        mark = BACKGROUND.set(True)
        try:
            return await gate.background(job)
        finally:
            BACKGROUND.reset(mark)

    def public_record(record: dict) -> dict:
        return {k: v for k, v in record.items() if k != "history_index"}

    async def suggest_worker() -> None:
        while True:
            question = await suggest_queue.get()
            emit("suggestion_pending", question=question)
            try:
                history = list(driver.transcript_history)
                data = await asyncio.wait_for(in_background(lambda: feedback.suggest_answer(
                    llm, question=question, history=history,
                    profile=opts.get("profile", ""), jd=opts.get("jd", ""), level=opts["level"])), timeout=180)
                emit("suggestion", question=question, **data)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                emit("suggestion_unavailable", question=question, code=getattr(exc, "code", "internal"),
                     message="Could not prepare a suggestion for this question.")
            finally:
                suggest_queue.task_done()

    async def stronger_task(record: dict) -> None:
        try:
            content_layer = record["layers"].get("content") or {}
            data = await asyncio.wait_for(in_background(lambda: feedback.stronger_version(
                llm, question=record["question"], missing=content_layer.get("missing", []),
                transcript=record["answer"])), timeout=180)
            record["stronger"] = data
            emit("stronger_version", feedback_id=record["id"], **data)
        except Exception as exc:
            emit("stronger_unavailable", feedback_id=record["id"], code=getattr(exc, "code", "internal"),
                 message="Could not write a stronger version of this answer.")

    async def recheck_task(record: dict, text: str) -> None:
        """"Edit what I said" (US-18 AC3): this answer's feedback again from the corrected text. The record, the
        history Mike answers from and the client change only when everything is ready."""
        try:
            fields = await asyncio.wait_for(in_background(lambda: feedback.recheck_answer(
                llm, record, text, mode=opts["mode"], level=opts["level"], known=opts.get("context_terms", []),
                ignored=ignored_terms | set(feedback.ignored_fragments(records)))), timeout=180)
            feedback.apply_recheck(record, fields)
            history = driver.transcript_history
            if 0 <= record.get("history_index", -1) < len(history):
                history[record["history_index"]]["text"] = record["answer"]
            emit("feedback", feedback=public_record(record))
            emit("answer_edited", feedback_id=record["id"], turn_id=record["turn_id"], text=record["answer"])
            if record.get("stronger"):
                emit("stronger_version", feedback_id=record["id"], **record["stronger"])
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            emit("recheck_failed", feedback_id=record["id"],
                 code="timeout" if isinstance(exc, asyncio.TimeoutError) else getattr(exc, "code", "internal"),
                 message=getattr(exc, "message", "") or "Could not check this answer again. Your answer was not changed.")
        finally:
            rechecking.discard(record["id"])

    async def mic_generator():
        while True:
            chunk = await audio_queue.get()
            try:
                yield chunk
            finally:
                audio_queue.task_done()

    async def reader() -> None:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                raise WebSocketDisconnect()
            if message.get("bytes") is not None:
                chunk = message["bytes"]
                if len(chunk) > MAX_AUDIO_PACKET or len(chunk) % 2:
                    raise ValueError("invalid_audio_packet")
                await asyncio.wait_for(audio_queue.put(chunk), timeout=3)
                continue
            raw = message.get("text") or ""
            if len(raw) > MAX_MESSAGE:
                raise ValueError("message_too_long")
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("invalid_message")
            kind = data.get("type")
            if kind == "ping":
                emit("pong", t=data.get("t"))
            elif kind == "end_session":
                await asyncio.sleep(0.3)
                state["normal"] = True
                return
            elif kind == "user_turn":
                text = data.get("text")
                if not isinstance(text, str) or len(text) > MAX_TEXT_TURN:
                    raise ValueError("invalid_text_turn")
                if text.strip():
                    if isinstance(driver, TextDriver):
                        await driver.handle_user_text_turn(text, None, data.get("turn_id"))
                    else:
                        await driver.handle_user_text_turn(text)
            elif kind == "activity_start":
                turn_id = data.get("turn_id", 0)
                if not isinstance(turn_id, int) or turn_id < 0:
                    raise ValueError("invalid_turn_id")
                await asyncio.wait_for(audio_queue.join(), timeout=3)
                state["voice_turn"] = turn_id
                state["pending_voice"] = True
                if isinstance(driver, TextDriver):
                    await driver.begin_audio_turn(turn_id, manual=data.get("manual") is True)
                else:
                    await driver.begin_audio_turn()
            elif kind == "activity_cancel":
                # Browser recognition heard nothing: the voice turn opened by activity_start has no speech in it.
                if isinstance(driver, TextDriver):
                    cancelled = data.get("turn_id")
                    await driver.cancel_audio_turn(cancelled if isinstance(cancelled, int) else None)
            elif kind == "audio_stream_end":
                await asyncio.wait_for(audio_queue.join(), timeout=3)
                if isinstance(driver, TextDriver):
                    await driver.end_audio_stream(state["voice_turn"])
                else:
                    await driver.end_audio_stream()
            elif kind == "redo_answer":
                question = await driver.redo_answer()
                if question:
                    keep = len(driver.transcript_history)
                    removed = [r["id"] for r in records if r["history_index"] >= keep]
                    dropped.update(removed)
                    records[:] = [r for r in records if r["id"] not in dropped]
                    for _record, transcript in backlog:
                        if _record["id"] in dropped:
                            release_audio(transcript)
                    backlog[:] = [item for item in backlog if item[0]["id"] not in dropped]
                    emit("answer_reset", question=question, removed_feedback_ids=removed)
            elif kind == "suggest":
                state["suggest"] = bool(data.get("on")) and settings["answer_suggester"]
                history = driver.transcript_history
                if state["suggest"] and opts["mode"] == "interview" and history and history[-1]["role"] == "model":
                    queue_suggestion(history[-1]["text"])
            elif kind == "request_stronger":
                record = next((r for r in records if r["id"] == data.get("feedback_id")), None)
                if record is None or not record.get("complete"):
                    emit("stronger_unavailable", feedback_id=data.get("feedback_id"), code="not_found",
                         message="That feedback is not ready yet.")
                else:
                    task = asyncio.create_task(stronger_task(record))
                    side_tasks.add(task)
                    task.add_done_callback(side_tasks.discard)
            elif kind == "recheck":
                record = next((r for r in records if r["id"] == data.get("feedback_id")), None)
                text = data.get("text")
                flag_id = data.get("flag_id")
                if record is None or not record.get("complete"):
                    emit("recheck_failed", feedback_id=data.get("feedback_id"), code="not_found",
                         message="That feedback is not ready yet.")
                elif not isinstance(text, str) or len(text) > MAX_TEXT_TURN or not (flag_id is None or isinstance(flag_id, str)):
                    raise ValueError("invalid_recheck")
                elif record["id"] in rechecking:
                    emit("recheck_failed", feedback_id=record["id"], code="busy",
                         message="This answer is already being checked.")
                else:
                    try:
                        corrected = feedback.corrected_answer(record, text, flag_id)
                    except feedback.RecheckInputError as exc:
                        emit("recheck_failed", feedback_id=record["id"], code=exc.code, message=exc.message)
                    else:
                        rechecking.add(record["id"])
                        task = asyncio.create_task(recheck_task(record, corrected))
                        side_tasks.add(task)
                        task.add_done_callback(side_tasks.discard)
            elif kind == "flag_action":
                record = next((r for r in records if r["id"] == data.get("feedback_id")), None)
                try:
                    if record is None:
                        raise KeyError("feedback")
                    flag = feedback.apply_flag_action(record, str(data.get("flag_id")), str(data.get("action")))
                    if flag["status"] == "dismissed":
                        ignored_terms.add(flag["original"])
                    emit("flag_updated", feedback_id=record["id"], flag=flag, language=record["layers"]["language"])
                except (KeyError, ValueError):
                    error("flag_not_found", "That correction was not found.", retryable=False)
            elif kind == "input_mode":
                wanted = data.get("input")
                if wanted not in ("voice", "browser_stt", "text"):
                    raise ValueError("invalid_input_mode")
                if wanted == "voice" and isinstance(driver, TextDriver):
                    driver.enable_stt(stt.get_stt(settings))
            elif kind == "silence":
                if isinstance(driver, TextDriver):
                    await driver.say_silence()
            elif kind == "start":
                error("already_started", "The session has already started.", retryable=False)
            else:
                raise ValueError("unknown_message")

    # ---------- session ----------

    writer_task = asyncio.create_task(writer())
    started_at = storage.now_iso()
    t_start = time.perf_counter()
    try:
        try:
            first = await asyncio.wait_for(websocket.receive_text(), timeout=30)
            data = json.loads(first) if len(first) <= MAX_MESSAGE else None
            if not isinstance(data, dict) or data.get("type") != "start":
                raise ValueError("start")
            opts = parse_start(data, settings)
        except (ValueError, asyncio.TimeoutError) as exc:
            field = str(exc) or "start"
            error("bad_start", f"The first message must be a valid 'start' message ({field}).", retryable=False)
            return
        engine_id = opts["engine"]
        voice = opts["input"] != "text"       # voice sessions get the fast voice model (see engines.make_llm)
        status = await check_engine(settings, engine_id, voice)
        if not status.ready:
            error(status.code, status.message or "The AI engine is not ready.", status.hint, retryable=True,
                  hint_command=status.hint_command, fix_url=status.fix_url, engine=engine_id)
            return
        if opts["resume"]:
            if engine_id == "gemini_live":
                error("resume_unavailable", "Gemini Live can't pick a session up again. Your answers are saved: "
                      "see the debrief or start a new session.", retryable=False)
                return
            try:
                resume_saved = await load_resume(opts["resume"])
            except ResumeError as exc:
                error("resume_unavailable", exc.message, retryable=exc.retryable)
                return
            opts.update(mode=resume_saved.get("mode", opts["mode"]), round_type=resume_saved.get("round_type", "mix"),
                        level=resume_saved.get("level", opts["level"]),
                        strictness=resume_saved.get("strictness", opts["strictness"]),
                        vacancy_id=resume_saved.get("vacancy_id", ""))
        llm = get_llm(settings, engine_id, voice)
        usage.start_session(engine_id)              # D88: this session's requests, and the plan's limit around it
        if engine_id == "gemini_live":
            usage.count(engine_id)                  # the Live connection itself
        if engine_id == "codex_cli" and (binary := codex_binary(llm)):
            task = asyncio.create_task(usage.read_codex(binary, fresh=True))
            side_tasks.add(task)
            task.add_done_callback(side_tasks.discard)
        gate.enabled = engine_id != "gemini_live" and llm.single_worker
        profile = storage.read_profile().get("text", "")
        jd, vacancy_title, extra = "", "", []
        if opts["vacancy_id"]:
            try:
                vacancy = storage.read_record("vacancies", opts["vacancy_id"])
                jd = vacancy.get("text", "")
                vacancy_title = vacancy.get("title", "")
                extra = planner.questions_from_record(vacancy.get("questions", []))
            except (OSError, ValueError):
                opts["vacancy_id"] = ""
        from .documents import known_terms
        opts.update(profile=profile, jd=jd, context_terms=known_terms(profile, jd))
        resume_info = None
        if resume_saved:
            plan, resume_info = resume_state(resume_saved)
        else:
            plan = planner.plan_questions(opts["round_type"], opts["questions"], extra=extra) \
                if opts["mode"] == "interview" else []
        state["suggest"] = opts["suggest"] and settings["answer_suggester"]
        callbacks = dict(
            on_audio_chunk=audio,
            on_turn_start=lambda speaker: emit("turn_start", speaker=speaker),
            on_transcript_delta=lambda speaker, delta, full: emit("transcript_delta", speaker=speaker,
                                                                  delta=delta, full_text=full),
            on_turn_complete=turn_complete,
            on_interrupted=lambda turn_id=None: emit("interrupted", **({} if turn_id is None else {"turn_id": turn_id})),
            on_ready=lambda: emit("ready"),
            on_response_complete=lambda: emit("response_complete"),
        )
        if engine_id == "gemini_live":
            block = settings["gemini_live"]
            if opts["mode"] == "interview":
                plan_text = "\n".join(f"{i}. {q.text}" for i, q in enumerate(plan, 1))
                context = (f"<cv>{profile[:6000]}</cv>\n" if profile else "") + (f"<jd>{jd[:4000]}</jd>" if jd else "")
                system = content.system("live_interviewer", max_follow_ups=planner.max_follow_ups(opts["strictness"]),
                                        strictness=opts["strictness"], plan=plan_text, context=context)
            else:
                preset = content.level_presets().get(opts["level"], "")
                system = content.system("p5a_tutor", level=opts["level"], level_preset=preset)
            system += content.name_line(settings.get("name", ""))
            driver = GeminiLiveDriver(api_key=block.get("api_key", ""), model_name=block.get("model", ""),
                                      voice_name=block.get("voice", "Puck"), system_instruction=system,
                                      manual_turns=True, **callbacks)
            stt_info = {"available": True, "backend": "gemini_live"}
        else:
            recogniser = stt.get_stt(settings) if opts["input"] == "voice" else None
            driver = TextDriver(
                llm, mode=opts["mode"], plan=plan, strictness=opts["strictness"], level=opts["level"],
                voice=opts["voice"], speed=settings["kokoro_speed"], speak=opts["speak"], stt=recogniser,
                settings=settings, topic=opts["topic"],
                on_notice=lambda code, text: emit("notice", code=code, message=text),
                on_preview=lambda text: emit("speech_preview", turn_id=state["voice_turn"], text=text),
                on_error=lambda code, message, hint, retryable: error(code, message, hint, retryable),
                on_voice_dropped=lambda turn_id: emit("voice_turn_dropped", turn_id=turn_id),
                on_voice_noise=lambda turn_id: emit("voice_turn_noise", turn_id=turn_id),
                on_user_transcript=user_transcript, on_metrics=metrics, gate=gate, resume=resume_info, **callbacks)
            stt_info = recogniser.info() if recogniser else {"available": False, "backend": "none"}
        session = {"id": storage.new_id("s-"), "mode": opts["mode"], "round_type": opts["round_type"],
                   "engine": engine_id, "model": status.model or llm.model, "level": opts["level"],
                   "strictness": opts["strictness"], "input": opts["input"], "vacancy_id": opts["vacancy_id"],
                   "vacancy_title": vacancy_title, "started_at": started_at, "app_version": __version__,
                   "questions": [q.public() for q in plan],
                   "title": storage.session_title(opts["mode"], vacancy_title, opts["drill"])}
        if resume_saved:                                # continue the saved record: same id, same start, time adds up
            session.update({k: resume_saved[k] for k in ("id", "started_at", "title", "questions", "vacancy_title",
                                                         "archived") if k in resume_saved})
            t_start = time.perf_counter() - float(resume_saved.get("duration_s") or 0)
        SAVED[session["id"]] = saved_event
        OWNER[session["id"]] = state["owner"]
        emit("session_started", session_id=session["id"], mode=opts["mode"], engine=engine_id,
             model=session["model"], questions=session["questions"], speaks=bool(driver.produces_audio),
             audio={"sample_rate_out": tts.SAMPLE_RATE, "sample_rate_in": stt.SAMPLE_RATE},
             stt=stt_info, suggester_available=settings["answer_suggester"], suggest=state["suggest"],
             warnings=status.warnings)
        telemetry.record("session_started", settings, engine=engine_id, mode=opts["mode"],
                         round_type=opts["round_type"], input=opts["input"], level=opts["level"])
        if resume_saved:
            records[:] = resume_records(resume_saved, driver.transcript_history)
            for record in records:
                emit("feedback", feedback=public_record(record))        # the page may have missed the last ones
                if not record.get("complete"):
                    backlog.append((record, None))                      # made after this call, like the new answers
        live_task = asyncio.create_task(driver.run(mic_generator()))
        reader_task = asyncio.create_task(reader())
        tasks = [live_task, reader_task, asyncio.create_task(suggest_worker()), asyncio.create_task(overflow.wait())]
        postcall.LIVE_SESSIONS["n"] += 1
        state["live"] = True
        done, _ = await asyncio.wait([live_task, reader_task, writer_task, tasks[-1]],
                                     return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
        if reader_task not in done:
            error("connection_lost", "The voice connection ended. Your transcript will be saved; start a new "
                                     "session to reconnect.", retryable=True)
    except WebSocketDisconnect:
        state["connected"] = False
    except EngineError as exc:
        error(exc.code, exc.message, exc.hint, retryable=True)
    except Exception as exc:
        log.warning("Session ended: %s", type(exc).__name__)
        error("session_failed", "Could not continue the session. Check the AI engine and try again.")
    finally:
        if state.get("live"):
            postcall.LIVE_SESSIONS["n"] = max(0, postcall.LIVE_SESSIONS["n"] - 1)
            state["live"] = False
        if driver is not None:
            driver.stop()
        for task in [*tasks, *side_tasks]:
            task.cancel()
        await asyncio.gather(*tasks, *side_tasks, return_exceptions=True)
        history = list(driver.transcript_history) if driver is not None else []

        def release_session() -> None:
            saved_event.set()
            if SAVED.get(session.get("id", "")) is saved_event:
                SAVED.pop(session["id"], None)
            if OWNER.get(session.get("id", "")) is state["owner"]:
                OWNER.pop(session["id"], None)

        if session and any(t["role"] == "user" for t in history):
            # D96: the feedback is made now, after the call, by a job that does not belong to this socket: it keeps
            # going if the window closes, and this handler only forwards its events while the socket is open.
            ctx = postcall.Context(
                llm=llm, stt=getattr(driver, "stt", None), run=in_background, emit=emit, settings=settings,
                mode=opts.get("mode", "interview"), level=opts.get("level", "B1"), engine=opts.get("engine", ""),
                known_terms=opts.get("context_terms", []), ignored=ignored_terms, dropped=dropped,
                owner_ok=lambda: OWNER.get(session["id"]) is state["owner"])
            job = asyncio.create_task(save_and_debrief(session, history, records, backlog, llm, settings, emit, state,
                                                       t_start, ctx, release_session))
            postcall.JOBS.add(job)
            job.add_done_callback(postcall.JOBS.discard)
            await wait_for_job(job)
        else:
            if session:
                emit("session_ended", saved=False, reason="no_answers")
            release_session()
        if state["connected"] and not writer_task.done():
            try:
                await asyncio.wait_for(outgoing.join(), timeout=5)
            except asyncio.TimeoutError:
                pass
        writer_task.cancel()
        await asyncio.gather(writer_task, return_exceptions=True)
        try:
            await websocket.close()
        except RuntimeError:
            pass


async def wait_for_job(job: asyncio.Task) -> None:
    """The socket handler waits for the after-call job so its events reach an open socket, but only waits: if the
    handler is cancelled or the socket is gone the job carries on (shield), and its own errors are logged there."""
    try:
        await asyncio.shield(job)
    except asyncio.CancelledError:
        if job.done():
            return
        raise
    except Exception as exc:
        log.warning("After-call work failed: %s", type(exc).__name__)


def codex_binary(llm: LLMEngine | None) -> str | None:
    from .engines import codex_cli
    return getattr(llm, "_binary", None) or codex_cli.find_codex() if isinstance(llm, codex_cli.CodexCLIEngine) else None


def public_feedback(records: list[dict]) -> list[dict]:
    return [{k: v for k, v in r.items() if k != "history_index"} for r in records]


def sync_user_edits(session: dict) -> bool:
    """The user may rename or archive the session while it is being prepared (REST): keep that in our copy. False when
    the record is gone (deleted to Trash): nothing more is written."""
    try:
        disk = storage.read_record("sessions", session["id"])
    except (OSError, ValueError):
        return False
    session["title"] = disk.get("title", session.get("title", ""))
    for key in ("archived", "archived_at"):
        if key in disk:
            session[key] = disk[key]
        else:
            session.pop(key, None)
    return True


async def save_and_debrief(session: dict, history: list[dict], records: list[dict],
                           backlog: list[tuple[dict, stt.Transcript | None]], llm: LLMEngine | None,
                           settings: dict, emit, state: dict, t_start: float, ctx: postcall.Context,
                           release=lambda: None) -> None:
    """After the call (D96): save the session at once, make the feedback of every answer in order (saving after each),
    then the debrief. Runs as its own task (see the end of `session_socket`)."""
    sid = session["id"]
    total = len(backlog)
    live = postcall.status(0, total) if total else None
    emit("saving")
    session.update({"ended_at": storage.now_iso(), "duration_s": round(time.perf_counter() - t_start),
                    "transcript": history, "feedback": public_feedback(records), "debrief": None,
                    "stats": {"answers": sum(1 for t in history if t["role"] == "user"), "turns": len(history)}})
    if live is not None:
        session["post_call"] = live
        postcall.POST_CALL[sid] = live            # before the first write: a page that loads it sees a job running
    try:
        await _save_and_debrief(session, history, records, backlog, llm, settings, emit, state, ctx, live)
    finally:
        postcall.POST_CALL.pop(sid, None)
        release()


async def _save_and_debrief(session, history, records, backlog, llm, settings, emit, state, ctx, live) -> None:
    sid = session["id"]
    try:
        await asyncio.to_thread(storage.save_session, session)
    except Exception as exc:
        log.warning("Save failed: %s", type(exc).__name__)
        state["saved"].set()
        emit("save_error", code="save_failed",
             message="Could not save the session. Copy the transcript before leaving this page.")
        return
    state["saved"].set()                               # a resume may read the record now
    emit("session_saved", session_id=sid)
    if backlog:
        async def save_progress(done: int) -> bool:
            if ctx.owner_ok() is False:
                return False
            if not await asyncio.to_thread(sync_user_edits, session):
                return False                           # deleted while being prepared
            live["done"] = done
            session["feedback"] = public_feedback(records)
            try:
                await asyncio.to_thread(storage.save_session, session)
            except Exception as exc:
                log.warning("Saving progress failed: %s", type(exc).__name__)
            return True
        ctx.save = save_progress
        if not await postcall.run_answers(backlog, ctx):
            return                                     # continued on a new socket, or deleted: not ours to write now
        live["stage"] = "debrief"
        await save_progress(len(backlog))
    emit("debrief_pending", session_id=sid)
    try:
        past = await asyncio.to_thread(memory.past_weak_spots_text, sid)
        result = await asyncio.wait_for(feedback.debrief(
            llm if session["mode"] == "interview" else None, session["feedback"],
            layer_order=settings["layer_order"], past=past), timeout=150)
    except Exception as exc:
        log.warning("Debrief failed: %s", type(exc).__name__)
        result = feedback.fallback_debrief(session["feedback"], settings["layer_order"])
    if OWNER.get(sid) is not state["owner"]:
        return                                         # the session was continued on a new socket: it writes the record now
    session["debrief"] = result
    session.pop("post_call", None)
    if not await asyncio.to_thread(sync_user_edits, session):
        return                                         # deleted while being prepared
    if (meter := usage.SESSION.get()) is not None:
        if session["engine"] == "codex_cli" and (binary := codex_binary(llm)):
            await usage.read_codex(binary, fresh=True)
        session["usage"] = usage.finish_session(meter)
    try:
        await asyncio.to_thread(storage.save_session, session)
        if settings.get("obsidian_dir"):
            await asyncio.to_thread(storage.export_obsidian, session, settings["obsidian_dir"])
    except Exception as exc:
        log.warning("Saving the debrief failed: %s", type(exc).__name__)
    emit("debrief", session_id=sid, debrief=debrief_view.enrich_debrief(
        result, session["feedback"], session["mode"]))
    telemetry.record("session_ended", settings, engine=session["engine"], mode=session["mode"],
                     answers=session["stats"]["answers"], duration_s=session["duration_s"])
