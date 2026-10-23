"""Voice turns that are no speech (a breath, a click, Mike's echo): Whisper turns them into "Thank you." and they must
neither become the user's answer nor cost Mike his reply."""
from __future__ import annotations

import asyncio
import sys
import time
import types

import numpy as np
import pytest

from server import stt as stt_module
from server import tts
from server.content import Question
from server.session import TextDriver, echo_of
from server.stt import STT, Segment, Transcript, non_speech_reason, speech_levels

from .conftest import FakeLLM

PLAN = [Question("A1", "A", "Why this role?", {"RN": "What was the result?"}),
        Question("B1", "B", "Tell me about a project you owned.", {"RN": "The result?"})]
LONG = "I worked on the payments team and we shipped a new checkout flow for the store last spring."
REPLY = {"gap": "result", "action": "follow_up", "say": "What was the result?"}


def pcm(seconds: float, amplitude: float) -> bytes:
    """A tone at `amplitude` (peak, 0..1) at the page's scale: rms is amplitude / sqrt(2)."""
    t = np.arange(int(16000 * seconds)) / 16000
    return (np.sin(2 * np.pi * 220 * t) * amplitude * 32767).astype(np.int16).tobytes()


# ---------- the drop decision ----------

def test_silence_phrase_on_a_short_or_quiet_clip_is_dropped():
    assert non_speech_reason("Thank you.", voiced_s=0.2, level=0.05) == "silence phrase"      # short, even if loud
    assert non_speech_reason("Thanks for watching!", voiced_s=3.0, level=0.005) == "silence phrase"   # quiet
    assert non_speech_reason("you", voiced_s=0.0, level=0.0)
    assert non_speech_reason("Hmm.", voiced_s=0.4, level=0.008) == "silence phrase"
    assert non_speech_reason("  thank   YOU very much ", voiced_s=0.3, level=0.04)


def test_the_same_phrase_long_and_loud_is_kept():
    assert non_speech_reason("Thank you very much.", voiced_s=1.8, level=0.06) == ""


def test_real_short_answers_are_kept():
    for text in ("Yes.", "No, I haven't.", "Okay.", "Sure.", "Thank you for the question, I would say teamwork.",
                 "Thank you, that was my last project."):
        assert non_speech_reason(text, voiced_s=0.2, level=0.004) == "", text


def test_whisper_no_speech_rule_needs_both_signals():
    assert Segment("x", no_speech_prob=0.9, avg_logprob=-1.5).is_noise()
    assert not Segment("x", no_speech_prob=0.9, avg_logprob=-0.4).is_noise()     # sure of its words
    assert not Segment("x", no_speech_prob=0.2, avg_logprob=-1.5).is_noise()      # probably speech
    assert not Segment("x", no_speech_prob=0.6, avg_logprob=-1.0).is_noise()      # thresholds are strict


def test_speech_levels_tell_a_tone_from_silence():
    voiced, level = speech_levels(pcm(2.0, 0.1))
    assert voiced == pytest.approx(2.0, abs=0.1) and level == pytest.approx(0.07, abs=0.01)
    assert speech_levels(bytes(32000)) == (0.0, 0.0)
    assert speech_levels(b"") == (0.0, 0.0)
    voiced, _ = speech_levels(bytes(32000) + pcm(0.5, 0.1) + bytes(32000))         # a blip inside a long pause
    assert voiced == pytest.approx(0.5, abs=0.07)


def fake_mlx(monkeypatch, text, segments):
    module = types.ModuleType("mlx_whisper")
    module.transcribe = lambda *a, **k: {"text": text, "segments": segments}
    monkeypatch.setitem(sys.modules, "mlx_whisper", module)
    return STT("mlx", "fake")


def test_transcribe_drops_whisper_silence_phrase_on_a_quiet_clip(monkeypatch):
    segs = [{"text": " Thank you.", "no_speech_prob": 0.1, "avg_logprob": -0.3}]
    recogniser = fake_mlx(monkeypatch, " Thank you.", segs)
    assert recogniser.transcribe(bytes(32000), False).text == ""
    assert recogniser.transcribe(pcm(2.5, 0.2), False).text == "Thank you."        # loud and long enough


