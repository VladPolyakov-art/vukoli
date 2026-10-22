#!/usr/bin/env python3
"""Voice latency benchmark: end of the user's speech -> Mike's first audio, on a real local stack.

Starts the server in a subprocess with a throwaway data folder, plays pre-synthesised spoken answers into
/ws/session in real time (16 kHz PCM, like the browser), waits for Mike's audio to "play" before the next
answer (so feedback runs in the background exactly as in a real session), and reports per turn:
  stt      server speech recognition time (turn_metrics.stt_ms)
  reply    server time from the user's text to Mike's first audio (turn_metrics.first_audio_ms)
  e2e      client time from `audio_stream_end` to the first audio frame (what the user waits)

Needs Ollama with the model, a speech recogniser (mlx-whisper or faster-whisper) and the Kokoro files
(KOKORO_MODEL_DIR or --kokoro-dir). Nothing is written to the user's data folder.

Usage:
  python scripts/bench_latency.py --model qwen3:8b [--turns 6] [--server-dir .] [--out results.json]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import socket
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

# Spoken answers (synthetic, no personal data). Mixed lengths: short follow-up answers are where the
# interviewer reply competes with feedback for the single local model.
ANSWERS = [
    "In my last role I worked on the checkout team. A lot of people left on the payment page, so I ran five "
    "user interviews, found that the address form confused them, and redesigned it with two developers over "
    "two sprints.",
    "The drop-off went down by about twelve percent in the first month after the release.",
    "I was responsible for the research and the prototypes. The engineers built it, and the product manager "
    "planned the rollout with the support team.",
    "I would test the copy earlier, before we built anything.",
    "I want this role because I like working close to customers. In my current job I spend half of my week in "
    "research sessions, and I would like to bring that habit to a bigger product.",
    "We shipped it on time, and support tickets about payments went down a lot.",
    "My manager said my updates were too long, so I started sending three bullet points every Friday instead.",
    "I listened first, then I asked both designers to show their options to five users, and we picked the one "
    "that tested better.",
]
FRAME = 3200          # 0.1 s of 16 kHz int16 mono


def unload_other_models(keep: str, url: str = "http://127.0.0.1:11434") -> list[str]:
    """Two resident models on a 16 GB Mac push Whisper and Kokoro into swap and ruin the numbers."""
    import httpx
    gone = []
    for m in httpx.get(f"{url}/api/ps", timeout=10).json().get("models", []):
        if m["name"] != keep:
            httpx.post(f"{url}/api/generate", json={"model": m["name"], "keep_alive": 0}, timeout=60)
            gone.append(m["name"])
    return gone


def swap_used_mb() -> float | None:
    try:
        out = subprocess.run(["sysctl", "-n", "vm.swapusage"], capture_output=True, text=True).stdout
        return float(out.split("used = ")[1].split("M")[0])
    except Exception:
        return None


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def synth_answers(kokoro_dir: Path, cache: Path) -> list[bytes]:
    """Kokoro (a different voice than Mike) -> 16 kHz int16 PCM with short silences around it."""
    cache.mkdir(parents=True, exist_ok=True)
    out = []
    kokoro = None
    for i, text in enumerate(ANSWERS):
        path = cache / f"answer{i}.pcm"
        if not path.exists():
            if kokoro is None:
                from kokoro_onnx import Kokoro
                kokoro = Kokoro(str(kokoro_dir / "kokoro-v1.0.onnx"), str(kokoro_dir / "voices-v1.0.bin"))
            samples, rate = kokoro.create(text, voice="af_heart", speed=1.0, lang="en-us")
            n = int(len(samples) * 16000 / rate)
            pcm = np.interp(np.linspace(0, len(samples) - 1, n), np.arange(len(samples)), samples)
            pad = np.zeros(8000)
            pcm = np.concatenate([pad, pcm, pad])
            path.write_bytes((np.clip(pcm, -1, 1) * 32767).astype("<i2").tobytes())
        out.append(path.read_bytes())
    return out


async def wait_http(port: int, timeout: float = 60) -> None:
    import httpx
    end = time.time() + timeout
    async with httpx.AsyncClient() as client:
        while time.time() < end:
            try:
                if (await client.get(f"http://127.0.0.1:{port}/api/health")).status_code < 500:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.3)
    raise RuntimeError("server did not start")


async def run_session(port: int, answers: list[bytes], turns: int, questions: int, think_s: float) -> dict:
    from websockets.asyncio.client import connect
    rows: list[dict] = []
    log: list[dict] = []
    async with connect(f"ws://127.0.0.1:{port}/ws/session", max_size=4_000_000) as ws:
        await ws.send(json.dumps({"type": "start", "mode": "interview", "round_type": "mix", "questions": questions,
                                  "strictness": 2, "input": "voice", "speak": True, "engine": "ollama"}))
        state = {"audio_bytes": 0, "first_audio": None, "first_delta": None, "transcript": None,
                 "metrics": None, "complete": False, "model_turns": [], "feedback_done": set(), "errors": []}
        t0 = time.perf_counter()

        async def receive() -> None:
            async for msg in ws:
                now = time.perf_counter()
                if isinstance(msg, bytes):
                    state["audio_bytes"] += len(msg)
                    if state["first_audio"] is None:
                        state["first_audio"] = now
                    continue
                data = json.loads(msg)
                kind = data.get("type")
                log.append({"t": round(now - t0, 3), **{k: v for k, v in data.items() if k not in ("questions",)}})
                if kind == "transcript_delta" and data.get("speaker") == "model" and state["first_delta"] is None:
                    state["first_delta"] = now
                elif kind == "user_transcript":
                    state["transcript"] = now
                elif kind == "turn_metrics":
                    state["metrics"] = data
                elif kind == "turn_complete" and data.get("speaker") == "model":
                    state["model_turns"].append(data)
                elif kind == "response_complete":
                    state["complete"] = True
                elif kind == "feedback" and data["feedback"].get("complete"):
                    state["feedback_done"].add(data["feedback"]["id"])
                elif kind == "error":
                    state["errors"].append(data.get("code"))
                elif kind == "debrief":
                    return

        reader = asyncio.create_task(receive())

        async def wait_reply(limit: float = 90) -> None:
            end = time.perf_counter() + limit
            while not state["complete"] and time.perf_counter() < end:
                await asyncio.sleep(0.02)

        def reset() -> None:
            state.update(first_audio=None, first_delta=None, transcript=None, metrics=None, complete=False,
                         audio_bytes=0)

        await wait_reply()                     # the opening line
        for turn in range(turns):
            playback = state["audio_bytes"] / (24000 * 2)
            started = state["first_audio"] or time.perf_counter()
            await asyncio.sleep(max(0.0, started + playback - time.perf_counter()) + think_s)
            pcm = answers[turn % len(answers)]
            reset()
            await ws.send(json.dumps({"type": "activity_start", "turn_id": turn + 1}))
            for i in range(0, len(pcm), FRAME):          # real time, like a microphone
                await ws.send(pcm[i:i + FRAME])
                await asyncio.sleep(FRAME / 32000)
            t_end = time.perf_counter()
            await ws.send(json.dumps({"type": "audio_stream_end"}))
            await wait_reply()
            m = state["metrics"] or {}
            last = state["model_turns"][-1] if state["model_turns"] else {}
            ms = lambda t: round((t - t_end) * 1000) if t else None   # noqa: E731
            rows.append({"turn": turn + 1, "answer_s": round(len(pcm) / 32000, 1), "stt_ms": m.get("stt_ms"),
                         "reply_first_audio_ms": m.get("first_audio_ms"), "reply_first_text_ms": m.get("first_text_ms"),
                         "e2e_transcript_ms": ms(state["transcript"]), "e2e_first_text_ms": ms(state["first_delta"]),
                         "e2e_first_audio_ms": ms(state["first_audio"]), "path": m.get("path"),
                         "kind": last.get("kind"), "question_id": last.get("question_id"),
                         "mike": last.get("full_text", "")})
            print(json.dumps(rows[-1]), flush=True)
        playback = state["audio_bytes"] / (24000 * 2)
        await asyncio.sleep(playback + 1)
        await ws.send(json.dumps({"type": "end_session"}))
        try:
            await asyncio.wait_for(reader, timeout=240)
        except asyncio.TimeoutError:
            reader.cancel()
        return {"rows": rows, "feedback_complete": len(state["feedback_done"]), "errors": state["errors"],
                "log": log}


def summarize(rows: list[dict]) -> dict:
    def med(key: str):
        vals = [r[key] for r in rows if r.get(key) is not None]
        return round(statistics.median(vals)) if vals else None

    def p90(key: str):
        vals = sorted(r[key] for r in rows if r.get(key) is not None)
        return vals[min(len(vals) - 1, int(round(0.9 * (len(vals) - 1))))] if vals else None
    model_rows = [r for r in rows if r.get("path") == "model"]
    return {"turns": len(rows), "model_turns": len(model_rows),
            "stt_ms_median": med("stt_ms"),
            "e2e_first_audio_ms_median": med("e2e_first_audio_ms"), "e2e_first_audio_ms_p90": p90("e2e_first_audio_ms"),
            "reply_first_audio_ms_median": med("reply_first_audio_ms"),
            "e2e_model_turns_median": (round(statistics.median([r["e2e_first_audio_ms"] for r in model_rows
                                                                if r["e2e_first_audio_ms"] is not None]))
                                       if model_rows else None)}


async def main() -> None:
    here = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="qwen3:8b")
    ap.add_argument("--turns", type=int, default=6)
    ap.add_argument("--questions", type=int, default=3)
    ap.add_argument("--think", type=float, default=1.0, help="seconds between Mike's audio and the next answer")
    ap.add_argument("--server-dir", default=str(here), help="app/server folder to run (e.g. a baseline copy)")
    ap.add_argument("--kokoro-dir", default=os.getenv("KOKORO_MODEL_DIR", ""))
    ap.add_argument("--cache", default=str(Path(tempfile.gettempdir()) / "ic-bench-audio"))
    ap.add_argument("--out", default="")
    ap.add_argument("--keep-other-models", action="store_true", help="do not unload other Ollama models first")
    args = ap.parse_args()
    if not args.kokoro_dir:
        sys.exit("Set --kokoro-dir or KOKORO_MODEL_DIR to the folder with kokoro-v1.0.onnx and voices-v1.0.bin")
    answers = synth_answers(Path(args.kokoro_dir), Path(args.cache))
    unloaded = [] if args.keep_other_models else unload_other_models(args.model)
    swap_before = swap_used_mb()
    port = free_port()
    with tempfile.TemporaryDirectory() as data:
        Path(data, "settings.json").write_text(json.dumps({"engine": "ollama", "ollama": {"model": args.model},
                                                           "telemetry_opt_in": False}))
        env = {**os.environ, "IC_DATA_DIR": data, "KOKORO_MODEL_DIR": args.kokoro_dir, "IC_PORT": str(port)}
        proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "server.main:app", "--port", str(port),
                                 "--log-level", "warning"], cwd=args.server_dir, env=env)
        try:
            await wait_http(port)
            result = await run_session(port, answers, args.turns, args.questions, args.think)
        finally:
            proc.terminate()
            proc.wait(timeout=20)
    result["summary"] = summarize(result["rows"])
    result["model"] = args.model
    result["server_dir"] = args.server_dir
    result["unloaded_models"] = unloaded
    result["swap_used_mb"] = {"before": swap_before, "after": swap_used_mb()}
    result["summary"]["swap_used_mb"] = result["swap_used_mb"]
    print(json.dumps(result["summary"], indent=1))
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
