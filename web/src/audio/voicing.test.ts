/* analyzeVoicing: vowels score high, knocks / noise score low. Synthetic signals come from voiceFixtures.ts. */
import { describe, expect, it } from "vitest";
import { rmsPcm16 } from "./framing";
import { MIN_SAMPLES, analyzeVoicing, voicedScore } from "./voicing";
import * as fx from "./voiceFixtures";

/** Scores of every frame whose RMS is above the VAD base threshold. */
function loudScores(signal: Float32Array): number[] {
  return fx
    .frames(signal)
    .filter((f) => rmsPcm16(f) > 0.006)
    .map((f) => voicedScore(f));
}

describe("analyzeVoicing", () => {
  it("scores steady vowels from low to high voices well above the 0.4 start threshold", () => {
    for (const f0 of [100, 120, 160, 220, 300, 380]) {
      const scores = loudScores(fx.vowel(f0, 0.8, 0.2)).slice(1, -1); // the first frame is the onset, the last the release
      expect(Math.min(...scores), `f0 ${f0}`).toBeGreaterThan(0.6);
    }
  });

  it("finds the period of a plain 200 Hz harmonic tone (lag 80 samples)", () => {
    const n = 512;
    const tone = new Float32Array(n);
    for (let i = 0; i < n; i++) for (let h = 1; h <= 6; h++) tone[i] = (tone[i] ?? 0) + Math.sin((2 * Math.PI * 200 * h * i) / fx.RATE + h) / h;
    const v = analyzeVoicing(fx.toPcm16(tone.map((s) => s * 0.1)));
    expect(v.lag).toBe(80);
    expect(v.pitch).toBeGreaterThan(0.9);
  });

  it("keeps a vowel over room noise (SNR about 20 dB) above the keep threshold 0.3", () => {
    const noisy = fx.mix(fx.vowel(120, 0.8, 0.1), fx.whiteNoise(0.8, 0.01, 5), 0);
    expect(Math.min(...loudScores(noisy).slice(1))).toBeGreaterThan(0.3);
  });

  it("keeps fast knocks (decay inside the frame) below the 0.4 start threshold", () => {
    for (const tau of [4, 8, 15]) {
      const scores = loudScores(fx.concat(fx.silence(0.05), fx.knock(tau, 0.5)));
      expect(Math.max(...scores), `tau ${tau} ms`).toBeLessThan(0.4);
    }
  });

  it("scores white noise at any level below 0.3", () => {
    for (const amp of [0.02, 0.05, 0.15, 0.4]) {
      const scores = fx.frames(fx.whiteNoise(2, amp, 9)).map((f) => voicedScore(f));
      expect(Math.max(...scores), `amp ${amp}`).toBeLessThan(0.3);
    }
  });

  it("returns 0 for silence and for frames too short to score (the worklet's flushed tail)", () => {
    expect(voicedScore(new Int16Array(512))).toBe(0);
    expect(voicedScore(fx.toPcm16(fx.vowel(120, 0.1, 0.2)).slice(0, MIN_SAMPLES - 1))).toBe(0);
  });

  it("accepts an ArrayBuffer", () => {
    const frame = fx.frames(fx.vowel(150, 0.5, 0.2))[5] as Int16Array;
    expect(voicedScore(frame.buffer as ArrayBuffer)).toBeGreaterThan(0.6);
  });
});