def test_transcribe_drops_noise_segments_and_keeps_the_rest(monkeypatch):
    segs = [{"text": " Hmm.", "no_speech_prob": 0.8, "avg_logprob": -1.4},
            {"text": " I led the migration.", "no_speech_prob": 0.05, "avg_logprob": -0.2}]
    recogniser = fake_mlx(monkeypatch, " Hmm. I led the migration.", segs)
    assert recogniser.transcribe(pcm(2.5, 0.2), False).text == "I led the migration."
    only = fake_mlx(monkeypatch, " Hmm.", segs[:1])
    assert only.transcribe(pcm(2.5, 0.2), False).text == ""


def test_the_log_never_holds_the_dropped_words(monkeypatch, caplog):
    segs = [{"text": " Thank you.", "no_speech_prob": 0.1, "avg_logprob": -0.3}]
    with caplog.at_level("INFO", logger="uvicorn.error"):
        fake_mlx(monkeypatch, " Thank you.", segs).transcribe(bytes(32000), False)
    assert "no speech" in caplog.text and "Thank" not in caplog.text


# ---------- Mike's echo ----------

def test_echo_of_mikes_last_words():
    said = "Okay. Thank you. Tell me about a project you owned."
    assert echo_of("Thank you.", said)
    assert echo_of("tell me about a project", said)
    assert echo_of("Tell me about a project you", said)
    assert not echo_of("Yes.", said)                                       # one word is never taken for an echo
    assert not echo_of("I owned a project about payments", said)
    assert not echo_of("project owned a tell", said)                       # his words, but not in his order
    assert not echo_of("Tell me about a project you owned and then we shipped it", said)   # too long to be an echo


# ---------- the driver ----------

class SlowLLM(FakeLLM):
    """Mike's model is still writing until `release` is set (the gap in which a phantom turn opens)."""

    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.release = asyncio.Event()

    async def chat_stream(self, messages, **kw):
        await self.release.wait()
        async for piece in super().chat_stream(messages, **kw):
            yield piece


class HeardSTT:
    available = True

    def __init__(self, text):
        self.text = text

    def transcribe(self, pcm_bytes, words=True):
        return Transcript(text=self.text, duration_s=2.0, backend="fake")

    def transcribe_if_idle(self, pcm_bytes):
        return None


class Rig:
    def __init__(self, heard, **kw):
        self.log = []
        self.llm = SlowLLM({"p1": REPLY})
        self.driver = TextDriver(
            self.llm, plan=PLAN, speak=False, stt=HeardSTT(heard),
            on_turn_complete=lambda s, t, m=None: self.log.append((s, t)),
            on_transcript_delta=lambda s, d, full: self.log.append(("delta", d)),
            on_interrupted=lambda turn=None: self.log.append(("interrupted", turn)),
            on_notice=lambda code, text: self.log.append(("notice", code)),
            on_voice_dropped=lambda turn: self.log.append(("dropped", turn)), **kw)

    async def answer_and_wait_for_reply(self):
        """The user's answer is in and Mike's reply is being written (the model is blocked)."""
        await self.driver.handle_user_text_turn(LONG)
        await asyncio.sleep(0.02)
        assert self.driver.replying()

    async def voice_turn(self, turn=2):
        await self.driver.begin_audio_turn(turn)
        self.driver._buffer.extend(pcm(1.0, 0.05))
        await self.driver.end_audio_stream(turn_id=turn)

    async def settle(self):
        self.llm.release.set()
        for _ in range(200):
            if not self.driver.replying():
                return
            await asyncio.sleep(0.01)

    def kinds(self):
        return [kind for kind, _ in self.log]

    def users(self):
        return [t for t in self.driver.transcript_history if t["role"] == "user"]

    def mike_lines(self):
        return [t["text"] for t in self.driver.transcript_history if t["role"] == "model"]


