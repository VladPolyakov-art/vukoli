"""TextDriver: one practice session on a text LLM (Ollama, OpenAI-compatible, Claude CLI) with local
speech-to-text and Kokoro speech. Same interface as GeminiLiveDriver, so the WebSocket loop treats both alike.

Latency plan (D33, target 2-3 s per turn):
- the opening line is fixed copy (no model call) and the model warms up while the user answers;
- the interviewer reply is JSON (P1) streamed; `action` arrives first, and for `next_question` the code
  speaks "Okay." plus the next question verbatim without waiting for the model;
- `say` is spoken sentence by sentence while the model is still writing;
- speech is recognised in two passes: the reply starts from the text, word timings are made after the call (D96:
  the recording is kept, nothing but Mike and the live captions uses the machine during the call);
- Mike holds the model gate (priority.py) from the end of the answer until his reply text is written, so
  feedback and suggestions on the same local model never delay him.

The code owns the interview plan: when the model moves on by itself (asks NEXT_QUESTION or announces the next
question in a follow-up turn), the code switches to the next question in the same turn and labels it as one.
"""
from __future__ import annotations

import asyncio
import copy
import difflib
import json
import os
import logging
import re
import time
from typing import AsyncGenerator, AsyncIterator, Callable, Optional

from . import bargain, content, hintgen, talkcase, negotiation, talk, tough, tts
from .content import Question
from .engines.base import EngineError, LLMEngine
from .engines.gemini_live import drop_last_answer
from .feedback import WORD, JsonFieldStreamer, mark_misheard, hints, norm, sanitize_sentence, trim_words
from .planner import max_follow_ups
from .priority import ModelGate
from .stt import STT, AudioKeep, Transcript

log = logging.getLogger("uvicorn.error")
SENTENCE_END = re.compile(r"(.+?[.!?…])(?:\s+|$)", re.S)
REPEAT = re.compile(r"\b(repeat|say (that|it) again|pardon|didn't (catch|hear)|one more time)\b", re.I)
# Short replies to "Would you like me to repeat the question?"
YES = re.compile(r"^\W*(?:yes|yeah|yep|yup|sure|please|ok(?:ay)?|go ahead|of course)\b", re.I)
# Small talk instead of an answer ("hi, how are you?"): Mike replies briefly and asks the question again.
SMALL_TALK = re.compile(r"\bhow (?:are|r) (?:you|u)\b|\bhow'?s it going\b|\bnice to meet you\b|^\W*(?:hi|hello|hey)\W*$",
                        re.I)
NO = re.compile(r"^\W*(?:no|nope|not needed|i'?m (?:ready|fine|good|ok(?:ay)?)|i (?:got|understand) it)\b", re.I)
# Quick start (D111): Mike asks "interview or English?" and the first words of the answer choose the practice.
# Russian stems are written as \u escapes (the public export rejects Cyrillic text).
# Whichever of the two words comes first wins ("English interview" is English, "interview in English" is an interview).
CHOICE_ENGLISH = re.compile(r"english|\u0430\u043d\u0433\u043b|speaking|free talk", re.I)
CHOICE_INTERVIEW = re.compile(r"interview|\u0438\u043d\u0442\u0435\u0440\u0432\u044c\u044e|\u0441\u043e\u0431\u0435\u0441|job\b|hiring|behaviou?ral|\bhr\b", re.I)


def classify_choice(text: str) -> str | None:
    """The answer to Mike's "interview or English?": "interview", "english", or None when it says neither."""
    eng, itv = CHOICE_ENGLISH.search(text or ""), CHOICE_INTERVIEW.search(text or "")
    if eng and itv:
        return "english" if eng.start() < itv.start() else "interview"
    return "english" if eng else "interview" if itv else None


GAP_TAG = {"own_part": "YP", "result": "RN", "reflection": "WD", "tradeoff": "CT"}
TAG_PREFIX = re.compile(r"^\s*(?:YP|RN|WD|CT)\s*[:\-–]\s*")
# The model announcing a new main question in a follow-up turn (question drift).
MOVE_ON = re.compile(r"\b(?:next|another|new)[ _]question\b|\b(?:my|our) (?:last|final) question\b|\bmoving on\b|"
                     r"\b(?:let'?s|let us|we'?ll|I'?ll|now) (?:move|go) on\b|\blet'?s (?:turn|move) to\b", re.I)
DRIFT_OVERLAP = 0.7      # share of the next question's words that marks a sentence as that question
PREVIEW_SECONDS = 12
ECHO_WINDOW_S = 5        # a short transcript that repeats Mike's last words, heard this soon after them, is his echo
ECHO_MAX_WORDS = 6
ECHO_MATCH = 0.8
# Mike waits while a voice turn is open (see begin_audio_turn). Never for good:
FLOW_MAX_S = 15          # no verdict this long after the user stopped talking: Mike goes on, the turns are dropped
FLOW_POLL_S = 1.0        # how often a waiting Mike looks at that clock
# A turn that stays noise (previews find no words) must not keep him quiet while it goes on:
PREVIEW_EMPTY_RESUME = 2         # this many empty live captions in a row ...
NOISE_TURN_MIN_S = 4             # ... after at least this much audio: it is noise, Mike goes on
MAX_RECORD_BYTES = 16000 * 2 * 240      # up to 4 minutes per answer


INTENT_TIMEOUT_S = float(os.environ.get("IC_INTENT_TIMEOUT_S", "8"))
SLOW_ENGINES = ("claude_cli", "codex_cli", "antigravity_cli")   # one call starts a CLI process: seconds, not tokens
HINT_GEN_TIMEOUT_S = float(os.environ.get("IC_HINT_GEN_TIMEOUT_S", "6"))
FIXED_HINT_LINES = ("O2", "N4")            # "Wait while he checks": the fixed line is the right one
FOLLOW_UP_TIMEOUT_S = float(os.environ.get("IC_FOLLOW_UP_TIMEOUT_S", "5"))
MONEY_SKIP = re.compile(r"\b(?:skip|rather not|prefer not|not (?:going to|ready to|comfortable) (?:discuss|talk|share|say)|"
                        r"don'?t want to (?:discuss|talk|share|say))\b", re.I)


