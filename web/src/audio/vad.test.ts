/* VadMachine: voiced speech opens a turn, knocks / noise never do; the stricter echo rule while Mike is audible. */
import { describe, expect, it } from "vitest";
import { rmsPcm16 } from "./framing";
import {
  BASE_THRESHOLD,
  ECHO_START_FRAMES,
  ECHO_THRESHOLD,
  FRAME_SAMPLES,
  PRE_ROLL_FRAMES,
  START_FRAMES,
  VadMachine,
  type VadEvent,
} from "./vad";
import * as fx from "./voiceFixtures";

const FRAME_MS = 32;

/** One steady vowel frame, scaled to the wanted RMS (voicing is scale-invariant). */
const VOWEL_FRAME = fx.frames(fx.vowel(150, 0.6, 0.2))[8] as Int16Array;
function voicedFrame(rms: number): Int16Array {
  const gain = rms / rmsPcm16(VOWEL_FRAME);
  return VOWEL_FRAME.map((s) => Math.round(s * gain));
}

/** Feed `count` voiced frames of one level; the event types the machine produced, in order. */
function feedFrames(vad: VadMachine, count: number, rms: number, echoRisk: boolean): string[] {
  const types: string[] = [];
  const frame = voicedFrame(rms);
  for (let i = 0; i < count; i++) {
    vad.feed({ buffer: frame.buffer as ArrayBuffer, rms: rmsPcm16(frame), now: i * FRAME_MS, echoRisk }).forEach((e) => types.push(e.type));
  }
  return types;
}

interface Run {
  /** [frame index, event] in feed order (frame events included). */
  events: Array<[number, VadEvent]>;
  buffers: ArrayBuffer[];
  rms: number[];
  startFrame: number;
  commitFrame: number;
}

/** Feed a whole signal frame by frame (now = index * 32 ms). */
function run(vad: VadMachine, signal: Float32Array, echoRisk = false): Run {
  const out: Run = { events: [], buffers: [], rms: [], startFrame: -1, commitFrame: -1 };
  fx.frames(signal).forEach((pcm, i) => {
    out.buffers.push(pcm.buffer as ArrayBuffer);
    out.rms.push(rmsPcm16(pcm));
    for (const e of vad.feed({ buffer: pcm.buffer as ArrayBuffer, rms: rmsPcm16(pcm), now: i * FRAME_MS, echoRisk })) {
      out.events.push([i, e]);
      if (e.type === "start" && out.startFrame < 0) out.startFrame = i;
      if (e.type === "commit" && out.commitFrame < 0) out.commitFrame = i;
    }
  });
  return out;
}

const types = (r: Run, type: VadEvent["type"]) => r.events.filter(([, e]) => e.type === type);
const onsetFrame = (seconds: number) => Math.ceil((seconds * fx.RATE) / FRAME_SAMPLES);

describe("VadMachine echo guard", () => {
  it("opens a turn after START_FRAMES voiced frames above the base threshold when Mike is quiet", () => {
    expect(feedFrames(new VadMachine(1500), START_FRAMES - 1, BASE_THRESHOLD * 2, false)).toEqual([]);
    expect(feedFrames(new VadMachine(1500), START_FRAMES, BASE_THRESHOLD * 2, false)).toEqual(["start"]);
  });

  it("ignores a breath or a click under the doubled threshold while Mike's audio is (or is about to be) audible", () => {
    const breath = (BASE_THRESHOLD + ECHO_THRESHOLD) / 2;
    expect(feedFrames(new VadMachine(1500), 40, breath, true)).toEqual([]);
  });

  it("still lets loud speech through the guard, but only after more frames", () => {
    const loud = ECHO_THRESHOLD * 2;
    expect(feedFrames(new VadMachine(1500), ECHO_START_FRAMES - 1, loud, true)).toEqual([]);
    expect(feedFrames(new VadMachine(1500), ECHO_START_FRAMES, loud, true)).toEqual(["start"]);
  });

  it("does not let knocks through the guard either", () => {
    const r = run(new VadMachine(1500), fx.knockTrain(4, 300, { peak: 0.9 }), true);
    expect(types(r, "start")).toEqual([]);
  });
});

