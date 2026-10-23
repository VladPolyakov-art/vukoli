/* Plays Mike's 24 kHz PCM16 frames gap-free in arrival order (ported from studio.js queueAudio / stopPlayback).
 *
 * hold(turn) / release(turn): the mic opens a voice turn before anyone knows it is speech (a breath or a click opens
 * one too). Until the server says so, Mike's audio is held back, not thrown away: what was not yet played is parked,
 * frames that arrive meanwhile wait. Every open turn holds it on its own, so a verdict for an old turn cannot free
 * Mike while a newer one is still open. release(turn) plays on once no held turn is left (the turn was noise),
 * cutOff(turn) discards it (a real barge-in), stop() discards everything. */
import { OUT_RATE, pcm16ToFloat32 } from "./framing";

export const PLAYBACK_COOLDOWN_MS = 400;
/** A turn that ended this long ago without a verdict stops holding Mike back (a lost or very late message). */
export const HOLD_NO_VERDICT_MS = 8000;

interface Scheduled {
  audio: AudioBuffer;
  /** context.currentTime at which `offset` seconds into the buffer sound. */
  startAt: number;
  offset: number;
}

export class Playback {
  private sources = new Map<AudioBufferSourceNode, Scheduled>();
  private nextAt = 0;
  private cooldownUntil = 0;
  /** Voice turns holding Mike back -> their no-verdict timer (started when the turn ends). */
  private holds = new Map<number, ReturnType<typeof setTimeout> | undefined>();
  private parked: { audio: AudioBuffer; offset: number }[] = [];
  private waiting: ArrayBuffer[] = [];
  /** Drop incoming audio (after a barge-in, until the next Mike turn starts). */
  suppressed = false;
  onChange?: (playing: boolean) => void;

  constructor(private context: AudioContext, private destination: AudioNode = context.destination) {}

  enqueue(buffer: ArrayBuffer) {
    if (this.suppressed || buffer.byteLength < 2 || this.context.state === "closed") return;
    if (this.holds.size) {
      this.waiting.push(buffer);
      return;
    }
    const samples = pcm16ToFloat32(buffer);
    const audio = this.context.createBuffer(1, samples.length, OUT_RATE);
    audio.copyToChannel(samples, 0);
    this.schedule(audio, 0);
  }

  private schedule(audio: AudioBuffer, offset: number) {
    const source = this.context.createBufferSource();
    source.buffer = audio;
    source.connect(this.destination);
    const wasIdle = this.sources.size === 0;
    const startAt = Math.max(this.context.currentTime + 0.025, this.nextAt);
    this.sources.set(source, { audio, startAt, offset });
    this.nextAt = startAt + audio.duration - offset;
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      if (!this.sources.size) {
        this.cooldownUntil = performance.now() + PLAYBACK_COOLDOWN_MS;
        this.onChange?.(false);
      }
    };
    source.start(startAt, offset);
    if (wasIdle) this.onChange?.(true);
  }

  private silence(): Scheduled[] {
    const scheduled = [...this.sources.values()];
    for (const source of this.sources.keys()) {
      source.onended = null;
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextAt = this.context.currentTime;
    this.cooldownUntil = performance.now() + PLAYBACK_COOLDOWN_MS;
    return scheduled;
  }

  /** Pause Mike for this voice turn: silence what plays and keep the rest of it, in order. */
  hold(turn: number) {
    if (this.holds.has(turn)) return;
    const first = this.holds.size === 0;
    this.holds.set(turn, undefined);
    if (!first) return;
    const now = this.context.currentTime;
    const had = this.sources.size > 0;
    for (const { audio, startAt, offset } of this.silence()) {
      const at = offset + Math.max(0, Math.min(now - startAt, audio.duration - offset));
      if (at < audio.duration - 0.01) this.parked.push({ audio, offset: at });
    }
    if (had) this.onChange?.(false);
  }

  /** The turn stopped recording: from now on it must get its verdict within HOLD_NO_VERDICT_MS. */
  turnEnded(turn: number) {
    if (!this.holds.has(turn)) return;
    clearTimeout(this.holds.get(turn));
    this.holds.set(turn, setTimeout(() => {
      if (!this.holds.has(turn)) return;
      console.warn(`No verdict for voice turn ${turn} after ${HOLD_NO_VERDICT_MS / 1000} s: playing Mike on`);
      this.release(turn);
    }, HOLD_NO_VERDICT_MS));
  }

  private forget(turn?: number) {
    for (const key of turn === undefined ? [...this.holds.keys()] : [turn]) {
      clearTimeout(this.holds.get(key));
      this.holds.delete(key);
    }
  }

  /** The turn was noise: carry on where Mike stopped, unless another turn still holds him back. */
  release(turn?: number) {
    if (!this.holds.size) return;
    this.forget(turn);
    if (this.holds.size) return;
    const parked = this.parked;
    const waiting = this.waiting;
    this.parked = [];
    this.waiting = [];
    for (const { audio, offset } of parked) this.schedule(audio, offset);
    waiting.forEach((buffer) => this.enqueue(buffer));
  }

  /** The turn was speech: discard what Mike had left. Other open turns keep holding what comes next. */
  cutOff(turn?: number) {
    const had = this.sources.size > 0;
    this.silence();
    this.forget(turn);
    this.parked = [];
    this.waiting = [];
    if (had) this.onChange?.(false);
  }

  stop() {
    this.cutOff();
  }

  get playing() {
    return this.sources.size > 0;
  }

  get holding() {
    return this.holds.size > 0;
  }

  /** Something of Mike's is waiting to be played again. */
  get hasHeldAudio() {
    return this.holds.size > 0 && (this.parked.length > 0 || this.waiting.length > 0);
  }

  /** Mike is audible or just stopped: the mic may still carry his voice. */
  get echoRisk() {
    return this.sources.size > 0 || performance.now() < this.cooldownUntil;
  }
}
