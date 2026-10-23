/* Voice-activity state machine ported from the prototype (studio.js processMicrophone), kept pure so it can be tested.
 *
 * - Frames are 512 samples (32 ms) at 16 kHz; each call gets the frame's RMS level and a clock in ms.
 * - A frame counts as "voice" only when it is loud enough (RMS above the threshold) AND voiced (voicing.ts: pitch peak
 *   in the autocorrelation, and not an impulsive decaying burst). Knocks, taps, clicks and plain noise are loud but not
 *   voiced, so they never open a turn, extend one, or hold off its commit.
 * - Idle: the last PRE_ROLL_FRAMES frames are kept as pre-roll. A turn starts when a chain of voiced frames (gaps of at
 *   most 2 frames) holds at least START_FRAMES voiced frames, the newest START_RUN_FRAMES of them back to back, and the
 *   newest frame is not a fading tail (its RMS is at least SUSTAIN_RATIO of the run's peak, so a ringing knock whose
 *   resonance sounds pitched still does not count). The pre-roll sent with the turn starts LEAD_FRAMES before the chain,
 *   so the confirmation delay never clips the first syllable.
 * - Echo guard: while Mike's audio plays (or 400 ms after it stops) the threshold doubles and ECHO_START_FRAMES voiced
 *   frames in a row are needed, so the speaker's own voice does not barge in; the browser's echoCancellation does the rest.
 * - Recording: after `pauseMs` without a voiced frame (and only if the user actually spoke) the turn is committed.
 *   pauseMs = 0 means manual: only commit() ends the turn. `spoke` is true only if a voiced frame was heard.
 * - After a turn, 6 frames without voice are required before a new turn can start (no instant re-trigger on the tail). */

import { voicedScore } from "./voicing";

export const FRAME_SAMPLES = 512;
/** Idle buffer: must cover START_WINDOW + LEAD_FRAMES (+ echo confirmation). 16 frames = 512 ms. */
export const PRE_ROLL_FRAMES = 16;
export const BASE_THRESHOLD = 0.006;
export const ECHO_THRESHOLD = 0.012;
/** Voiced frames needed in the chain to open a turn (4 x 32 ms = 128 ms of voice). */
export const START_FRAMES = 4;
/** ... of which the newest this many are consecutive. */
export const START_RUN_FRAMES = 3;
/** Only the newest START_WINDOW frames are looked at (8 x 32 ms = 256 ms). */
export const START_WINDOW = 8;
/** Gaps of up to this many frames do not break a chain (a stop consonant inside a word). */
export const CHAIN_GAP_FRAMES = 2;
export const ECHO_START_FRAMES = 6;
export const SETTLE_FRAMES = 6;
/** Pre-roll keeps this many frames before the first voiced frame of the chain (soft consonants before the vowel). */
export const LEAD_FRAMES = 5;
/** Voiced-score thresholds (voicing.ts): to open a turn, and (lower, hysteresis) to keep it alive. */
export const VOICED_START = 0.4;
export const VOICED_KEEP = 0.3;
/** The newest frame must keep at least this share of the run's peak RMS (-12 dB): a decaying ring-out is not speech. */
export const SUSTAIN_RATIO = 0.25;
/** While recording, a frame quieter than this share of the previous frame (-3 dB per 32 ms or faster) is a fade, not voice. */
export const FADE_RATIO = 0.7;
/** Muted-speech warning: this many voiced frames among the last MUTED_WINDOW (about a quarter of a second of voice). */
export const MUTED_WINDOW = 10;
export const MUTED_FRAMES = 6;

export type VadEvent =
  | { type: "start"; preRoll: ArrayBuffer[] }
  | { type: "frame"; buffer: ArrayBuffer }
  | { type: "commit" }
  | { type: "muted_speech" };

export interface VadInput {
  buffer: ArrayBuffer;
  rms: number;
  now: number;
  /** Mike's audio is playing or just stopped. */
  echoRisk: boolean;
  /** Voiced score of the frame (voicing.ts). Omitted: computed from `buffer`, and only when the frame is loud enough. */
  voiceScore?: number;
}

interface IdleFrame {
  buffer: ArrayBuffer;
  rms: number;
  voiced: boolean;
}

export class VadMachine {
  pauseMs: number;
  enabled = true;
  muted = false;
  recording = false;
  committing = false;
  private hasVoice = false;
  private lastVoiceAt = 0;
  private idle: IdleFrame[] = [];
  private awaitingSilence = false;
  private silentFrames = 0;
  private prevVoiced = false;
  private prevRms = 0;
  private mutedHistory: boolean[] = [];
  private mutedWarnedAt = -Infinity;

  constructor(pauseMs: number) {
    this.pauseMs = pauseMs;
  }

