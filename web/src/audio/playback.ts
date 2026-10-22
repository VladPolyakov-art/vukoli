/* Plays Mike's 24 kHz PCM16 frames gap-free in arrival order (ported from studio.js queueAudio / stopPlayback). */
import { OUT_RATE, pcm16ToFloat32 } from "./framing";

export const PLAYBACK_COOLDOWN_MS = 400;

export class Playback {
  private sources = new Set<AudioBufferSourceNode>();
  private nextAt = 0;
  private cooldownUntil = 0;
  /** Drop incoming audio (after a barge-in, until the next Mike turn starts). */
  suppressed = false;
  onChange?: (playing: boolean) => void;

  constructor(private context: AudioContext, private destination: AudioNode = context.destination) {}

  enqueue(buffer: ArrayBuffer) {
    if (this.suppressed || buffer.byteLength < 2 || this.context.state === "closed") return;
    const samples = pcm16ToFloat32(buffer);
    const audio = this.context.createBuffer(1, samples.length, OUT_RATE);
    audio.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = audio;
    source.connect(this.destination);
    const wasIdle = this.sources.size === 0;
    this.sources.add(source);
    const start = Math.max(this.context.currentTime + 0.025, this.nextAt);
    this.nextAt = start + audio.duration;
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      if (!this.sources.size) {
        this.cooldownUntil = performance.now() + PLAYBACK_COOLDOWN_MS;
        this.onChange?.(false);
      }
    };
    source.start(start);
    if (wasIdle) this.onChange?.(true);
  }

  stop() {
    const had = this.sources.size > 0;
    for (const source of this.sources) {
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
    if (had) this.onChange?.(false);
  }

  get playing() {
    return this.sources.size > 0;
  }

  /** Mike is audible or just stopped: the mic may still carry his voice. */
  get echoRisk() {
    return this.sources.size > 0 || performance.now() < this.cooldownUntil;
  }
}
