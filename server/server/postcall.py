"""Feedback after the call (D96).

The owner's decision: nothing but Mike, speech recognition and speech synthesis runs while a session is live. On one
local machine (one Ollama model, Whisper, Kokoro) a feedback job per answer slows Mike's replies and the recogniser
(4-11 s speech-recognition lag was measured). So during the call the session only keeps what feedback needs later: each
answer's record and, for a voice answer, its recording (within `stt.AudioKeep`'s memory budget). After End this module
works through the answers in the order they were given: word pass, delivery, language, content. The session is saved
first, then after every answer, so the work survives the window closing and a stopped server loses at most one answer.

Why a budget that scales: one answer needs a word pass (about 5-15 s of Whisper on Apple Silicon for a minute of
speech) and two local-model calls (language, content: 15-40 s each on an 8B model), so 40-90 s typically; each call
also has its own 180 s timeout. `POST_CALL_PER_ANSWER_S` = 120 s leaves room above the typical figure; the base covers
loading the models again. A fixed cap (the 90 s this replaces) cannot fit five answers, let alone thirty.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from . import config, feedback, telemetry
from .engines.base import EngineError, LLMEngine
from .stt import STT, Transcript

log = logging.getLogger("uvicorn.error")

POST_CALL_BASE_S = 60            # models loading again, saving, scheduling
POST_CALL_PER_ANSWER_S = 120     # word pass + language + content for one answer, with headroom
POST_CALL_MAX_S = 60 * 60        # an hour of work at most: ~30 answers is the largest interview round with follow-ups
LLM_TIMEOUT_S = 180              # one model call (unchanged from the per-answer worker)
MACHINE_POLL_S = 1.0             # how often a paused job looks whether a new live session is over

POST_CALL: dict[str, dict] = {}              # session id -> live status while its job runs (same object as the record's)
JOBS: set[asyncio.Task] = set()              # strong references: a job outlives the socket that started it
LIVE_SESSIONS = {"n": 0}                     # live calls on this server: a job gives the machine to them (Mike first)


def budget_s(answers: int) -> float:
    """Working time for `answers` answers. Time spent waiting for a live call to end is not counted."""
    return float(min(POST_CALL_MAX_S, POST_CALL_BASE_S + POST_CALL_PER_ANSWER_S * max(0, answers)))


def is_running(session_id: str) -> bool:
    return session_id in POST_CALL


def status(done: int, total: int, stage: str = "feedback") -> dict:
    return {"state": "running", "stage": stage, "done": done, "total": total}


async def machine_free() -> None:
    """A new live call has the machine: wait (checked between stages, a stage already running is not cut)."""
    while LIVE_SESSIONS["n"] > 0:
        await asyncio.sleep(MACHINE_POLL_S)


class Superseded(Exception):
    """The record is no longer this job's to write (continued on a new socket, or deleted): stop quietly."""


class Budget:
    """Working time left. Each stage waits for a free machine first (not counted), then runs against the time left."""

    def __init__(self, total_s: float) -> None:
        self.left = total_s

    async def run(self, make: Callable[[], Awaitable]):
        await machine_free()
        if self.left <= 0:
            raise asyncio.TimeoutError
        started = time.monotonic()
        try:
            return await asyncio.wait_for(make(), self.left)
        finally:
            self.left -= time.monotonic() - started


@dataclass
class Context:
    """What the job needs from the session. `run` is ws.in_background (the model gate and the background flag)."""
    llm: LLMEngine | None
    stt: STT | None
    run: Callable[[Callable[[], Awaitable]], Awaitable]
    emit: Callable[..., None]
    settings: dict
    mode: str
    level: str
    engine: str
    known_terms: list
    ignored: set = field(default_factory=set)
    dropped: set = field(default_factory=set)
    owner_ok: Callable[[], bool] = lambda: True
    save: Callable[[int], Awaitable[bool]] = None        # type: ignore[assignment]


def public(record: dict) -> dict:
    return {k: v for k, v in record.items() if k != "history_index"}


def settle(record: dict, mode: str, code: str) -> None:
    """Close a record whose layers did not all get made: each missing layer says why."""
    layers = record.setdefault("layers", {})
    if "delivery" not in layers:
        layers["delivery"] = feedback.delivery_layer(record.get("answer", ""), None,
                                                     main_answer=record.get("answer_kind") == "main")
    for name in (("language", "content") if mode == "interview" else ("language",)):
        if name not in layers:
            layers[name] = {"layer": name, "status": "unavailable", "code": code}
    record["cascade"] = feedback.cascade_note(layers)
    record["complete"] = True


def _check(ctx: Context) -> None:
    if not ctx.owner_ok():
        raise Superseded


