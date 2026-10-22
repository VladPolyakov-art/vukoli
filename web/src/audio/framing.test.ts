import { describe, expect, it } from "vitest";
import { chunkPcm, durationSeconds, float32ToPcm16, MAX_FRAME_BYTES, pcm16ToFloat32, rmsPcm16 } from "./framing";
import { VadMachine } from "./vad";

describe("PCM framing", () => {
  it("round-trips float <-> PCM16 with clipping", () => {
    const pcm = float32ToPcm16(new Float32Array([0, 0.5, -0.5, 1.5, -2]));
    expect(Array.from(pcm)).toEqual([0, 16384, -16384, 32767, -32768]);
    const back = pcm16ToFloat32(pcm.buffer);
    expect(back[1]).toBeCloseTo(0.5, 3);
    expect(back[4]).toBe(-1);
  });

  it("ignores an odd trailing byte when decoding", () => {
    expect(pcm16ToFloat32(new ArrayBuffer(5)).length).toBe(2);
  });

  it("computes RMS", () => {
    expect(rmsPcm16(new Int16Array(0))).toBe(0);
    expect(rmsPcm16(new Int16Array([16384, -16384]))).toBeCloseTo(0.5, 5);
  });

  it("chunks into even frames no larger than the server limit", () => {
    const frames = chunkPcm(new ArrayBuffer(MAX_FRAME_BYTES * 2 + 11));
    expect(frames.map((f) => f.byteLength)).toEqual([MAX_FRAME_BYTES, MAX_FRAME_BYTES, 10]);
    expect(chunkPcm(new ArrayBuffer(7), 5).map((f) => f.byteLength)).toEqual([4, 2]);
    frames.forEach((f) => expect(f.byteLength % 2).toBe(0));
  });

  it("computes durations for 16 and 24 kHz", () => {
    expect(durationSeconds(9600, 24000)).toBeCloseTo(0.2);
    expect(durationSeconds(1024, 16000)).toBeCloseTo(0.032);
  });
});

const frame = () => new ArrayBuffer(1024);
const LOUD = 0.05;
const QUIET = 0.001;

describe("VadMachine", () => {
  it("starts after 3 loud frames and sends the pre-roll with the start", () => {
    const vad = new VadMachine(1000);
    const out = [QUIET, QUIET, LOUD, LOUD, LOUD].flatMap((rms, i) => vad.feed({ buffer: frame(), rms, now: i * 32, echoRisk: false }));
    const start = out.find((e) => e.type === "start");
    expect(start && start.type === "start" && start.preRoll.length).toBe(5);
    expect(vad.recording).toBe(true);
  });

  it("needs 6 frames and a higher level while Mike is audible (echo guard)", () => {
    const vad = new VadMachine(1000);
    const mid = 0.009; // above the base threshold, below the echo one
    for (let i = 0; i < 10; i++) vad.feed({ buffer: frame(), rms: mid, now: i * 32, echoRisk: true });
    expect(vad.recording).toBe(false);
    for (let i = 0; i < 5; i++) vad.feed({ buffer: frame(), rms: LOUD, now: 400 + i * 32, echoRisk: true });
    expect(vad.recording).toBe(false);
    vad.feed({ buffer: frame(), rms: LOUD, now: 600, echoRisk: true });
    expect(vad.recording).toBe(true);
  });

  it("commits after the pause, then waits for quiet before the next turn", () => {
    const vad = new VadMachine(500);
    vad.begin(0);
    vad.feed({ buffer: frame(), rms: LOUD, now: 10, echoRisk: false });
    expect(vad.feed({ buffer: frame(), rms: QUIET, now: 400, echoRisk: false }).some((e) => e.type === "commit")).toBe(false);
    expect(vad.feed({ buffer: frame(), rms: QUIET, now: 600, echoRisk: false }).some((e) => e.type === "commit")).toBe(true);
    vad.finish();
    for (let i = 0; i < 5; i++) vad.feed({ buffer: frame(), rms: LOUD, now: 700 + i, echoRisk: false });
    expect(vad.recording).toBe(false);
  });

  it("never auto-commits in manual mode and never sends while muted", () => {
    const vad = new VadMachine(0);
    vad.begin(0);
    vad.feed({ buffer: frame(), rms: LOUD, now: 10, echoRisk: false });
    expect(vad.feed({ buffer: frame(), rms: QUIET, now: 60_000, echoRisk: false }).some((e) => e.type === "commit")).toBe(false);
    expect(vad.commit()).toBe(true);
    const muted = new VadMachine(500);
    muted.muted = true;
    const events = Array.from({ length: 8 }, (_, i) => muted.feed({ buffer: frame(), rms: LOUD, now: i * 32, echoRisk: false })).flat();
    expect(events.map((e) => e.type)).toEqual(["muted_speech"]);
  });
});