async def test_a_phantom_turn_while_mike_is_thinking_costs_him_nothing():
    rig = Rig("")                                          # the recogniser found no speech in the clip
    await rig.answer_and_wait_for_reply()
    await rig.driver.begin_audio_turn()
    assert rig.driver.replying() and "interrupted" not in rig.kinds()        # not a barge-in yet
    rig.llm.release.set()
    await asyncio.sleep(0.05)
    assert "delta" not in rig.kinds()                      # but he says nothing until the verdict
    rig.driver._buffer.extend(pcm(0.6, 0.02))
    await rig.driver.end_audio_stream(turn_id=2)
    await rig.settle()
    assert rig.kinds().count("dropped") == 1
    assert "interrupted" not in rig.kinds() and "notice" not in rig.kinds()
    assert len(rig.users()) == 1                           # the phantom is not an answer
    assert rig.mike_lines()[-1] == "What was the result?"  # and Mike's reply to the real answer arrived
    assert ("model", "What was the result?") in rig.log


async def test_a_real_voice_turn_still_cancels_the_reply_and_becomes_the_answer():
    second = "We cut the checkout time in half and the team kept the new flow after the launch."
    rig = Rig(second)
    await rig.answer_and_wait_for_reply()
    await rig.voice_turn()
    assert rig.kinds().count("interrupted") == 1 and "dropped" not in rig.kinds()
    assert [u["text"] for u in rig.users()] == [LONG, second]
    await rig.settle()
    assert rig.mike_lines() == ["What was the result?"]    # one reply, to the answer that was heard last
    assert rig.llm.calls[-1]["messages"][-1]["content"].count(second) == 1


async def test_a_voice_turn_pauses_the_audio_too(monkeypatch):
    """Mike's words are written and his audio is flowing: it stops at once and goes on after a phantom."""
    chunks = []
    rig = Rig("", on_audio_chunk=chunks.append)
    rig.driver.speak = True
    monkeypatch.setattr(tts, "synthesize_pcm", lambda *a, **k: bytes(tts.CHUNK_BYTES * 3))
    deliver = asyncio.create_task(rig.driver._deliver(rig.driver._from_list(["Okay.", "Tell me more."]),
                                                      lambda: {"kind": "turn"}))
    await rig.driver.begin_audio_turn()
    await asyncio.sleep(0.1)
    sent = len(chunks)
    assert sent < 6 and not deliver.done()                 # nothing more leaves while the clip is unknown
    await asyncio.sleep(0.1)
    assert len(chunks) == sent
    rig.driver._buffer.extend(pcm(0.6, 0.02))
    await rig.driver.end_audio_stream(turn_id=1)
    await asyncio.wait_for(deliver, 2)
    assert len(chunks) == 6 and rig.kinds().count("dropped") == 1


async def test_nothing_heard_with_no_reply_running_asks_again():
    rig = Rig("")
    await rig.voice_turn()
    assert rig.kinds() == ["dropped", "notice"]            # the user is expected to answer: "I didn't catch that"


async def test_no_notice_while_mikes_audio_is_still_playing():
    rig = Rig("")
    rig.driver._audio_until = 10 ** 9                      # the client is still playing his last line
    await rig.voice_turn()
    assert rig.kinds() == ["dropped"]


async def test_mikes_echo_is_dropped_like_noise():
    rig = Rig("Thank you.", mode="interview")
    rig.driver.produces_audio = True
    rig.driver._said, rig.driver._said_at = "Okay. Thank you. What was the result?", time.monotonic()
    await rig.voice_turn()
    assert rig.users() == [] and rig.kinds().count("dropped") == 1


async def test_the_same_words_long_after_his_line_are_an_answer():
    rig = Rig("Thank you.")
    rig.driver.produces_audio = True
    rig.driver._said, rig.driver._said_at = "Okay. Thank you. What was the result?", 1.0
    await rig.voice_turn()
    assert [u["text"] for u in rig.users()] == ["Thank you."]