async def process_answer(record: dict, transcript: Transcript | None, ctx: Context, budget: Budget) -> None:
    """One answer, in the order the live worker used to do it: word timings, delivery, language, content."""
    started = time.perf_counter()
    if record["id"] in ctx.dropped:
        return
    _check(ctx)
    if transcript is not None and transcript.audio:
        try:
            await budget.run(lambda: transcript.fill_words(ctx.stt))
        except asyncio.TimeoutError:
            transcript.audio = None
    low = transcript.low_confidence() if transcript is not None else []
    record["heard_as_words"] = [w.public() for w in low]
    record["layers"]["delivery"] = feedback.delivery_layer(
        record["answer"], transcript, main_answer=record["answer_kind"] == "main")
    ctx.emit("feedback", feedback=public(record))
    failures: list[str] = []
    _check(ctx)
    try:
        record["layers"]["language"] = await budget.run(lambda: asyncio.wait_for(ctx.run(
            lambda: feedback.analyze_language(
                ctx.llm, record["answer"], level=ctx.level, known=ctx.known_terms, low=low,
                english_track=ctx.mode == "english", ignored=ctx.ignored)), timeout=LLM_TIMEOUT_S))
    except (EngineError, asyncio.TimeoutError) as exc:
        code = getattr(exc, "code", "timeout")
        failures.append(code)
        record["layers"]["language"] = {"layer": "language", "status": "unavailable", "code": code}
    if record["id"] in ctx.dropped:
        return
    ctx.emit("feedback", feedback=public(record))
    _check(ctx)
    if ctx.mode == "interview":
        try:
            record["layers"]["content"] = await budget.run(lambda: asyncio.wait_for(ctx.run(
                lambda: feedback.analyze_content(
                    ctx.llm, question=record["question"], competency=record["competency"],
                    transcript=record["answer"], low=low)), timeout=LLM_TIMEOUT_S))
        except (EngineError, asyncio.TimeoutError) as exc:
            code = getattr(exc, "code", "timeout")
            failures.append(code)
            record["layers"]["content"] = {"layer": "content", "status": "unavailable", "code": code}
    record["cascade"] = feedback.cascade_note(record["layers"])
    record["complete"] = True
    if record["id"] in ctx.dropped:
        return
    if len(failures) >= (2 if ctx.mode == "interview" else 1):
        ctx.emit("feedback_unavailable", feedback_id=record["id"], code=failures[0],
                 message="Feedback is not available for this answer. Your answer is still saved.")
    ctx.emit("feedback", feedback=public(record))
    telemetry.record("feedback", ctx.settings, engine=ctx.engine, ok=not failures,
                     feedback_ms=round((time.perf_counter() - started) * 1000))


async def run_answers(items: list[tuple[dict, Transcript | None]], ctx: Context) -> bool:
    """Work through the queued answers in order; save and report after each. False if the job was superseded."""
    total = len(items)
    budget = Budget(budget_s(total))
    done = 0
    ctx.emit("feedback_progress", done=0, total=total)
    try:
        for record, transcript in items:
            if record["id"] in ctx.dropped:
                done += 1
                continue
            try:
                await process_answer(record, transcript, ctx, budget)
            except asyncio.TimeoutError:
                pass
            except (asyncio.CancelledError, Superseded):
                raise
            except Exception as exc:
                log.warning("Feedback failed: %s", type(exc).__name__)
                ctx.emit("feedback_unavailable", feedback_id=record["id"], code="internal",
                         message="Feedback is not available for this answer. Your answer is still saved.")
            if not record.get("complete"):
                settle(record, ctx.mode, "timeout" if budget.left <= 0 else "internal")
                ctx.emit("feedback", feedback=public(record))
            if transcript is not None:
                transcript.audio = None
            done += 1
            if not await ctx.save(done):
                raise Superseded
            ctx.emit("feedback_progress", done=done, total=total)
    except Superseded:
        return False
    return True


# ---------- a record whose job is gone (server stopped, or the job died) ----------

def repair(session: dict, layer_order: str) -> bool:
    """A saved session still marked as being prepared although no job runs: close its unfinished answers as
    unavailable and give it the plain (no-model) debrief, so its page is complete. True when it changed."""
    marker = session.get("post_call")
    if not marker or marker.get("state") != "running":
        return False
    for record in session.get("feedback", []):
        if not record.get("complete"):
            settle(record, session.get("mode", "interview"), "interrupted")
    if not session.get("debrief") and session.get("feedback"):
        session["debrief"] = feedback.fallback_debrief(session["feedback"], layer_order)
    session.pop("post_call", None)
    return True


def repair_all() -> int:
    """On server start: nothing is running yet, so every session marked as being prepared was interrupted."""
    from . import storage
    fixed = 0
    for record in storage.list_records("sessions"):
        try:
            if repair(record, config.load_settings()["layer_order"]):
                storage.save_session(record)
                fixed += 1
        except Exception as exc:
            log.warning("Repairing a session failed: %s", type(exc).__name__)
    return fixed
