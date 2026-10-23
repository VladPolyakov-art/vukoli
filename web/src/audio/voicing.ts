/* Is this 32 ms frame a human voice, or a knock / click / noise? Pure, cheap, tested in voicing.test.ts.
 *
 * Two cheap cues, both computed on the 512-sample frame (16 kHz):
 *  1. Pitch: normalised autocorrelation, best peak for lags of 70-400 Hz (40..230 samples), searched only after the
 *     first zero crossing of the autocorrelation (so low-passed rumble / a desk thump, whose autocorrelation just
 *     decays smoothly, is not mistaken for a pitch). Vowels give 0.6-0.95, white noise ~0.1-0.25.
 *  2. Impulsiveness: a knock is a burst that dies out inside the frame (the second half carries a small fraction of the
 *     first half's energy); a spoken sound is either steady or rising at an onset. A strongly decaying frame scores 0
 *     even if the ringing is periodic (a desk resonates at 100-500 Hz, which fools a pitch detector on its own).
 *
 * Whispered and unvoiced sounds (s, f, sh) have no pitch and are not "voiced" - by design; the VAD needs only a few
 * voiced frames per turn, and vowels are always present in speech. */

/** Pitch search range: 70..400 Hz at 16 kHz. */
export const MIN_LAG = 40;
export const MAX_LAG = 230;
/** Frames shorter than this (the worklet's flushed tail) cannot be scored. */
export const MIN_SAMPLES = MAX_LAG + 96;
/** The second half of the frame holding less than this share of the first half's energy = impulsive burst. */
export const IMPULSE_DECAY_RATIO = 0.25;

export interface Voicing {
  /** Best normalised autocorrelation peak in the pitch range, 0..1 (0 when no pitch peak exists). */
  pitch: number;
  /** Lag of that peak in samples (0 when none). */
  lag: number;
  /** Energy of the 2nd half / energy of the 1st half of the frame (a knock: << 1; steady voice: ~1; onset: > 1). */
  decay: number;
  /** pitch, or 0 when the frame is an impulsive burst. This is the number the VAD compares with its thresholds. */
  score: number;
}

const SILENT: Voicing = { pitch: 0, lag: 0, decay: 1, score: 0 };

export function analyzeVoicing(input: Int16Array | ArrayBuffer): Voicing {
  const pcm = input instanceof Int16Array ? input : new Int16Array(input, 0, Math.floor(input.byteLength / 2));
  const n = pcm.length;
  if (n < MIN_SAMPLES) return SILENT;

  // Mean removed, as float.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += pcm[i] ?? 0;
  mean /= n;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = ((pcm[i] ?? 0) - mean) / 32768;
  // Prefix sums of squares: energy of any segment in O(1).
  const sq = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) sq[i + 1] = (sq[i] ?? 0) + (x[i] ?? 0) * (x[i] ?? 0);
  const total = sq[n] ?? 0;
  if (total < 1e-12) return SILENT;

  const half = n >> 1;
  const first = sq[half] ?? 0;
  const second = total - first;
  const decay = first > 1e-12 ? second / first : 1;

  // Normalised autocorrelation r[L] for L = 0..MAX_LAG + 1.
  const maxLag = Math.min(MAX_LAG + 1, n - 64);
  const r = new Float64Array(maxLag + 1);
  let firstZero = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    const end = n - lag;
    for (let i = 0; i < end; i++) sum += (x[i] ?? 0) * (x[i + lag] ?? 0);
    const ea = sq[end] ?? 0;
    const eb = total - (sq[lag] ?? 0);
    const den = Math.sqrt(ea * eb);
    r[lag] = den > 1e-12 ? sum / den : 0;
    if (!firstZero && (r[lag] ?? 0) <= 0) firstZero = lag;
  }

  let pitch = 0;
  let bestLag = 0;
  if (firstZero) {
    for (let lag = Math.max(MIN_LAG, firstZero + 1); lag < maxLag; lag++) {
      const v = r[lag] ?? 0;
      if (v > pitch && v >= (r[lag - 1] ?? 0) && v >= (r[lag + 1] ?? 0)) {
        pitch = v;
        bestLag = lag;
      }
    }
  }
  const impulsive = decay < IMPULSE_DECAY_RATIO;
  return { pitch, lag: bestLag, decay, score: impulsive ? 0 : pitch };
}

/** Convenience: the VAD score (0..1) of a frame. */
export function voicedScore(input: Int16Array | ArrayBuffer): number {
  return analyzeVoicing(input).score;
}
