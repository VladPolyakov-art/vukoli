/* Voice-activity state machine ported from the prototype (studio.js processMicrophone), kept pure so it can be tested.
 *
 * - Frames are 512 samples (32 ms) at 16 kHz; each call gets the frame's RMS level and a clock in ms.
 * - Idle: the last 8 frames are kept as pre-roll. 3 frames in a row above the threshold start a turn
 *   (the pre-roll is sent with it, so the first syllable is not lost).
 * - Echo guard: while Mike's audio plays (or 400 ms after it stops) the threshold doubles and 6 frames are needed,
 *   so the speaker's own voice does not barge in; the browser's echoCancellation does the rest.
 * - Recording: after `pauseMs` of quiet (and only if the user actually spoke) the turn is committed.
 *   pauseMs = 0 means manual: only commit() ends the turn.
 * - After a turn, 6 quiet frames are required before a new turn can start (no instant re-trigger on the tail). */

export const FRAME_SAMPLES = 512;
export const PRE_ROLL_FRAMES = 8;
export const BASE_THRESHOLD = 0.006;
export const ECHO_THRESHOLD = 0.012;
export const START_FRAMES = 3;
export const ECHO_START_FRAMES = 6;
export const SETTLE_FRAMES = 6;

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
}

export class VadMachine {
  pauseMs: number;
  enabled = true;
  muted = false;
  recording = false;
  committing = false;
  private hasVoice = false;
  private lastVoiceAt = 0;
  private speechFrames = 0;
  private preRoll: ArrayBuffer[] = [];
  private awaitingSilence = false;
  private silentFrames = 0;
  private mutedFrames = 0;
  private mutedWarnedAt = -Infinity;

  constructor(pauseMs: number) {
    this.pauseMs = pauseMs;
  }

  feed({ buffer, rms, now, echoRisk }: VadInput): VadEvent[] {
    const threshold = echoRisk && !this.recording ? ECHO_THRESHOLD : BASE_THRESHOLD;
    if (this.muted) {
      this.mutedFrames = rms > BASE_THRESHOLD * 1.5 ? this.mutedFrames + 1 : 0;
      if (this.mutedFrames >= 8 && now - this.mutedWarnedAt > 8000) {
        this.mutedWarnedAt = now;
        return [{ type: "muted_speech" }];
      }
      return [];
    }
    if (!this.enabled) return [];
    if (this.recording) {
      if (rms > threshold) {
        this.hasVoice = true;
        this.lastVoiceAt = now;
      }
      const events: VadEvent[] = [{ type: "frame", buffer }];
      if (this.pauseMs > 0 && this.hasVoice && !this.committing && now - this.lastVoiceAt > this.pauseMs) {
        this.committing = true;
        events.push({ type: "commit" });
      }
      return events;
    }
    if (this.awaitingSilence) {
      this.silentFrames = rms < threshold ? this.silentFrames + 1 : 0;
      if (this.silentFrames >= SETTLE_FRAMES) this.awaitingSilence = false;
      return [];
    }
    this.preRoll.push(buffer);
    if (this.preRoll.length > PRE_ROLL_FRAMES) this.preRoll.shift();
    this.speechFrames = rms > threshold ? this.speechFrames + 1 : 0;
    if (this.speechFrames >= (echoRisk ? ECHO_START_FRAMES : START_FRAMES)) {
      const preRoll = this.preRoll;
      this.begin(now);
      this.hasVoice = true;
      return [{ type: "start", preRoll }];
    }
    return [];
  }

  /** Start a turn without waiting for voice (Interrupt button, browser STT barge-in). */
  begin(now: number) {
    this.recording = true;
    this.committing = false;
    this.hasVoice = false;
    this.lastVoiceAt = now;
    this.speechFrames = 0;
    this.preRoll = [];
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
    this.speechFrames = 0;
    this.preRoll = [];
    this.awaitingSilence = true;
    this.silentFrames = 0;
  }

  get spoke() {
    return this.hasVoice;
  }
}
