"""Latency plan (D33): the model gate gives Mike priority over background calls, and speech is recognised
in two passes (text first, word timings in the background)."""
from __future__ import annotations

import asyncio

from server.content import Question
from server.priority import ModelGate
from server.session import TextDriver
from server.stt import Transcript, Word

PLAN = [Question("A1", "A", "Why this role?", {"RN": "What was the result?"}),
        Question("B1", "B", "Tell me about a project you owned.", {"RN": "The result?"})]
SAID = "I worked on the payments team and we shipped a new checkout flow last spring."


async def test_gate_runs_background_after_mike_and_restarts_preempted_jobs():
    gate = ModelGate()
    runs = []

    async def job():
        runs.append("start")
        await asyncio.sleep(0.05)
        runs.append("done")
        return "ok"
    gate.hold()
    task = asyncio.create_task(gate.background(job))
    await asyncio.sleep(0.02)
    assert runs == []                                   # waits while Mike holds the model
    gate.release()
    await asyncio.sleep(0.01)
    gate.hold()                                         # Mike needs the model again: the job is cancelled
    await asyncio.sleep(0.08)
    assert runs == ["start"] and gate.preemptions == 1
    gate.release()
    assert await task == "ok" and runs == ["start", "start", "done"]


async def test_gate_never_starves_and_is_a_no_op_when_disabled():
    gate = ModelGate(max_preemptions=0)

    async def job():
        await asyncio.sleep(0.03)
        return 1
    task = asyncio.create_task(gate.background(job))
    await asyncio.sleep(0.01)
    gate.hold()                                         # no restarts left: the job finishes
    assert await task == 1
    off = ModelGate(enabled=False)
    off.hold()
    assert await off.background(job) == 1


class FakeSTT:
    available = True

    def __init__(self):
        self.calls = []

    def transcribe(self, pcm, words=True):
        self.calls.append(words)
        ws = [Word(w, i * 0.4, i * 0.4 + 0.3, 0.3 if w == "checkout" else 0.9) for i, w in enumerate(SAID.split())]
        return Transcript(text=SAID, words=ws if words else [], duration_s=6.0, backend="fake")

    def transcribe_if_idle(self, pcm):
        return None


async def test_voice_turn_replies_from_text_then_adds_word_timings(fake_llm):
    llm = fake_llm({"p1": {"gap": "result", "action": "follow_up", "say": "What was the result?"}})
    gate = ModelGate()
    stt = FakeSTT()
    seen, held_during_reply = [], []
    d = TextDriver(llm, plan=PLAN, speak=False, stt=stt, gate=gate,
                   on_user_transcript=lambda t, turn: seen.append([w.w for w in t.low_confidence()]),
                   on_turn_start=lambda speaker: held_during_reply.append(gate.busy))
    await d.begin_audio_turn()
    d._buffer.extend(b"\0\0" * 16000)
    await d.end_audio_stream(turn_id=1)
    transcript = None
    for _ in range(200):
        if len(seen) == 2:
            break
        await asyncio.sleep(0.01)
    assert stt.calls == [False, True]                   # text pass on the critical path, then the word pass
    assert held_during_reply == [True]                  # Mike held the model while replying
    assert seen == [[], ["checkout"]]                   # transcript re-sent once confidence is known
    assert not gate.busy
    transcript = d.transcript_history[0]
    assert transcript["text"] == SAID


async def test_background_jobs_wait_for_mikes_first_audio(fake_llm, monkeypatch):
    """Speech synthesis shares the machine with feedback: the gate opens only once Mike is audible."""
    import time

    from server import tts

    def slow_tts(sentence, voice, speed, settings):
        time.sleep(0.05)
        return b"\0\0" * 2400
    monkeypatch.setattr(tts, "synthesize_pcm", slow_tts)
    monkeypatch.setattr(tts, "kokoro_model", lambda settings: object())
    llm = fake_llm({"p1": {"gap": "result", "action": "follow_up", "say": "What was the result?"}})
    gate = ModelGate()
    audio_when_released = []
    d = TextDriver(llm, plan=PLAN, speak=True, gate=gate, on_audio_chunk=lambda chunk: None)
    real_release = gate.release

    def release():
        audio_when_released.append("first_audio_ms" in d._metrics)
        real_release()
    gate.release = release
    await d.handle_user_text_turn(SAID)
    for _ in range(200):
        if d._reply_task is None or d._reply_task.done():
            break
        await asyncio.sleep(0.01)
    assert audio_when_released and audio_when_released[0] and not gate.busy