describe("VadMachine voice vs knock", () => {
  for (const f0 of [120, 220]) {
    it(`starts a turn within 10 frames of a ${f0} Hz vowel onset, pre-roll contains the onset`, () => {
      const onset = 0.2;
      const r = run(new VadMachine(1500), fx.concat(fx.silence(onset), fx.vowel(f0, 1.2, 0.2)));
      const first = onsetFrame(onset);
      expect(r.startFrame).toBeGreaterThanOrEqual(first);
      expect(r.startFrame - first).toBeLessThanOrEqual(10);
      const start = types(r, "start")[0]?.[1] as Extract<VadEvent, { type: "start" }>;
      const firstLoud = r.rms.findIndex((v) => v > BASE_THRESHOLD);
      expect(start.preRoll).toContain(r.buffers[firstLoud]);
      expect(start.preRoll).toContain(r.buffers[r.startFrame]);
      expect(start.preRoll.length).toBeLessThanOrEqual(PRE_ROLL_FRAMES);
    });
  }

  it("barge-in latency from the first loud frame is at most 5 frames (160 ms) for a clean vowel", () => {
    const r = run(new VadMachine(1500), fx.concat(fx.silence(0.2), fx.vowel(150, 1, 0.2)));
    const firstLoud = r.rms.findIndex((v) => v > BASE_THRESHOLD);
    expect(r.startFrame - firstLoud).toBeLessThanOrEqual(5);
  });

  it("starts for a vowel with room noise and for a quiet voice", () => {
    const noisy = fx.mix(fx.concat(fx.silence(0.2), fx.vowel(130, 1, 0.1)), fx.whiteNoise(1.2, 0.01, 5), 0);
    expect(run(new VadMachine(1500), noisy).startFrame).toBeGreaterThan(0);
    expect(run(new VadMachine(1500), fx.concat(fx.silence(0.2), fx.vowel(130, 1, 0.03))).startFrame).toBeGreaterThan(0);
  });

  it("never starts on a single knock, loud or soft, short or ringing", () => {
    for (const tau of [4, 8, 15, 25, 40]) {
      for (const peak of [0.1, 0.5, 0.95]) {
        const r = run(new VadMachine(1500), fx.concat(fx.silence(0.1), fx.knock(tau, peak), fx.silence(0.3)));
        expect(types(r, "start"), `tau ${tau} ms, peak ${peak}`).toEqual([]);
      }
    }
  });

  it("never starts on a train of 4 knocks 300 ms apart, with or without a noise reverb tail", () => {
    for (const tau of [6, 12, 25]) {
      for (const tail of [0, 0.03, 0.08]) {
        const r = run(new VadMachine(1500), fx.knockTrain(4, 300, { tauMs: tau, peak: 0.7, tail }));
        expect(types(r, "start"), `tau ${tau} ms, tail ${tail}`).toEqual([]);
      }
    }
  });

  it("never starts on white noise at speech level", () => {
    for (const amp of [0.02, 0.05, 0.15, 0.4]) {
      const r = run(new VadMachine(1500), fx.whiteNoise(4, amp, 21));
      expect(types(r, "start"), `amplitude ${amp}`).toEqual([]);
    }
  });

  it("starts for speech after a knock, even right after it, and the pre-roll does not reach back to the knock", () => {
    for (const speechAt of [0.9, 0.35]) {
      const signal = fx.mix(fx.concat(fx.silence(speechAt), fx.vowel(140, 1, 0.2)), fx.knock(10, 0.8), 0.05);
      const r = run(new VadMachine(1500), signal);
      expect(r.startFrame, `speech at ${speechAt}`).toBeGreaterThan(0);
      expect(r.startFrame - onsetFrame(speechAt)).toBeLessThanOrEqual(10);
    }
    const late = run(new VadMachine(1500), fx.mix(fx.concat(fx.silence(0.9), fx.vowel(140, 1, 0.2)), fx.knock(10, 0.8), 0.05));
    const start = types(late, "start")[0]?.[1] as Extract<VadEvent, { type: "start" }>;
    expect(start.preRoll.length).toBeLessThanOrEqual(PRE_ROLL_FRAMES);
    expect(start.preRoll).not.toContain(late.buffers[2]); // the knock frame
  });
});