  feed({ buffer, rms, now, echoRisk, voiceScore }: VadInput): VadEvent[] {
    const threshold = echoRisk && !this.recording ? ECHO_THRESHOLD : BASE_THRESHOLD;
    const score = (limit: number) => (rms > limit ? (voiceScore ?? voicedScore(buffer)) : 0);
    if (this.muted) {
      this.mutedHistory.push(score(BASE_THRESHOLD * 1.5) >= VOICED_START);
      if (this.mutedHistory.length > MUTED_WINDOW) this.mutedHistory.shift();
      if (this.mutedHistory.filter(Boolean).length >= MUTED_FRAMES && now - this.mutedWarnedAt > 8000) {
        this.mutedWarnedAt = now;
        this.mutedHistory = [];
        return [{ type: "muted_speech" }];
      }
      return [];
    }
    if (!this.enabled) return [];
    if (this.recording) {
      // A frame keeps the turn alive only if it is voiced, follows another voiced frame (a lone pitched click does not
      // count) and is not a fast fade (a ringing knock dies 3x per frame, a word keeps its level for a few frames).
      const voiced = score(threshold) >= VOICED_KEEP;
      const fading = rms < this.prevRms * FADE_RATIO;
      if (voiced && this.prevVoiced && !fading) {
        this.hasVoice = true;
        this.lastVoiceAt = now;
      }
      this.prevVoiced = voiced;
      this.prevRms = rms;
      const events: VadEvent[] = [{ type: "frame", buffer }];
      if (this.pauseMs > 0 && this.hasVoice && !this.committing && now - this.lastVoiceAt > this.pauseMs) {
        this.committing = true;
        events.push({ type: "commit" });
      }
      return events;
    }
    if (this.awaitingSilence) {
      this.silentFrames = score(threshold) >= VOICED_KEEP ? 0 : this.silentFrames + 1;
      if (this.silentFrames >= SETTLE_FRAMES) this.awaitingSilence = false;
      return [];
    }
    this.idle.push({ buffer, rms, voiced: score(threshold) >= VOICED_START });
    if (this.idle.length > PRE_ROLL_FRAMES) this.idle.shift();
    const chainStart = this.speechChainStart(echoRisk);
    if (chainStart >= 0) {
      const preRoll = this.idle.slice(Math.max(0, chainStart - LEAD_FRAMES)).map((f) => f.buffer);
      this.begin(now);
      this.hasVoice = true;
      this.prevVoiced = true;
      this.prevRms = rms;
      return [{ type: "start", preRoll }];
    }
    return [];
  }

  /** Index (in `idle`) of the first voiced frame of a chain that confirms speech, or -1. */
  private speechChainStart(echoRisk: boolean): number {
    const frames = this.idle;
    const last = frames.length - 1;
    const windowStart = Math.max(0, frames.length - START_WINDOW);
    // Newest consecutive voiced frames.
    let run = 0;
    while (last - run >= windowStart && frames[last - run]?.voiced) run++;
    if (run === 0) return -1;
    if (echoRisk) return run >= ECHO_START_FRAMES ? last - run + 1 : -1;
    // Walk back through the window while the gaps between voiced frames stay short.
    let count = 0;
    let first = last;
    let gap = 0;
    for (let i = last; i >= windowStart; i--) {
      if (frames[i]?.voiced) {
        count++;
        first = i;
        gap = 0;
      } else if (++gap > CHAIN_GAP_FRAMES) break;
    }
    if (count < START_FRAMES || run < START_RUN_FRAMES) return -1;
    let peak = 0;
    for (let i = last - run + 1; i <= last; i++) peak = Math.max(peak, frames[i]?.rms ?? 0);
    return (frames[last]?.rms ?? 0) >= peak * SUSTAIN_RATIO ? first : -1;
  }

  /** Start a turn without waiting for voice (Interrupt button, browser STT barge-in). */
  begin(now: number) {
    this.recording = true;
    this.committing = false;
    this.hasVoice = false;
    this.lastVoiceAt = now;
    this.idle = [];
    this.prevVoiced = false;
    this.prevRms = 0;
  }

  /** Manual "Send now". Returns false when there is nothing to send. */
  commit(): boolean {
    if (!this.recording || this.committing) return false;
    this.committing = true;
    return true;
  }

  /** The turn was sent (or dropped): wait for quiet before the next one. */
  finish() {
    this.recording = false;
    this.committing = false;
    this.hasVoice = false;
    this.idle = [];
    this.awaitingSilence = true;
    this.silentFrames = 0;
  }

  /** A voiced frame was heard during this turn (a turn without one is not "spoken"). */
  get spoke() {
    return this.hasVoice;
  }
}
