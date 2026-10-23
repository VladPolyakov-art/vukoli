/* Synthetic 16 kHz signals for the VAD tests (test-only helper, never imported by the app).
 * Deterministic: noise comes from a seeded PRNG so thresholds do not flake. */
import { FRAME_SAMPLES } from "./vad";

export const RATE = 16000;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian-ish white noise (sum of uniforms), unit-ish variance. */
export function whiteNoise(seconds: number, amplitude: number, seed = 1): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = (rand() + rand() + rand() + rand() - 2) * 1.7 * amplitude;
  return out;
}

/** Silence of the given length. */
export function silence(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * RATE));
}

/** Vowel-like sound: harmonics of f0 with a formant-ish roll-off, slight vibrato + jitter, attack/release envelope.
 *  `peak` is the target peak amplitude (0..1). */
export function vowel(f0: number, seconds: number, peak = 0.2, seed = 7, breath = 0.35): Float32Array {
  const rand = rng(seed);
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  const harmonics = Math.floor(3400 / f0);
  const attack = Math.round(0.03 * RATE);
  const release = Math.round(0.04 * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // vibrato + slow intonation glide (+-12 %) + per-sample jitter, like a real voice
    const f = f0 * (1 + 0.03 * Math.sin(2 * Math.PI * 5 * t) + 0.12 * Math.sin(2 * Math.PI * 1.7 * t + seed) + 0.01 * (rand() - 0.5));
    phase += (2 * Math.PI * f) / RATE;
    let s = 0;
    for (let h = 1; h <= harmonics; h++) {
      // first formant boost around 600 Hz, second around 1500 Hz on top of a 1/h tilt
      const fh = h * f0;
      const formant = 1 + 2.5 * Math.exp(-((fh - 600) ** 2) / (2 * 150 ** 2)) + 1.5 * Math.exp(-((fh - 1500) ** 2) / (2 * 250 ** 2));
      s += (formant / h) * Math.sin(h * phase + h * 0.3);
    }
    const env = Math.min(1, i / attack, (n - i) / release) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 3 * t));
    // breathiness: aspiration noise that also follows the envelope (about -9 dB at breath = 0.35)
    out[i] = (s + breath * 3 * (rand() * 2 - 1)) * env;
  }
  return normalisePeak(out, peak);
}

/** A desk knock: a few damped resonances plus a noise click, exponentially decaying with time constant `tauMs`. */
export function knock(tauMs = 10, peak = 0.5, seed = 3, seconds = 0.4): Float32Array {
  const rand = rng(seed);
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  const modes = [
    { f: 140, a: 1 },
    { f: 330, a: 0.7 },
    { f: 780, a: 0.4 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.exp(-t / (tauMs / 1000));
    let s = 0;
    for (const m of modes) s += m.a * Math.sin(2 * Math.PI * m.f * t);
    s += 1.2 * (rand() * 2 - 1) * Math.exp(-t / 0.002);
    out[i] = s * env;
  }
  return normalisePeak(out, peak);
}

/** Decaying white-noise "room reverb" tail starting at sample 0. */
export function reverbTail(seconds: number, level: number, tauMs = 80, seed = 11): Float32Array {
  const noise = whiteNoise(seconds, level, seed);
  for (let i = 0; i < noise.length; i++) noise[i] = (noise[i] ?? 0) * Math.exp(-i / RATE / (tauMs / 1000));
  return noise;
}

/** Overlay `b` onto `a` starting at `atSeconds` (extends `a` when needed). */
export function mix(a: Float32Array, b: Float32Array, atSeconds: number): Float32Array {
  const start = Math.round(atSeconds * RATE);
  const out = new Float32Array(Math.max(a.length, start + b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) out[start + i] = (out[start + i] ?? 0) + (b[i] ?? 0);
  return out;
}

/** Concatenate signals. */
export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A train of `count` knocks every `gapMs`, each optionally followed by a reverb tail. */
export function knockTrain(count: number, gapMs: number, opts: { tauMs?: number; peak?: number; tail?: number } = {}): Float32Array {
  const { tauMs = 10, peak = 0.5, tail = 0 } = opts;
  let out = silence((count * gapMs) / 1000 + 0.3);
  for (let k = 0; k < count; k++) {
    const hit = knock(tauMs, peak, 3 + k);
    out = mix(out, hit, (k * gapMs) / 1000 + 0.05);
    if (tail > 0) out = mix(out, reverbTail(0.3, tail, 80, 20 + k), (k * gapMs) / 1000 + 0.05);
  }
  return out;
}

function normalisePeak(signal: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (const v of signal) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < signal.length; i++) signal[i] = (signal[i] ?? 0) * (peak / max);
  return signal;
}

export function toPcm16(signal: Float32Array): Int16Array {
  const out = new Int16Array(signal.length);
  for (let i = 0; i < signal.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, signal[i] ?? 0)) * 32767);
  return out;
}

/** Cut a signal into 512-sample PCM16 frames (the tail shorter than a frame is dropped). */
export function frames(signal: Float32Array): Int16Array[] {
  const pcm = toPcm16(signal);
  const out: Int16Array[] = [];
  for (let at = 0; at + FRAME_SAMPLES <= pcm.length; at += FRAME_SAMPLES) out.push(pcm.slice(at, at + FRAME_SAMPLES));
  return out;
}