async def test_a_dropped_turn_does_not_trigger_the_take_your_time_logic():
    rig = Rig("")
    await rig.driver.handle_user_text_turn(LONG)
    await rig.settle()
    before = len(rig.llm.calls), rig.driver._repeat_offered
    await rig.voice_turn()
    assert (len(rig.llm.calls), rig.driver._repeat_offered) == before
    assert not any("Take your time" in line for line in rig.mike_lines())


async def test_browser_recognition_that_heard_nothing_resumes_mike():
    rig = Rig("")
    await rig.answer_and_wait_for_reply()
    await rig.driver.begin_audio_turn()
    await rig.driver.cancel_audio_turn()
    await rig.settle()
    assert rig.kinds().count("dropped") == 1 and rig.mike_lines()[-1] == "What was the result?"


async def test_stt_failure_resumes_mike_too():
    rig = Rig("")
    errors = []
    rig.driver.on_error = lambda *a: errors.append(a[0])

    def broken(pcm_bytes, words=True):
        raise RuntimeError("boom")
    rig.driver.stt.transcribe = broken
    await rig.answer_and_wait_for_reply()
    await rig.voice_turn()
    await rig.settle()
    assert errors == ["stt_failed"] and rig.kinds().count("dropped") == 1
    assert rig.mike_lines()[-1] == "What was the result?"


def test_module_exports_silence_phrases_in_lower_case():
    assert all(p == p.lower() for p in stt_module.SILENCE_PHRASES)


async def test_the_interrupt_button_stops_mike_at_once_even_if_nothing_is_said():
    rig = Rig("")
    await rig.answer_and_wait_for_reply()
    await rig.driver.begin_audio_turn(manual=True)
    assert not rig.driver.replying() and rig.kinds().count("interrupted") == 1
    await rig.driver.end_audio_stream(turn_id=2)
    assert rig.kinds().count("dropped") == 1 and rig.kinds().count("notice") == 1    # "I didn't catch that"
    assert rig.mike_lines() == []                                                    # and he does not carry on


# ---------- one verdict per voice turn ----------

async def test_overlapping_turns_each_get_one_verdict_and_mike_waits_for_the_last():
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    await rig.driver.begin_audio_turn(2)
    assert not rig.driver._flow.is_set()
    await rig.driver.cancel_audio_turn(1)                  # A is noise while B is still open
    assert rig.log == [("dropped", 1)] and not rig.driver._flow.is_set()
    await rig.driver.cancel_audio_turn(1)                  # a second verdict for A is never sent
    assert rig.log == [("dropped", 1)]
    await rig.driver.cancel_audio_turn(2)
    assert rig.log == [("dropped", 1), ("dropped", 2)] and rig.driver._flow.is_set()


async def test_a_dropped_turn_never_frees_mike_while_a_newer_one_is_in_recognition():
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    rig.driver._buffer.extend(pcm(1.0, 0.05))
    await rig.driver.end_audio_stream(turn_id=1)           # A: no speech
    await rig.driver.begin_audio_turn(2)
    assert rig.log[:1] == [("dropped", 1)] and not rig.driver._flow.is_set()
    await rig.driver.end_audio_stream(turn_id=2)
    assert rig.log.count(("dropped", 2)) == 1 and rig.driver._flow.is_set()


async def test_speech_in_an_old_turn_settles_only_that_turn():
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    await rig.driver.begin_audio_turn(2)
    await rig.driver.handle_user_text_turn(LONG, None, 1)
    assert ("interrupted", 1) in rig.log and not rig.driver._flow.is_set()      # B is still open
    await rig.driver.cancel_audio_turn(2)
    assert ("dropped", 2) in rig.log and rig.driver._flow.is_set()
    await rig.settle()