class TextDriver:
    needs_server_stt = True

    def __init__(self, llm: LLMEngine, *, mode: str = "interview", plan: list[Question] | None = None,
                 strictness: int = 2, level: str = "B1", voice: str = "", speed: float = 1.0, speak: bool = True,
                 stt: STT | None = None, settings: dict | None = None, topic: str = "",
                 on_turn_start: Optional[Callable] = None, on_transcript_delta: Optional[Callable] = None,
                 on_turn_complete: Optional[Callable] = None, on_interrupted: Optional[Callable] = None,
                 on_ready: Optional[Callable] = None, on_response_complete: Optional[Callable] = None,
                 on_audio_chunk: Optional[Callable] = None, on_notice: Optional[Callable] = None,
                 on_preview: Optional[Callable] = None, on_error: Optional[Callable] = None,
                 on_user_transcript: Optional[Callable] = None, on_metrics: Optional[Callable] = None,
                 on_voice_dropped: Optional[Callable] = None, on_voice_noise: Optional[Callable] = None,
                 gate: ModelGate | None = None, resume: dict | None = None,
                 focus_gaps: list[str] | None = None, quick: bool = False,
                 on_mode: Optional[Callable] = None, neg: dict | None = None,
                 tough_state: dict | None = None, money_plan: dict | None = None, **_ignored) -> None:
        self.llm = llm
        self.mode = mode
        self.plan = list(plan or [])
        if mode == "interview" and not self.plan:
            raise ValueError("an interview needs at least one question")
        self.strictness = strictness
        self.max_follow_ups = max_follow_ups(strictness)
        self.level = level
        self.voice = tts.resolve_voice(voice)
        self.speed = speed
        self.settings = settings or {}
        self.speak = speak and tts.kokoro_model(self.settings) is not None
        self.produces_audio = self.speak
        self.stt = stt
        self.topic = topic
        # Quick start: the session opens with "interview or English?"; the answer sets `mode` (and drops the plan for English).
        self._quick = bool(quick) and not resume
        self._quick_asked = False
        self.on_mode = on_mode
        self.focus_gaps = list(focus_gaps or [])     # a drill: the gaps the interviewer checks first (planner.focus_gaps)
        self.on_turn_start = on_turn_start
        self.on_transcript_delta = on_transcript_delta
        self.on_turn_complete = on_turn_complete
        self.on_interrupted = on_interrupted
        self.on_ready = on_ready
        self.on_response_complete = on_response_complete
        self.on_audio_chunk = on_audio_chunk
        self.on_notice = on_notice
        self.on_preview = on_preview
        self.on_error = on_error
        self.on_user_transcript = on_user_transcript
        self.on_metrics = on_metrics
        self.on_voice_dropped = on_voice_dropped
        self.on_voice_noise = on_voice_noise
        self.gate = gate or ModelGate(enabled=False)

        self.transcript_history: list[dict] = []
        self.q_index = 0
        self.follow_ups: list[str] = []
        self.finished = False
        self._resume = resume                   # a saved session being continued (ws.py loads it): history, position
        if resume:
            self.transcript_history = list(resume["history"])
            self.q_index = min(int(resume.get("q_index", 0)), max(len(self.plan) - 1, 0))
            self.follow_ups = list(resume.get("follow_ups", []))
            self.finished = bool(resume.get("finished"))
        # Tough talk modes: the negotiation / tough-question state lives here (code owns it; the model only phrases lines).
        self.neg = (resume or {}).get("negotiation") or neg
        self.tough = (resume or {}).get("tough") or tough_state
        # Interview money talk (v2): after the last question Mike asks about salary; a screening call, at most 6 turns.
        self.money_plan = (resume or {}).get("money_plan") or money_plan
        self.money = (resume or {}).get("money_talk")
        self._money_start_now = False
        if resume and self.money:
            self.finished = self.money.get("phase") == "closed"
        if mode == "negotiate" and not self.neg:
            raise ValueError("a negotiation needs its state")
        if mode == "tough" and not self.tough:
            raise ValueError("tough questions need their state")
        if resume and mode == "tough" and self.tough:
            self.finished = bool(self.tough.get("closed"))
        if resume and mode == "negotiate" and self.neg:
            self.finished = self.neg.get("phase") == "closed"
        self._talk_snaps: list[tuple] = []
        self._repeat_offered = False            # the last line was "Would you like me to repeat the question?"
        self._snapshots: list[tuple[int, list[str], bool]] = []
        self._running = False
        self._reply_task: Optional[asyncio.Task] = None
        self._preview_task: Optional[asyncio.Task] = None
        self._warm_task: Optional[asyncio.Task] = None
        self._buffer = bytearray()
        self._recording = False
        self._decision = ""
        self._gap = "none"
        self._metrics: dict = {}
        self._holding = False
        self._hold_token = 0
        self._word_tasks: set[asyncio.Task] = set()      # warm-ups only: the word pass runs after the call (D96)
        self.audio_keep = AudioKeep()           # the recordings the after-call word pass needs, within a memory budget
        # A voice turn opens before anyone knows it is speech (a breath or a click opens one too). Until the
        # recogniser has heard it Mike's reply waits (`_flow` cleared) instead of being cancelled.
        # Each voice turn (activity_start) gets exactly one verdict: dropped (no speech) or interrupted (speech).
        # Mike speaks only while no turn is open, so a verdict for an old turn never frees him while a newer
        # one is still being recorded or recognised.
        self._turns: list[int] = []
        self._noisy: set[int] = set()           # open turns whose live captions stayed empty: they no longer hold Mike
        self._turn = 0                          # the voice turn being recorded now (or last)
        self._turn_seq = 0
        self._flow = asyncio.Event()
        self._flow.set()
        self._quiet_since = 0.0                 # when the open turns last changed or stopped recording (FLOW_MAX_S)
        self._said, self._said_at = "", 0.0     # Mike's latest line and when it was written (echo check)
        self._audio_until = 0.0                 # when the audio sent so far has been played (the client plays faster
        #                                         than real time is sent, so this is an estimate)

    # ---------- interface shared with GeminiLiveDriver ----------

    def replying(self) -> bool:
        return bool(self._reply_task and not self._reply_task.done())

    def current_question(self) -> Question | None:
        return self.plan[self.q_index] if self.mode == "interview" and self.plan and self.money is None else None

    async def run(self, audio_input_stream: AsyncGenerator[bytes, None]) -> None:
        self._running = True
        warm = [self.llm.warm_up(self._warm_messages())]
        if self.stt is not None and self.stt.available:
            warm.append(asyncio.to_thread(self.stt.warm_up))
        self._warm_task = asyncio.ensure_future(asyncio.gather(*warm, return_exceptions=True))
        if self.speak:
            await asyncio.to_thread(tts.kokoro_model, self.settings)
        if self.on_ready:
            self.on_ready()
        self._reply_task = self._spawn(self._resume_opening() if self._resume else self._opening())
        async for chunk in audio_input_stream:
            if not self._running:
                break
            if self._recording and len(self._buffer) < MAX_RECORD_BYTES:
                self._buffer.extend(chunk)

    async def handle_user_text_turn(self, text: str, transcript: Transcript | None = None,
                                    turn_id: int | None = None, stt_ms: int | None = None) -> None:
        clean = norm(text)[:4000]
        if not clean:
            self._release()
            self._drop_voice_turn(turn_id)
            return
        await self._cancel_reply(interrupted=True, turn_id=turn_id)
        self._hold()
        if self._quick:                                         # the answer to "interview or English?": no feedback, no history
            meta = {"turn_id": turn_id, "source": "voice" if transcript is not None else "text", "kind": "quick_choice",
                    "transcript": transcript}
            if self.on_turn_complete:
                self.on_turn_complete("user", clean, meta)
            self._metrics = {"turn_id": turn_id, "t0": time.perf_counter(), "stt_ms": stt_ms}
            self._reply_task = self._spawn(self._quick_respond(clean))
            return
        self._snapshots.append((self.q_index, list(self.follow_ups), self.finished))
        self._talk_snaps.append((copy.deepcopy(self.neg), copy.deepcopy(self.tough), copy.deepcopy(self.money)))
        question = self.current_question()
        last_model = next((t for t in reversed(self.transcript_history) if t["role"] == "model"), None)
        if self.mode == "interview" and question:                  # not "Take your time..." or "Sure. <question>"
            asked = self.follow_ups[-1] if self.follow_ups else question.text
        elif self.mode == "tough" and tough.current(self.tough):
            asked = tough.current(self.tough)["text"]
        else:
            asked = last_model["text"] if last_model else ""
        meta = {"turn_id": turn_id, "source": "voice" if transcript is not None else "text",
                "question": asked,
                "question_id": question.id if question else "",
                "competency": question.competency if question else "",
                "answer_kind": self._answer_kind(),
                "transcript": transcript}
        self.transcript_history.append({"role": "user", "text": clean, "question_id": meta["question_id"],
                                        "kind": meta["answer_kind"]})
        if self.on_turn_complete:
            self.on_turn_complete("user", clean, meta)
        self._metrics = {"turn_id": turn_id, "t0": time.perf_counter(), "stt_ms": stt_ms}
        self._reply_task = self._spawn(self._respond(clean, transcript))

    def _answer_kind(self) -> str:
        if self.mode == "interview":
            if self.money is not None:
                return "money"
            return "follow_up" if self.follow_ups else "main"
        if self.mode == "tough":
            return "question"
        return "turn"                  # english and negotiate: free turns

    def enable_stt(self, recogniser: STT) -> None:
        """The user switched a text session to voice: attach the recogniser and warm it up in the background."""
        if self.stt is not None:
            return
        self.stt = recogniser
        if recogniser.available:
            task = asyncio.ensure_future(asyncio.to_thread(recogniser.warm_up))
            self._word_tasks.add(task)
            task.add_done_callback(self._word_tasks.discard)

    async def begin_audio_turn(self, turn_id: int | None = None, manual: bool = False) -> None:
        """The client heard something. That is not yet a barge-in: it may be a breath, a click or Mike's echo, and
        Whisper turns those into "Thank you.". Mike's reply (text and audio) waits here; real speech cancels it
        in handle_user_text_turn, anything else lets it carry on (`_drop_voice_turn`).
        The Interrupt button (`manual`) is a barge-in by definition: Mike stops now."""
        if manual:
            await self._cancel_reply(interrupted=True)
            self._audio_until = 0.0
        if turn_id is None:
            self._turn_seq += 1
            turn_id = -self._turn_seq           # the socket always sends one; this keeps direct callers apart
        self._turn = turn_id
        if turn_id not in self._turns:
            self._turns.append(turn_id)
        self._sync_flow()
        self._buffer = bytearray()
        self._recording = True
        self._stop_preview()
        if self.on_preview and self.stt is not None and self.stt.available:
            self._preview_task = asyncio.create_task(self._preview_loop(turn_id))

    async def cancel_audio_turn(self, turn_id: int | None = None) -> None:
        """The client ended its voice turn without audio (browser recognition heard nothing)."""
        turn = self._turn if turn_id is None else turn_id
        if turn == self._turn:
            self._recording = False
            self._buffer = bytearray()
            self._stop_preview()
        self._drop_voice_turn(turn)

    async def end_audio_stream(self, turn_id: int | None = None) -> None:
        if not self._recording:
            return
        self._recording = False
        self._quiet_since = time.monotonic()
        turn = self._turn
        self._stop_preview()
        pcm, self._buffer = bytes(self._buffer), bytearray()
        if self.stt is None or not self.stt.available:
            self._drop_voice_turn(turn)
            self._error("stt_unavailable", "Speech recognition is not installed on this computer. Type your answer "
                                           "or use the browser's speech recognition.", retryable=False)
            return
        was_holding, token = self._holding, self._hold_token
        self._hold()
        started = time.perf_counter()
        try:
            transcript = await asyncio.to_thread(self.stt.transcribe, pcm, False)   # text first (latency)
        except Exception as exc:
            self._unhold(was_holding, token)
            self._drop_voice_turn(turn)
            log.warning("STT failed: %s", type(exc).__name__)
            self._error("stt_failed", "Could not recognise speech. Try again or type your answer.")
            return
        stt_ms = round((time.perf_counter() - started) * 1000)
        if transcript.text.strip() and self._is_echo(transcript.text):
            log.info("STT dropped Mike's own voice coming back through the microphone")
            transcript.text = ""
        if not transcript.text.strip():
            # Nothing was said (or only noise): Mike's reply, if there is one, goes on. The notice is for a user
            # who is expected to answer, not for one who made a noise while Mike was speaking or thinking.
            busy = self.replying() or time.monotonic() < self._audio_until
            self._unhold(was_holding, token)
            self._drop_voice_turn(turn)
            if not busy and self.on_notice:
                self.on_notice("not_heard", "I didn't catch that. Please try again a little louder or closer to the "
                                            "microphone.")
            return
        if not self.audio_keep.keep(transcript, pcm):
            log.info("Kept-audio budget is full: this answer gets no word timings")
        if self.on_user_transcript:
            self.on_user_transcript(transcript, turn_id)
        await self.handle_user_text_turn(transcript.text, transcript, turn_id if turn_id is not None else turn, stt_ms)

    async def redo_answer(self) -> str:
        await self._cancel_reply(interrupted=False)
        if self._snapshots:
            self.q_index, self.follow_ups, self.finished = self._snapshots.pop()
        if self._talk_snaps:
            self.neg, self.tough, self.money = self._talk_snaps.pop()
        self._repeat_offered = False
        question = drop_last_answer(self.transcript_history)
        if question:
            self._reply_task = self._spawn(
                self._deliver(self._from_list([content.copy("redo_ack")]), lambda: {"kind": "ack"}, record=False))
        return question

    async def say_silence(self) -> None:
        if not self.replying():
            self._reply_task = self._spawn(
                self._deliver(self._from_list([content.copy("long_silence")]), lambda: {"kind": "wait"}, record=False))

    def stop(self) -> None:
        self._running = False
        self._recording = False
        self._turns.clear()
        self._noisy.clear()
        self._flow.set()
        self._stop_preview()
        self._release()
        for task in (self._reply_task, self._warm_task):
            if task and not task.done():
                task.cancel()

    # ---------- replies ----------

    def _warm_messages(self) -> list[dict]:
        if self.mode == "interview":
            return [{"role": "system", "content": self._p1_system()}, {"role": "user", "content": "warm-up"}]
        if self.mode == "negotiate":
            if bargain.is_v2(self.neg):
                return [{"role": "system", "content": self._p9_system()}, {"role": "user", "content": "warm-up"}]
            return [{"role": "system", "content": self._p7_system()}, {"role": "user", "content": "warm-up"}]
        if self.mode == "tough":                     # D117: follow-ups are written by the model now, so load it early
            return [{"role": "system", "content": content.system("p12_follow_up")}, {"role": "user", "content": "warm-up"}]
        return [{"role": "system", "content": self._tutor_system()}, {"role": "user", "content": "warm-up"}]

    def _p1_system(self) -> str:
        # Static for the whole session so the engine can reuse its cache of the system prompt (latency).
        return content.system("p1_interviewer", max_follow_ups=self.max_follow_ups, strictness=self.strictness) \
            + content.name_line(self.settings.get("name", ""))

    def _p7_system(self) -> str:
        return content.system("p7_recruiter") + content.name_line(self.settings.get("name", ""))

    def _p9_system(self) -> str:
        return content.system("p9_bargain") + content.name_line(self.settings.get("name", ""))

    def _tutor_system(self) -> str:
        preset = content.level_presets().get(self.level, content.level_presets().get("B1", ""))
        return content.system("p5a_tutor", level=self.level, level_preset=preset) \
            + content.name_line(self.settings.get("name", ""))

    async def _opening(self) -> None:
        if self._quick:
            self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
            await self._deliver(self._from_list(_sentences(content.copy("quick_opening", name=self.settings.get("name", "")))),
                                lambda: {"kind": "turn"}, record=False)
            return
        if self.mode == "negotiate":
            self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
            if bargain.is_v2(self.neg):
                line = bargain.opening_line(self.neg, self.settings.get("name", ""))
                self.neg["recent"] = [line]
            else:
                line = negotiation.opening_line(self.neg, self.settings.get("name", ""))
            await self._deliver(self._from_list(_sentences(line)), lambda: self._neg_meta("turn"))
            return
        if self.mode == "tough":
            self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
            line = tough.opening_line(self.tough, self.settings.get("name", ""))
            await self._deliver(self._from_list(_sentences(line)), lambda: self._tough_meta("question"))
            return
        if self.mode == "interview":
            first = self.plan[0]
            text = content.copy("interview_opening", name=self.settings.get("name", ""), count=len(self.plan),
                                question=first.text)
            meta = {"kind": "question", "question_id": first.id, "thread_id": first.id}
        else:
            text = (content.copy("english_opening_topic", name=self.settings.get("name", ""), topic=self.topic[:80])
                    if self.topic else content.copy("english_opening", name=self.settings.get("name", "")))
            meta = {"kind": "turn"}
        self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
        await self._deliver(self._from_list(_sentences(text)), lambda: meta)

    async def _quick_respond(self, answer: str) -> None:
        """Quick start: read the choice. Neither word: ask once more; after that it is an interview."""
        token = self._hold_token
        try:
            choice = classify_choice(answer)
            if choice is None and not self._quick_asked:
                self._quick_asked = True
                await self._deliver(self._from_list(_sentences(content.copy("quick_again"))), lambda: {"kind": "turn"},
                                    record=False)
                return
            choice = choice or "interview"
            self._quick, self.mode = False, choice
            if choice == "english":
                self.plan = []
                text, meta = content.copy("quick_english"), {"kind": "turn"}
            else:
                first = self.plan[0]
                text = content.copy("quick_interview", count=len(self.plan), question=first.text)
                meta = {"kind": "question", "question_id": first.id, "thread_id": first.id}
            if self.on_mode:
                self.on_mode(choice, self.plan)
            await self._deliver(self._from_list(_sentences(text)), lambda: meta)
        finally:
            self._release(token)

    async def _resume_opening(self) -> None:
        """US-13 AC5: the session was cut off and is continued from its saved transcript. An answer without a reply
        gets its reply now; otherwise Mike says sorry and asks again what he was waiting for."""
        self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
        last = self.transcript_history[-1] if self.transcript_history else None
        if last and last["role"] == "user":
            self._hold()
            await self._respond(last["text"], None)
            return
        if self.mode == "negotiate":
            v2 = bargain.is_v2(self.neg)
            if self.neg["phase"] == "closed":
                text = bargain.closed_line(self.neg) if v2 else talk.data()["recruiter_lines"]["closed_again"]["*"]
                await self._deliver(self._from_list(_sentences(text)), lambda: self._neg_meta("closing"), record=False)
            elif v2 and self.neg["check"]["pending"]:
                await self._come_back(resumed=True)
            else:
                text = bargain.restate_line(self.neg) if v2 else negotiation.restate_line(self.neg)
                await self._deliver(self._from_list(_sentences(text)), lambda: self._neg_meta("turn"))
            return
        if self.money is not None:
            if self.money["phase"] == "closed":
                await self._deliver(self._from_list(_sentences(content.copy("interview_closing"))),
                                    lambda: {"kind": "closing"}, record=False)
            else:
                await self._deliver(self._from_list(_sentences(bargain.restate_line(self.money))), lambda: self._money_meta("turn"))
            return
        if self.mode == "tough":
            if self.tough["closed"]:
                await self._deliver(self._from_list(_sentences(talk.data()["tough_lines"]["closing"])),
                                    lambda: self._tough_meta("closing"), record=False)
            else:
                line = talk.data()["tough_lines"]["repeat"].format(question=tough.current(self.tough)["text"])
                await self._deliver(self._from_list(_sentences(line)), lambda: self._tough_meta("repeat"))
            return
        if self.finished:
            await self._deliver(self._from_list([content.copy("interview_closing")]), lambda: {"kind": "closing"})
            return
        question = self.current_question()
        if question:
            asked = self.follow_ups[-1] if self.follow_ups else question.text
            meta = {"kind": "repeat", "question_id": question.id, "thread_id": question.id}
        else:
            asked = last["text"] if last else ""
            meta = {"kind": "turn"}
        text = content.copy("resume_opening", question=asked)
        await self._deliver(self._from_list(_sentences(text)), lambda: meta)

    async def _respond(self, answer: str, transcript: Transcript | None) -> None:
        token = self._hold_token
        try:
            if self.mode == "interview" and self.money is not None:
                await self._money_reply(answer)
            elif self.mode == "interview":
                await self._interview_reply(answer, transcript)
            elif self.mode == "negotiate":
                if bargain.is_v2(self.neg):
                    await self._bargain_reply(answer)
                else:
                    await self._negotiate_reply(answer)
            elif self.mode == "tough":
                await self._tough_reply(answer)
            else:
                await self._tutor_reply()
        finally:
            self._release(token)

    # ---------- tough talk modes ----------

    def _neg_meta(self, kind: str, reply=None, **extra) -> dict:
        st = self.neg
        out = {"kind": kind, "outcome": st["outcome"], "index": st["user_turns"]}
        step = talkcase.talk_step(st) if bargain.is_v2(st) else None
        if step is not None:
            out["talk_step"] = step
        out.update(extra)
        return out

    def _tough_meta(self, kind: str) -> dict:
        st = self.tough
        q = tough.current(st)
        out = {"kind": kind, "index": min(st["index"] + 1, tough.TOTAL), "total": tough.TOTAL}
        if q:
            out["question_id"] = q["id"]
        return out

    async def _negotiate_reply(self, answer: str) -> None:
        """Code moves first (negotiation.step on a copy), then the model phrases the line; the copy becomes the
        state only when the line has been delivered, so a cut-off turn can be resumed or redone from the old state."""
        work = copy.deepcopy(self.neg)
        reply = negotiation.step(work, answer)
        name = self.settings.get("name", "")
        base = negotiation.scripted_line(work, reply, name, base_only=True)
        line = base
        closing = reply.closing or reply.move in ("restate_offer",)
        self._metrics["path"] = "fixed"
        if not closing and reply.move not in ("closed_again", "wait_ack", *negotiation.SCRIPTED_MOVES):
            said = await self._recruiter_model_line(work, reply, answer)
            if said:
                line, self._metrics["path"] = said, "model"
            elif said is not None:
                work["guard_replacements"] += 1
        text = " ".join([line, *negotiation.tail(reply)])
        kind = "closing" if reply.closing else "turn"

        def meta() -> dict:
            self.neg = work
            self.finished = work["phase"] == "closed"
            return self._neg_meta(kind)
        await self._deliver(self._from_list(_sentences(text)), meta)

    # ---------- Negotiation v2: the bargaining engine ----------

    async def _bargain_reply(self, answer: str) -> None:
        """Code decides the act (bargain.step on a copy); the model words it inside that act; the guard replaces the line only
        on a leak. After a "let me check" line the server waits a few seconds and Mike comes back by himself."""
        work = copy.deepcopy(self.neg)
        reply = bargain.step(work, answer, await self._intent(work, answer))
        await self._bargain_deliver(work, reply, answer, state_attr="neg")
        if reply.check and self.neg is not None and self.neg["check"]["pending"] and self.neg["phase"] != "closed":
            await asyncio.sleep(bargain.check_delay())
            await self._come_back()

    async def _come_back(self, resumed: bool = False) -> None:
        work = copy.deepcopy(self.neg)
        reply = bargain.come_back(work)
        self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
        await self._bargain_deliver(work, reply, "", state_attr="neg", came_back=True)

    async def _intent(self, st: dict, text: str) -> dict | None:
        """The model's reading of the user's line (one short JSON call, checked by code). None = use the keyword reading."""
        if st["phase"] == "closed":
            return None
        if self.settings.get("engine") in SLOW_ENGINES:
            # A CLI call takes ~10 s: waiting up to 8 s for a reading the keywords give anyway made every turn slow
            # (owner 08.11, claude_cli: 10-17 s a turn). Keywords only on these engines.
            self._metrics["intent"] = "keywords"
            return None
        user = content.user("p10_intent", scenario_name=bargain.scenario_info(st["scenario"])["name"],
                            offer=bargain.fmt(st, st["offer"]) if st["offer"] is not None else "nothing yet",
                            mike_last=(st["recent"][-1] if st["recent"] else "")[:300], user_line=text[:400])
        messages = [{"role": "system", "content": content.system("p10_intent")}, {"role": "user", "content": user}]

        async def call() -> str:
            raw = ""
            agen = self.llm.chat_stream(messages, temperature=0.0, max_tokens=110, json_schema=content.schema("p10_intent"))
            try:
                async for delta in agen:
                    raw += delta
            finally:
                await agen.aclose()
            return raw
        try:
            raw = await asyncio.wait_for(call(), timeout=INTENT_TIMEOUT_S)
            data = json.loads(raw)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.info("Intent reading skipped: %s", type(exc).__name__)
            self._metrics["intent"] = "keywords"
            return None
        found = bargain.validate_intent(data, text)
        self._metrics["intent"] = "model" if found else "keywords"
        if found:
            st.setdefault("intents", []).append({"turn": st["user_turns"] + 1, "intent": found["intent"]})
        return found

    async def _bargain_deliver(self, work: dict, reply, answer: str, state_attr: str, came_back: bool = False) -> None:
        name = self.settings.get("name", "")
        base = bargain.scripted_line(work, reply, name, base_only=True)
        line = base
        self._metrics["path"] = "fixed"
        if reply.move not in bargain.FIXED_ACTS:
            said = await self._bargain_model_line(work, reply, answer)
            if said:
                line, self._metrics["path"] = said, "model"
            elif said is not None:
                work["guard_replacements"] = work.get("guard_replacements", 0) + 1
        bargain.said(work, reply, line)
        text = bargain.with_tail(work, line, reply)
        kind = "closing" if reply.closing else "checking" if reply.check else "turn"
        extra = {}
        if reply.check:
            extra = {"checking": True, "check_s": int(bargain.check_delay())}
        if came_back or reply.came_back:
            extra["came_back"] = True

        def meta() -> dict:
            setattr(self, state_attr, work)
            if state_attr == "neg":
                self.finished = work["phase"] == "closed"
                return self._neg_meta(kind, **extra)
            return self._money_meta(kind, **extra)
        await self._deliver(self._from_list(_sentences(text)), meta)

    async def _bargain_model_line(self, st: dict, reply, answer: str) -> str | None:
        """The model's wording of one act. "" = the line failed the guard (the caller counts it and uses the scripted line);
        None = no model line (error or empty)."""
        inp = bargain.model_input(st, reply, answer)
        user = content.user("p9_bargain", **{k: ("" if v is None else v) for k, v in inp.items()})
        messages = [{"role": "system", "content": self._p9_system()}, {"role": "user", "content": user}]
        raw = ""
        agen = self.llm.chat_stream(messages, temperature=0.7, max_tokens=160, json_schema=content.schema("p9_bargain"))
        try:
            async for delta in agen:
                raw += delta
        except EngineError as exc:
            log.warning("Bargain line failed: %s", exc.code)
            return None
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("Bargain line failed: %s", type(exc).__name__)
            return None
        finally:
            await agen.aclose()
        try:
            line = norm(str(json.loads(raw).get("bargain_line", "")))
        except (ValueError, AttributeError):
            m = re.search(r'"bargain_line"\s*:\s*"((?:[^"\\]|\\.)*)', raw)
            line = norm(m.group(1)) if m else ""
        if not line:
            return None
        line = trim_words(line, 70)
        ok, why = bargain.guard_ok(st, reply, line)
        if not ok:
            log.info("Bargain line replaced by the scripted line (%s)", why)
            st.setdefault("guard_reasons", []).append(why)
            return ""
        return line

    # ---------- interview money talk ----------

    def _money_meta(self, kind: str, **extra) -> dict:
        st = self.money
        out = {"kind": kind, "outcome": st["outcome"], "index": st["user_turns"]}
        out.update(extra)
        return out

    def _closing_sentences(self) -> list[str]:
        """The end of the interview: the closing line, or (money talk on) the salary question that starts the call."""
        plan = self.money_plan
        if plan and self.money is None:
            form = dict(plan["form"], scenario="screening")
            self.money = bargain.new_state(form, plan["style"])
            self.money["cap"] = bargain.data()["caps"]["money_cap"]
            line = bargain.data()["money_talk"]["start_line"]
            self.money["recent"] = [line]
            self._money_start_now = True
            self.finished = False
            return _sentences(line)
        return _sentences(content.copy("interview_closing"))

    def _closing_meta(self) -> dict:
        if self._money_start_now:
            self._money_start_now = False
            return {"kind": "money_start"}
        return {"kind": "closing"}

    async def _money_reply(self, answer: str) -> None:
        if MONEY_SKIP.search(answer):               # "Skip" / "I'd rather not talk about it": the interview closes as usual
            work = copy.deepcopy(self.money)
            work["user_turns"] += 1
            work["phase"], work["outcome"] = "closed", "skipped"

            def meta() -> dict:
                self.money = work
                self.finished = True
                return {"kind": "closing"}
            await self._deliver(self._from_list(_sentences(content.copy("interview_closing"))), meta)
            return
        work = copy.deepcopy(self.money)
        reply = bargain.step(work, answer, await self._intent(work, answer))
        await self._bargain_deliver(work, reply, answer, state_attr="money")
        if self.money["phase"] == "closed":
            self.finished = True

    async def _recruiter_model_line(self, st: dict, reply, answer: str) -> str | None:
        """The model's phrasing of one move. "" = the line failed the number guard (caller counts it);
        None = no model line (error or empty), the scripted line is used without counting."""
        user = content.user("p7_recruiter", **{k: ("" if v is None else v) for k, v in
                                                negotiation.model_input(st, reply, answer).items()})
        messages = [{"role": "system", "content": self._p7_system()}, {"role": "user", "content": user}]
        raw = ""
        agen = self.llm.chat_stream(messages, temperature=0.4, max_tokens=140, json_schema=content.schema("p7_recruiter"))
        try:
            async for delta in agen:
                raw += delta
        except EngineError as exc:
            log.warning("Recruiter line failed: %s", exc.code)
            return None
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("Recruiter line failed: %s", type(exc).__name__)
            return None
        finally:
            await agen.aclose()
        try:
            line = norm(str(json.loads(raw).get("recruiter_line", "")))
        except (ValueError, AttributeError):
            m = re.search(r'"recruiter_line"\s*:\s*"((?:[^"\\]|\\.)*)', raw)
            line = norm(m.group(1)) if m else ""
        if not line:
            return None
        if not negotiation.guard_ok(line, negotiation.numbers_allowed(reply, st)):
            log.info("Recruiter line replaced by the scripted line (number guard)")
            return ""
        return trim_words(line, 70)

    async def _tough_reply(self, answer: str) -> None:
        work = copy.deepcopy(self.tough)
        res = tough.step(work, answer)
        self._metrics["path"] = "fixed"
        if res["kind"] == "follow_up":
            line = await self._tough_follow_up(work, answer, res["line"])
            if line:
                res["line"] = line
                work["log"][-1]["pushes"][-1]["text"] = line
                self._metrics["path"] = "model"

        def meta() -> dict:
            self.tough = work
            self.finished = work["closed"]
            return self._tough_meta(res["kind"] if res["kind"] in ("question", "follow_up", "pressure", "move_on", "closing",
                                                                   "repeat") else "question")
        await self._deliver(self._from_list(_sentences(res["line"])), meta)

    async def _tough_follow_up(self, work: dict, answer: str, fixed: str) -> str | None:
        """D117: Mike's follow-up written from the answer (owner 08.11: "Will you need a visa?" → "No, I don't" got the
        fixed "How long would that take?"). Code still decides that a follow-up comes; None keeps the fixed line."""
        if self.settings.get("engine") in SLOW_ENGINES:
            return None
        q = tough.current(work)
        if q is None:
            return None
        user = content.user("p12_follow_up", question=q["text"], checking=q["checking"], purpose=fixed,
                            answer=answer[:1200])
        messages = [{"role": "system", "content": content.system("p12_follow_up")}, {"role": "user", "content": user}]

        async def call() -> str:
            raw = ""
            agen = self.llm.chat_stream(messages, temperature=0.6, max_tokens=60, json_schema=content.schema("p12_follow_up"))
            try:
                async for delta in agen:
                    raw += delta
            finally:
                await agen.aclose()
            return raw
        try:
            raw = await asyncio.wait_for(call(), timeout=FOLLOW_UP_TIMEOUT_S)
            line = " ".join(str(json.loads(raw).get("follow_up", "")).split())
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.info("Follow-up line skipped: %s", type(exc).__name__)
            return None
        allowed = hintgen.allowed_numbers([answer, q["text"]], [])
        if not line or len(line.split()) > 24 or not line.endswith("?") or hintgen.numbers_in(line) - allowed:
            return None
        if difflib.SequenceMatcher(None, line.lower(), fixed.lower()).ratio() >= 0.8:
            return None                               # the model copied the fixed line: same thing, keep it fixed
        return line

    def hint(self, another: bool = False) -> dict | None:
        """An in-call tactic card chosen by code (no model). Recorded in the state for the debrief. `another` = the next-best
        card for this moment (cards already shown at this turn are skipped). It never fails: if the card cannot be built, a
        fixed fallback card answers (None only outside Tough talk)."""
        if self.mode == "interview" and getattr(self, "money", None) is not None:
            return self._money_hint(another)
        if self.mode not in ("negotiate", "tough"):
            return None
        try:
            return self._hint(another)
        except Exception:  # a hint must always arrive, a broken state or card must not leave the button waiting
            log.exception("hint failed, answering with the fallback card")
            return talk.fallback_hint(self.mode)

    async def hint_example(self, payload: dict) -> str | None:
        """D117: the card's "Try saying" line written by the model from what the person said (hintgen checks it). None =
        keep the fixed example: a slow (CLI) engine, Mike is speaking, a card whose fixed line is right, or no good line."""
        if (self.settings.get("engine") in SLOW_ENGINES or self.replying() or payload.get("card_id") in FIXED_HINT_LINES
                or not payload.get("title")):
            return None
        said = [t["text"] for t in self.transcript_history if t.get("role") == "user" and t.get("text")][-6:]
        mike = [t["text"] for t in self.transcript_history if t.get("role") != "user" and t.get("text")]
        values: list = []
        labels: list[str] = []
        if self.mode == "tough":
            practice = "tough interview questions"
        else:
            st = self.money if getattr(self, "money", None) is not None else self.neg
            practice = "a salary talk" + (f" ({bargain.scenario_info(st['scenario'])['name']})" if st.get("scenario") else "")
            su = (st.get("levers") or {}).get("step_up") or {}
            said_ask = st.get("user_anchor") or st.get("ask")
            named = [("their target (private)" if not said_ask else "", st.get("target")), ("the number they asked for", said_ask),
                     ("their current pay", st.get("current_pay")), ("Mike's first offer", st.get("opening") or st.get("offer")),
                     ("Mike's offer now", st.get("new_offer")), ("step-up now", su.get("now_amount")),
                     ("step-up later", su.get("later_amount"))]
            labels = [f"{name} {talk.money(v)}" for name, v in named if name and isinstance(v, (int, float)) and v]
            values = [v for _, v in named] + [st.get("offer")]
        case_texts = [] if self.mode == "tough" else [*((st.get("case") or {}).get("results") or [])]
        allowed = hintgen.allowed_numbers(said + mike + case_texts, values)
        named_set = hintgen.allowed_numbers([], values)
        rest = sorted(allowed - named_set)
        numbers = "; ".join(labels + ([f"also said in the talk: {', '.join(rest)}"] if rest else [])) or "none"
        case_block = talkcase.hint_context(st) if self.mode != "tough" else ""
        shape = payload.get("shape") or ""
        user = content.user("p11_hint", practice=practice, tactic_title=payload["title"], tactic_rule=payload.get("text", ""),
                            shape_line=f"ANSWER SHAPE: {shape}" if shape and shape != payload.get("text") else "",
                            example=payload.get("example") or "(none)",
                            mike_last=(mike[-1] if mike else "")[:300],
                            said="\n".join(f"- {x[:300]}" for x in said) or "(nothing yet)",
                            numbers=numbers, case=case_block)
        messages = [{"role": "system", "content": content.system("p11_hint")}, {"role": "user", "content": user}]

        async def call() -> str:
            raw = ""
            agen = self.llm.chat_stream(messages, temperature=0.5, max_tokens=90, json_schema=content.schema("p11_hint"))
            try:
                async for delta in agen:
                    raw += delta
            finally:
                await agen.aclose()
            return raw
        try:
            raw = await asyncio.wait_for(call(), timeout=HINT_GEN_TIMEOUT_S)
            line = str(json.loads(raw).get("candidate_line", ""))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.info("Hint line skipped: %s", type(exc).__name__)
            return None
        return hintgen.clean(line, allowed, said)

    def _money_hint(self, another: bool) -> dict:
        try:
            st = self.money
            spoken = [t for t in self.transcript_history if t["role"] == "user" and t.get("kind") == "money"]
            exclude = bargain.hints_shown_now(st)
            cid = bargain.pick_hint(st, spoken, exclude)
            st["hints_used"].append({"card_id": cid, "turn": st["user_turns"]})
            return talk.hint_payload(cid, "negotiate", len(st["hints_used"]), example=bargain.card_example(cid, st))
        except Exception:
            log.exception("money hint failed, answering with the fallback card")
            return talk.fallback_hint("negotiate")

    def _hint(self, another: bool) -> dict:
        if self.mode == "negotiate" and bargain.is_v2(self.neg):
            spoken = [t for t in self.transcript_history if t["role"] == "user"]
            exclude = bargain.hints_shown_now(self.neg)             # every press moves on (owner 08.11: H gave the same card again)
            cid = bargain.pick_hint(self.neg, spoken, exclude)
            self.neg["hints_used"].append({"card_id": cid, "turn": self.neg["user_turns"]})
            return talk.hint_payload(cid, "negotiate", len(self.neg["hints_used"]), example=bargain.card_example(cid, self.neg))
        if self.mode == "negotiate":
            spoken = [t for t in self.transcript_history if t["role"] == "user"]
            exclude = negotiation.hints_shown_now(self.neg)             # every press moves on (owner 08.11: H gave the same card again)
            cid = negotiation.pick_hint(self.neg, spoken, exclude)
            self.neg["hints_used"].append({"card_id": cid, "turn": self.neg["user_turns"]})
            return talk.hint_payload(cid, "negotiate", len(self.neg["hints_used"]), example=negotiation.card_example(cid, self.neg))
        h = tough.pick_hint(self.tough, another)
        self.tough["hints_used"].append({"card_id": h["card_id"], "question_id": h["question_id"], "turn": h["turn"]})
        return tough.hint_payload(self.tough, h, len(self.tough["hints_used"]))

    async def _interview_reply(self, answer: str, transcript: Transcript | None) -> None:
        question = self.plan[self.q_index]
        words = len(WORD.findall(answer))
        # What Mike is waiting for an answer to: the last follow-up in this thread, else the main question.
        # Never his last line, which can be "Take your time..." itself.
        asked = self.follow_ups[-1] if self.follow_ups else question.text
        offered, self._repeat_offered = self._repeat_offered, False
        if self.finished:
            await self._deliver(self._from_list([content.copy("interview_closing")]), lambda: {"kind": "closing"})
            return
        if (REPEAT.search(answer) and words <= 12) or (offered and words <= 6 and YES.search(answer)
                                                        and not NO.search(answer)):
            self._metrics["path"] = "fixed"
            await self._deliver(self._from_list(_sentences(content.copy("repeat_question", question=asked))),
                                lambda: {"kind": "repeat", "question_id": question.id, "thread_id": question.id})
            return
        if SMALL_TALK.search(answer) and words <= 10 and not self.follow_ups:
            self._metrics["path"] = "fixed"
            await self._deliver(self._from_list(_sentences(content.copy("small_talk", question=asked))),
                                lambda: {"kind": "repeat", "question_id": question.id, "thread_id": question.id})
            return
        if offered and words <= 6 and NO.search(answer):
            self._metrics["path"] = "fixed"
            await self._deliver(self._from_list([content.copy("redo_ack")]),
                                lambda: {"kind": "wait", "question_id": question.id, "thread_id": question.id})
            return
        if words < 5:
            self._metrics["path"] = "fixed"
            # Offer to repeat once; a second short answer in a row gets only "Take your time."
            line = "long_silence" if offered else "short_answer"
            self._repeat_offered = not offered
            await self._deliver(self._from_list([content.copy(line)]),
                                lambda: {"kind": "wait", "question_id": question.id, "thread_id": question.id})
            return
        if len(self.follow_ups) >= self.max_follow_ups:
            await self._advance()
            return
        nxt = self.plan[self.q_index + 1] if self.q_index + 1 < len(self.plan) else None
        low = transcript.low_confidence() if transcript else []
        marked = mark_misheard(answer, low)
        user = content.user("p1_interviewer", question=question.text,
                            next_question=nxt.text if nxt else "(This was the last question. Say: Okay.)",
                            follow_up_bank="; ".join(f"{tag}: {text}" for tag, text in question.follow_ups.items()),
                            follow_ups_already_asked="; ".join(self.follow_ups) or "none",
                            focus_gaps=", ".join(self.focus_gaps) or "none",
                            transcript=marked, **hints(answer))
        messages = [{"role": "system", "content": self._p1_system()}, {"role": "user", "content": user}]
        self._decision = ""
        self._gap = "none"
        self._metrics["path"] = "model"
        try:
            text = await self._deliver(self._p1_sentences(messages), self._follow_meta, require_text=True)
        except EngineError as exc:
            self._error(exc.code, exc.message, hint=exc.hint)
            text = ""
        if text:
            if self._decision == "wait" and REPEAT.search(text):
                self._repeat_offered = True             # the model offered to repeat: "yes" now means repeat
            return
        if self._decision == "follow_up" and self._gap in GAP_TAG and GAP_TAG[self._gap] in question.follow_ups:
            fallback = question.follow_ups[GAP_TAG[self._gap]]          # the model chose a gap but said nothing
            if fallback not in self.follow_ups:
                self.follow_ups.append(fallback)
                await self._deliver(self._from_list([fallback]), self._follow_meta)
                return
        await self._advance()

    def _follow_meta(self) -> dict:
        if self._decision == "moved_on":
            if self.finished or self._money_start_now:
                return self._closing_meta()
            question = self.plan[self.q_index]
            return {"kind": "question", "question_id": question.id, "thread_id": question.id}
        question = self.plan[self.q_index]
        kind = "wait" if self._decision == "wait" else "follow_up"
        return {"kind": kind, "question_id": question.id, "thread_id": question.id, "gap": self._gap}

    async def _p1_sentences(self, messages: list[dict]) -> AsyncIterator[str]:
        streamer = JsonFieldStreamer()
        pending, said, first, moved = "", [], True, False
        agen = self.llm.chat_stream(messages, temperature=0.3, max_tokens=160,
                                    json_schema=content.schema("p1_interviewer"))
        try:
            async for delta in agen:
                new = streamer.feed(delta)
                gap = re.search(r'"gap"\s*:\s*"(\w+)"', streamer.buffer)
                if gap:
                    self._gap = gap.group(1)
                if streamer.action == "next_question" and not said:
                    self._decision = "next_question"
                    return                                     # the code asks the next question itself
                if not new:
                    if streamer.say_done:
                        break
                    continue
                pending += new
                while (match := SENTENCE_END.match(pending)) and match.end() < len(pending):
                    sentence = self._clean(match.group(1), first)
                    pending = pending[match.end():]
                    if sentence is None:                       # a repeated follow-up: move on instead
                        self._decision = "next_question" if not said else self._decision
                        return
                    if sentence and self._moves_on(sentence):
                        moved = True
                        break
                    if sentence:
                        first = False
                        said.append(sentence)
                        yield sentence
                        if "?" in sentence:
                            return                             # exactly one question per turn
                if moved or streamer.say_done:
                    break
        finally:
            await agen.aclose()
            self._decision = self._decision or streamer.action or "follow_up"
        rest = "" if moved else (self._clean(trim_words(pending.strip(), 30), first) if pending.strip() else "")
        if rest and self._moves_on(rest):
            moved = True
        if moved:
            for line in self._move_on(said):
                yield line
            return
        if rest is None:
            if not said:
                self._decision = "next_question"               # never repeat a follow-up
            return
        if rest and self._decision != "next_question":
            said.append(rest)
            yield rest
        if said and self._decision != "wait":
            self.follow_ups.append(" ".join(said))

    def _moves_on(self, sentence: str) -> bool:
        """True when a sentence in a follow-up turn starts a new main question (question drift)."""
        if MOVE_ON.search(sentence):
            return True
        nxt = self.plan[self.q_index + 1] if self.q_index + 1 < len(self.plan) else None
        if nxt is None:
            return False
        target = {w.lower() for w in WORD.findall(nxt.text)}
        if len(target) < 4:
            return False
        words = {w.lower() for w in WORD.findall(sentence)}
        return len(words & target) / len(target) >= DRIFT_OVERLAP

    def _move_on(self, said: list[str]) -> list[str]:
        """The model moved on by itself: the code asks the planned next question verbatim, in the same turn,
        and the turn is labelled as that question (or the closing line after the last one)."""
        log.info("Interviewer moved on by itself; asking the planned next question")
        self._decision = "moved_on"
        self._metrics["moved_on"] = True
        lines = [] if said else ["Okay."]
        nxt = self.plan[self.q_index + 1] if self.q_index + 1 < len(self.plan) else None
        if nxt is None:
            self.finished = True
            closing = self._closing_sentences()
            return lines + (closing[1:] if said and closing and closing[0] == "Okay." else closing)
        self.q_index += 1
        self.follow_ups = []
        return lines + [nxt.text]

    def _clean(self, sentence: str, first: bool) -> str | None:
        """Sanitize one interviewer sentence. None when it repeats a follow-up already asked."""
        sentence = TAG_PREFIX.sub("", sentence.strip())
        sentence = sanitize_sentence(sentence, first) if sentence else ""
        if "?" in sentence:
            asked = {norm(q).lower() for f in self.follow_ups for q in _sentences(f) if "?" in q}
            if norm(sentence).lower() in asked:
                return None
        return sentence

    async def _advance(self) -> None:
        self._metrics.setdefault("path", "fixed")
        nxt = self.plan[self.q_index + 1] if self.q_index + 1 < len(self.plan) else None
        if nxt is None:
            self.finished = True
            sentences = self._closing_sentences()
            await self._deliver(self._from_list(sentences), self._closing_meta)
            return
        self.q_index += 1
        self.follow_ups = []
        await self._deliver(self._from_list(["Okay.", nxt.text]),
                            lambda: {"kind": "question", "question_id": nxt.id, "thread_id": nxt.id})

    async def _tutor_reply(self) -> None:
        messages = [{"role": "system", "content": self._tutor_system()}]
        for turn in self.transcript_history[-16:]:
            if turn["role"] == "user":
                messages.append({"role": "user", "content": f"<turn>{turn['text']}</turn>"})
            else:
                messages.append({"role": "assistant", "content": turn["text"]})
        self._metrics["path"] = "model"
        try:
            await self._deliver(self._plain_sentences(messages), lambda: {"kind": "turn"})
        except EngineError as exc:
            self._error(exc.code, exc.message, hint=exc.hint)

    async def _plain_sentences(self, messages: list[dict]) -> AsyncIterator[str]:
        pending, count = "", 0
        agen = self.llm.chat_stream(messages, temperature=0.7, max_tokens=140)
        try:
            async for delta in agen:
                pending += delta
                while (match := SENTENCE_END.match(pending)) and match.end() < len(pending):
                    sentence = match.group(1).strip()
                    pending = pending[match.end():]
                    if sentence:
                        count += 1
                        yield sentence
                        if "?" in sentence or count >= 3:
                            return
        finally:
            await agen.aclose()
        if pending.strip() and count < 3:
            yield pending.strip()

    @staticmethod
    async def _from_list(items: list[str]) -> AsyncIterator[str]:
        for item in items:
            if item.strip():
                yield item.strip()

    async def _deliver(self, sentences: AsyncIterator[str], meta: Callable[[], dict], *, record: bool = True,
                       require_text: bool = False) -> str:
        """Show and speak sentences as they arrive; record the turn (even a cut-off one) at the end."""
        full = ""
        speech: asyncio.Queue = asyncio.Queue()
        heard = asyncio.Event()
        voice = asyncio.create_task(self._voice_worker(speech, heard)) if self.speak else None
        started = False
        completed = False
        token = self._hold_token
        try:
            async for sentence in sentences:
                await self._may_speak()         # a voice turn is open: wait for the verdict before saying more
                if not started:
                    started = True
                    self._metrics.setdefault("first_text_ms", self._ms())
                    if self.on_turn_start:
                        self.on_turn_start("model")
                full = f"{full} {sentence}".strip()
                self._said, self._said_at = full, time.monotonic()
                if self.on_transcript_delta:
                    self.on_transcript_delta("model", sentence, full)
                if voice:
                    for part in _speech_parts(sentence, first=full == sentence):
                        await speech.put(part)
            if voice:
                await speech.put(None)
                # Background jobs wait for Mike's first audio too: speech synthesis shares the machine with them.
                first = asyncio.ensure_future(heard.wait())
                try:
                    await asyncio.wait({voice, first}, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    first.cancel()              # also when the reply is cancelled here (no pending task left behind)
            self._release(token)                # text written and first audio out: background jobs may run now
            if voice:
                await voice
            completed = True
        finally:
            self._release(token)
            if voice and not voice.done():
                voice.cancel()
            if full:
                info = meta() or {}
                if not completed:
                    info["interrupted"] = True
                if record:
                    self.transcript_history.append({"role": "model", "text": full, **{k: v for k, v in info.items()
                                                                                    if k in ("kind", "question_id")}})
                if self.on_turn_complete:
                    self.on_turn_complete("model", full, info)
            if (full or not require_text) and completed:
                self._emit_metrics()
                if self.on_response_complete:
                    self.on_response_complete()
        return full

    async def _voice_worker(self, speech: asyncio.Queue, heard: asyncio.Event | None = None) -> None:
        while True:
            sentence = await speech.get()
            if sentence is None:
                return
            try:
                pcm = await asyncio.to_thread(tts.synthesize_pcm, sentence, self.voice, self.speed, self.settings)
            except Exception as exc:   # speech is optional: keep the text conversation going
                log.warning("TTS failed: %s", type(exc).__name__)
                continue
            for i in range(0, len(pcm), tts.CHUNK_BYTES):
                await self._may_speak()
                self._metrics.setdefault("first_audio_ms", self._ms())
                chunk = pcm[i:i + tts.CHUNK_BYTES]
                self._audio_until = max(self._audio_until, time.monotonic()) + len(chunk) / (2 * tts.SAMPLE_RATE)
                if self.on_audio_chunk:
                    self.on_audio_chunk(chunk)
                if heard:
                    heard.set()

    def _ms(self) -> int | None:
        t0 = self._metrics.get("t0")
        return round((time.perf_counter() - t0) * 1000) if t0 else None

    def _emit_metrics(self) -> None:
        if not self.on_metrics or not self._metrics.get("t0"):
            return
        data = {k: v for k, v in self._metrics.items() if k != "t0"}
        data["total_ms"] = self._ms()
        data["model"] = self.llm.model
        self._metrics = {}
        self.on_metrics(data)

    async def _cancel_reply(self, interrupted: bool, turn_id: int | None = None) -> None:
        """Stop Mike's reply. `turn_id`: the voice turn that proved to be speech (only that turn gets its verdict;
        newer ones stay open). None (typed text, redo, Interrupt button): every open voice turn is settled."""
        task = self._reply_task
        running = bool(task and not task.done())
        if running:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        targeted = turn_id in self._turns
        had_turns = bool(self._turns)
        if targeted:
            self._turns.remove(turn_id)
            self._noisy.discard(turn_id)
        else:
            self._turns.clear()
            self._noisy.clear()
        # Speech also tells the client to drop the audio it held back for Mike (it may still be playing a line
        # the server finished long ago, so also while his audio is estimated to be playing).
        if interrupted and (running or had_turns or time.monotonic() < self._audio_until) and self.on_interrupted:
            self.on_interrupted(turn_id if targeted else None)
        self._sync_flow()

    def _drop_voice_turn(self, turn_id: int | None = None) -> None:
        """The voice turn was no speech: its verdict is sent once. Mike goes on when no other turn is open (the
        client resumes the audio it held back)."""
        if turn_id not in self._turns:
            return
        self._turns.remove(turn_id)
        self._noisy.discard(turn_id)
        self._sync_flow()
        if self.on_voice_dropped:
            self.on_voice_dropped(turn_id)

    def _mark_noise(self, turn_id: int) -> None:
        """Not a verdict: the turn is still open and gets its one verdict when it ends. Until then it does not hold
        Mike back (the client is told to play his audio on)."""
        if turn_id not in self._turns or turn_id in self._noisy:
            return
        self._noisy.add(turn_id)
        self._sync_flow()
        if self.on_voice_noise:
            self.on_voice_noise(turn_id)

    def _sync_flow(self) -> None:
        self._quiet_since = time.monotonic()
        if any(turn not in self._noisy for turn in self._turns):
            self._flow.clear()
        else:
            self._flow.set()

    async def _may_speak(self) -> None:
        """Wait for Mike's turn to speak. If the verdicts never come (the user stopped talking FLOW_MAX_S ago and
        recognition has not answered), the open turns are dropped: noise must not silence him for good."""
        while not self._flow.is_set():
            try:
                await asyncio.wait_for(self._flow.wait(), FLOW_POLL_S)
            except asyncio.TimeoutError:
                if not self._recording and time.monotonic() - self._quiet_since > FLOW_MAX_S:
                    log.info("No verdict on %d voice turn(s) for %d s; Mike goes on", len(self._turns), FLOW_MAX_S)
                    for turn in list(self._turns):
                        self._drop_voice_turn(turn)

    def _is_echo(self, text: str) -> bool:
        """Mike's own voice through the microphone: a short transcript made of his last words, soon after them."""
        if not self.produces_audio or not self._said:
            return False
        now = time.monotonic()
        last_heard = now if now < self._audio_until else max(self._said_at, self._audio_until)
        return now - last_heard <= ECHO_WINDOW_S and echo_of(text, self._said)

    def _unhold(self, was_holding: bool, token: int) -> None:
        """Undo the hold taken for a voice turn that was no speech. A reply that already held the model keeps it."""
        if was_holding:
            self._hold_token = token
        else:
            self._release()

    def _hold(self) -> None:
        """Mike takes the model (from the end of the user's answer until his reply is written and audible)."""
        self._hold_token += 1
        if not self._holding:
            self._holding = True
            self.gate.hold()

    def _release(self, token: int | None = None) -> None:
        """Give the model back. With a token, only if no newer answer took it since (a cancelled reply must
        not release the hold of the answer that interrupted it)."""
        if self._holding and (token is None or token == self._hold_token):
            self._holding = False
            self.gate.release()

    def _spawn(self, coro) -> asyncio.Task:
        """Start a reply; an unexpected failure is reported instead of silently ending the turn."""
        task = asyncio.create_task(coro)

        def done(t: asyncio.Task) -> None:
            if not t.cancelled() and t.exception() is not None:
                log.warning("Reply failed: %r", t.exception())
                self._error("reply_failed", "Mike could not reply. Try again or end the session.")
        task.add_done_callback(done)
        return task

    def _error(self, code: str, message: str, hint: str = "", retryable: bool = True) -> None:
        if self.on_error:
            self.on_error(code, message, hint, retryable)

    # ---------- live captions ----------

    def _stop_preview(self) -> None:
        if self._preview_task and not self._preview_task.done():
            self._preview_task.cancel()
        self._preview_task = None

    async def _preview_loop(self, turn: int) -> None:
        """Captions while the user speaks: re-read the growing answer about once a second (display only).
        A turn whose captions stay empty is noise (a long knocking, a fan): after a few the verdict is given early so
        Mike is not kept quiet for as long as it lasts. If it turns out to be speech after all, the final
        recognition still cancels his reply, as any barge-in."""
        window = 16000 * 2 * PREVIEW_SECONDS
        done, empty = 0, 0
        try:
            while self._recording:
                await asyncio.sleep(0.8)
                size = len(self._buffer)
                if size - done < 16000:
                    continue
                done = size
                result = await asyncio.to_thread(self.stt.transcribe_if_idle, bytes(self._buffer[-window:]))
                if result is None or not self._recording or self._turn != turn:
                    continue
                empty = 0 if result.text else empty + 1
                if result.text and self.on_preview:
                    self.on_preview(("… " if size > window else "") + result.text)
                elif empty >= PREVIEW_EMPTY_RESUME and size >= 32000 * NOISE_TURN_MIN_S:
                    log.info("Voice turn with no words in %d s of audio; Mike goes on", size // 32000)
                    self._mark_noise(turn)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.info("Live caption skipped: %s", type(exc).__name__)


def echo_of(text: str, said: str) -> bool:
    """True when a short transcript is made of words Mike just said, in his order (>= 80 %, at least two words)."""
    heard = [w.lower() for w in WORD.findall(text)]
    spoken = [w.lower() for w in WORD.findall(said)]
    if not 2 <= len(heard) <= ECHO_MAX_WORDS:
        return False
    at, matched = 0, 0
    for word in heard:
        try:
            at = spoken.index(word, at) + 1
        except ValueError:
            continue
        matched += 1
    return matched / len(heard) >= ECHO_MATCH


def _sentences(text: str) -> list[str]:
    parts = [m.group(1).strip() for m in SENTENCE_END.finditer(text)]
    tail = SENTENCE_END.sub("", text).strip()
    return parts + ([tail] if tail else [])


def _speech_parts(sentence: str, first: bool) -> list[str]:
    """Split a long first sentence at its first comma so the first audio starts sooner."""
    if first and len(sentence.split()) > 8 and ", " in sentence:
        head, tail = sentence.split(", ", 1)
        if len(head.split()) >= 2:
            return [head + ",", tail]
    return [sentence]
