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
import logging
import re
import time
from typing import AsyncGenerator, AsyncIterator, Callable, Optional

from . import content, tts
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
                 gate: ModelGate | None = None, resume: dict | None = None, **_ignored) -> None:
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
        return self.plan[self.q_index] if self.mode == "interview" and self.plan else None

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
        self._snapshots.append((self.q_index, list(self.follow_ups), self.finished))
        question = self.current_question()
        last_model = next((t for t in reversed(self.transcript_history) if t["role"] == "model"), None)
        if self.mode == "interview" and question:                  # not "Take your time..." or "Sure. <question>"
            asked = self.follow_ups[-1] if self.follow_ups else question.text
        else:
            asked = last_model["text"] if last_model else ""
        meta = {"turn_id": turn_id, "source": "voice" if transcript is not None else "text",
                "question": asked,
                "question_id": question.id if question else "",
                "competency": question.competency if question else "",
                "answer_kind": ("follow_up" if self.follow_ups else "main") if self.mode == "interview" else "turn",
                "transcript": transcript}
        self.transcript_history.append({"role": "user", "text": clean, "question_id": meta["question_id"],
                                        "kind": meta["answer_kind"]})
        if self.on_turn_complete:
            self.on_turn_complete("user", clean, meta)
        self._metrics = {"turn_id": turn_id, "t0": time.perf_counter(), "stt_ms": stt_ms}
        self._reply_task = self._spawn(self._respond(clean, transcript))

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
        return [{"role": "system", "content": self._tutor_system()}, {"role": "user", "content": "warm-up"}]

    def _p1_system(self) -> str:
        # Static for the whole session so the engine can reuse its cache of the system prompt (latency).
        return content.system("p1_interviewer", max_follow_ups=self.max_follow_ups, strictness=self.strictness) \
            + content.name_line(self.settings.get("name", ""))

    def _tutor_system(self) -> str:
        preset = content.level_presets().get(self.level, content.level_presets().get("B1", ""))
        return content.system("p5a_tutor", level=self.level, level_preset=preset) \
            + content.name_line(self.settings.get("name", ""))

    async def _opening(self) -> None:
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

    async def _resume_opening(self) -> None:
        """US-13 AC5: the session was cut off and is continued from its saved transcript. An answer without a reply
        gets its reply now; otherwise Mike says sorry and asks again what he was waiting for."""
        self._metrics = {"turn_id": None, "t0": time.perf_counter(), "stt_ms": None, "opening": True}
        last = self.transcript_history[-1] if self.transcript_history else None
        if last and last["role"] == "user":
            self._hold()
            await self._respond(last["text"], None)
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
            if self.mode == "interview":
                await self._interview_reply(answer, transcript)
            else:
                await self._tutor_reply()
        finally:
            self._release(token)

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
            if self.finished:
                return {"kind": "closing"}
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
            closing = _sentences(content.copy("interview_closing"))
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
            await self._deliver(self._from_list(_sentences(content.copy("interview_closing"))),
                                lambda: {"kind": "closing"})
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