async def test_typed_text_settles_every_open_voice_turn():
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    await rig.driver.begin_audio_turn(2)
    await rig.driver.handle_user_text_turn(LONG, None, 3)
    assert ("interrupted", None) in rig.log and rig.driver._flow.is_set()
    await rig.settle()


async def test_stopping_the_session_frees_the_flow():
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    rig.driver.stop()
    assert rig.driver._flow.is_set() and not rig.driver._turns


async def test_the_interrupt_button_settles_the_older_turns_and_opens_its_own():
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    await rig.driver.begin_audio_turn(2, manual=True)
    assert ("interrupted", None) in rig.log and rig.driver._turns == [2]
    await rig.driver.cancel_audio_turn(2)
    assert rig.driver._flow.is_set()


# ---------- safety nets ----------

async def test_mike_goes_on_when_no_verdict_comes(monkeypatch, caplog):
    monkeypatch.setattr("server.session.FLOW_MAX_S", 0.05)
    monkeypatch.setattr("server.session.FLOW_POLL_S", 0.02)
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)
    rig.driver._recording = False                          # the user stopped; recognition never answers
    rig.driver._quiet_since = time.monotonic()
    with caplog.at_level("INFO", logger="uvicorn.error"):
        await asyncio.wait_for(rig.driver._may_speak(), 2)
    assert rig.log == [("dropped", 1)] and rig.driver._flow.is_set()
    assert caplog.text.count("No verdict") == 1


async def test_mike_keeps_waiting_while_the_user_is_still_talking(monkeypatch):
    monkeypatch.setattr("server.session.FLOW_MAX_S", 0.05)
    monkeypatch.setattr("server.session.FLOW_POLL_S", 0.02)
    rig = Rig("")
    await rig.driver.begin_audio_turn(1)                   # recording: a long answer is not a missing verdict
    waiting = asyncio.create_task(rig.driver._may_speak())
    await asyncio.sleep(0.2)
    assert not waiting.done() and rig.log == []
    await rig.driver.cancel_audio_turn(1)
    await asyncio.wait_for(waiting, 1)


async def test_a_long_noisy_turn_is_dropped_when_the_captions_stay_empty(monkeypatch):
    monkeypatch.setattr("server.session.PREVIEW_EMPTY_RESUME", 2)
    monkeypatch.setattr("server.session.NOISE_TURN_MIN_S", 1)
    previews, noise = [], []
    rig = Rig("", on_preview=previews.append, on_voice_noise=noise.append)
    rig.driver.stt.transcribe_if_idle = lambda pcm_bytes: Transcript(text="", duration_s=1.0, backend="fake")
    await rig.driver.begin_audio_turn(1)
    for _ in range(40):                                    # the noise goes on: the buffer keeps growing
        rig.driver._buffer.extend(pcm(1.0, 0.05))
        if rig.driver._flow.is_set():
            break
        await asyncio.sleep(0.5)
    assert noise == [1] and previews == [] and rig.log == []          # a hint: the turn is still open ...
    assert rig.driver._turns == [1]
    rig.driver._recording = False
    await rig.driver.cancel_audio_turn(1)
    assert rig.log == [("dropped", 1)] and noise == [1]                # ... and still gets its one verdict
    rig.driver.stop()


async def test_a_cancelled_reply_leaves_no_pending_wait_task_behind():
    """The "Task was destroyed but it is pending ... Event.wait()" warning of the live test."""
    rig = Rig("")
    rig.driver.speak = True

    async def stuck(speech, heard=None):
        await asyncio.sleep(3600)
    rig.driver._voice_worker = stuck
    before = set(asyncio.all_tasks())
    deliver = asyncio.create_task(rig.driver._deliver(rig.driver._from_list(["Okay."]), lambda: {"kind": "turn"}))
    await asyncio.sleep(0.05)                              # inside the wait for the first audio
    deliver.cancel()
    await asyncio.gather(deliver, return_exceptions=True)
    await asyncio.sleep(0)
    assert [t for t in asyncio.all_tasks() - before if not t.done()] == []