describe("VadMachine while recording", () => {
  /** 0.8 s of speech, then 4 s of pause with `pause` laid over it. */
  const speech = fx.concat(fx.silence(0.2), fx.vowel(140, 0.8, 0.2));
  const withPause = (pause: Float32Array) => fx.mix(fx.concat(speech, fx.silence(4)), pause, 1.3);

  it("commits pauseMs after the last voiced frame", () => {
    const vad = new VadMachine(1000);
    const r = run(vad, fx.concat(speech, fx.silence(4)));
    expect(r.commitFrame).toBeGreaterThan(0);
    expect(vad.spoke).toBe(true);
    const lastVoiced = onsetFrame(1.0); // speech ends at 1.0 s
    expect((r.commitFrame - lastVoiced) * FRAME_MS).toBeLessThan(1000 + 4 * FRAME_MS);
  });

  it("knocks during the pause neither delay nor prevent the commit", () => {
    const quiet = run(new VadMachine(1000), withPause(fx.silence(0.01)));
    const knocks = run(new VadMachine(1000), withPause(fx.knockTrain(5, 300, { tauMs: 10, peak: 0.8, tail: 0.04 })));
    expect(quiet.commitFrame).toBeGreaterThan(0);
    expect(knocks.commitFrame).toBe(quiet.commitFrame);
  });

  it("ringing, pitched knocks (tau 25 and 40 ms) hold the commit by at most 3 frames after the last one", () => {
    for (const tauMs of [25, 40]) {
      const knocks = fx.knockTrain(5, 300, { tauMs, peak: 0.8 });
      const r = run(new VadMachine(1000), withPause(knocks));
      const lastKnockFrame = Math.floor((1.3 + 4 * 0.3) / (FRAME_MS / 1000)) + 1;
      const pauseFrames = Math.ceil(1000 / FRAME_MS);
      expect(r.commitFrame - (lastKnockFrame + pauseFrames), `tau ${tauMs} ms`).toBeLessThanOrEqual(3);
    }
  });

  it("a manual turn that only hears knocks is not 'spoke' and never auto-commits", () => {
    const vad = new VadMachine(1000);
    vad.begin(0);
    const r = run(vad, fx.concat(fx.silence(0.3), fx.knockTrain(4, 300, { peak: 0.8 }), fx.silence(3)));
    expect(types(r, "commit")).toEqual([]);
    expect(vad.spoke).toBe(false);
    expect(vad.commit()).toBe(true);
  });

  it("a voiced turn is 'spoke' and finish() resets it", () => {
    const vad = new VadMachine(1000);
    run(vad, speech);
    expect(vad.spoke).toBe(true);
    vad.finish();
    expect(vad.spoke).toBe(false);
  });

  it("after finish(), knocks do not hold off the next turn but 6 voice-free frames are still required", () => {
    const vad = new VadMachine(1000);
    run(vad, speech);
    vad.finish();
    const r = run(vad, fx.mix(fx.concat(fx.silence(0.6), fx.vowel(140, 1, 0.2)), fx.knock(10, 0.8), 0.05));
    expect(r.startFrame).toBeGreaterThan(0);
  });
});

describe("VadMachine muted", () => {
  it("warns about speech while muted, but not about knocks or noise", () => {
    const warn = (signal: Float32Array) => {
      const vad = new VadMachine(1500);
      vad.muted = true;
      return types(run(vad, signal), "muted_speech").length;
    };
    expect(warn(fx.concat(fx.silence(0.2), fx.vowel(140, 1.2, 0.2)))).toBe(1);
    expect(warn(fx.knockTrain(6, 250, { peak: 0.9, tail: 0.05 }))).toBe(0);
    expect(warn(fx.whiteNoise(3, 0.2, 5))).toBe(0);
  });
});
