/* Playback.hold / resume / stop: Mike's audio is held back while the server decides whether a voice turn was speech. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { OUT_RATE } from "./framing";
import { HOLD_NO_VERDICT_MS, Playback } from "./playback";

/** A frame of `seconds` of audio, as the server sends it (24 kHz PCM16). */
const frame = (seconds: number) => new ArrayBuffer(Math.round(OUT_RATE * seconds) * 2);

class FakeSource {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  started: { when: number; offset: number } | null = null;
  stopped = false;
  connect() {}
  disconnect() {}
  start(when: number, offset = 0) { this.started = { when, offset }; }
  stop() { this.stopped = true; }
}

function setup() {
  const sources: FakeSource[] = [];
  const context = {
    currentTime: 0,
    state: "running",
    createBuffer: (_c: number, length: number, rate: number) => ({ duration: length / rate, copyToChannel() {} }),
    createBufferSource: () => { const s = new FakeSource(); sources.push(s); return s; },
    destination: {},
  };
  const playback = new Playback(context as unknown as AudioContext);
  return { context, playback, sources };
}

describe("Playback hold", () => {
  it("parks what has not played yet and plays it on after resume, in order", () => {
    const { context, playback, sources } = setup();
    playback.enqueue(frame(1));
    playback.enqueue(frame(1));
    expect(playback.playing).toBe(true);
    context.currentTime = 1.325;                    // the first frame (starts at 0.025) has played, the second is 0.3 s in
    playback.hold(1);
    expect(playback.playing).toBe(false);
    expect(sources.every((s) => s.stopped)).toBe(true);
    playback.enqueue(frame(0.5));                   // arrives while held
    expect(sources).toHaveLength(2);
    playback.release(1);
    expect(sources).toHaveLength(4);
    const [, , rest, late] = sources;
    expect(rest!.started!.offset).toBeCloseTo(0.3, 2);          // the second frame goes on from where it stopped
    expect(late!.started!.offset).toBe(0);
    expect(late!.started!.when).toBeGreaterThan(rest!.started!.when);
    expect(playback.playing).toBe(true);
  });

  it("drops a frame that had already played completely", () => {
    const { context, playback, sources } = setup();
    playback.enqueue(frame(1));
    context.currentTime = 2;
    playback.hold(1);
    playback.release(1);
    expect(sources).toHaveLength(1);
  });

  it("stop() discards everything held, also what arrives later in the same turn", () => {
    const { playback, sources } = setup();
    playback.enqueue(frame(1));
    playback.hold(1);
    playback.enqueue(frame(1));
    expect(playback.hasHeldAudio).toBe(true);
    playback.stop();
    playback.release(1);
    expect(sources).toHaveLength(1);
    expect(playback.holding).toBe(false);
    playback.enqueue(frame(1));                     // a new Mike turn plays normally again
    expect(sources).toHaveLength(2);
    expect(playback.playing).toBe(true);
  });

  it("holding with nothing to play has no held audio and resume is harmless", () => {
    const { playback, sources } = setup();
    playback.hold(1);
    expect(playback.holding).toBe(true);
    expect(playback.hasHeldAudio).toBe(false);
    playback.release(1);
    expect(sources).toHaveLength(0);
  });
});

describe("Playback holds are kept per voice turn", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("a verdict for turn A does not free Mike while turn B is still open; B's verdict does", () => {
    const { playback, sources } = setup();
    playback.enqueue(frame(1));
    playback.hold(1);
    playback.hold(2);
    playback.enqueue(frame(1));
    playback.release(1);                                    // A was noise, B is still being recognised
    expect(playback.holding).toBe(true);
    expect(sources).toHaveLength(1);
    playback.release(1);                                    // a second verdict for A changes nothing
    expect(playback.holding).toBe(true);
    playback.release(2);
    expect(playback.holding).toBe(false);
    expect(sources).toHaveLength(3);                        // the parked rest and the frame that waited
  });

  it("a stale release does not free a turn it does not belong to", () => {
    const { playback } = setup();
    playback.hold(5);
    playback.release(4);
    expect(playback.holding).toBe(true);
  });

  it("speech in turn A discards Mike's audio; B keeps holding what comes next", () => {
    const { playback, sources } = setup();
    playback.enqueue(frame(1));
    playback.hold(1);
    playback.hold(2);
    playback.cutOff(1);
    expect(playback.hasHeldAudio).toBe(false);
    expect(playback.holding).toBe(true);
    playback.enqueue(frame(1));                             // the new reply waits for B's verdict
    expect(sources).toHaveLength(1);
    playback.release(2);
    expect(sources).toHaveLength(2);
  });

  it("cutOff() and stop() without a turn settle everything", () => {
    const { playback } = setup();
    playback.hold(1);
    playback.hold(2);
    playback.cutOff();
    expect(playback.holding).toBe(false);
    playback.hold(3);
    playback.stop();
    expect(playback.holding).toBe(false);
  });

  it("plays Mike on when a turn that has ended gets no verdict, and warns", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { playback, sources } = setup();
    playback.enqueue(frame(1));
    playback.hold(1);
    expect(sources).toHaveLength(1);
    vi.advanceTimersByTime(HOLD_NO_VERDICT_MS * 3);         // still recording: no timer yet
    expect(playback.holding).toBe(true);
    playback.turnEnded(1);
    vi.advanceTimersByTime(HOLD_NO_VERDICT_MS - 1);
    expect(playback.holding).toBe(true);
    vi.advanceTimersByTime(1);
    expect(playback.holding).toBe(false);
    expect(sources).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("a verdict in time cancels the timer; a timed-out turn leaves a newer one holding", () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { playback } = setup();
    playback.hold(1);
    playback.turnEnded(1);
    playback.release(1);
    vi.advanceTimersByTime(HOLD_NO_VERDICT_MS * 2);
    expect(warn).not.toHaveBeenCalled();
    playback.hold(2);
    playback.turnEnded(2);
    playback.hold(3);                                       // B is recorded while A waits
    vi.advanceTimersByTime(HOLD_NO_VERDICT_MS);
    expect(playback.holding).toBe(true);                    // turn 3 still holds
    playback.stop();
    vi.advanceTimersByTime(HOLD_NO_VERDICT_MS * 2);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
