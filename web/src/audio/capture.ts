/* Microphone capture: getUserMedia -> AudioWorklet (public/pcm-worklet.js, 16 kHz PCM16, 32 ms frames) -> VadMachine.
 * Ported from the prototype's startSession / processMicrophone / commitVoiceTurn / finishVoiceTurn. */
import { rmsPcm16 } from "./framing";
import { VadMachine } from "./vad";

export interface CaptureCallbacks {
  /** A voice turn started (VAD or manual). The caller sends activity_start, then the pre-roll frames. */
  onTurnStart: (preRoll: ArrayBuffer[], manual: boolean) => void;
  onFrame: (buffer: ArrayBuffer) => void;
  /** The worklet flushed the tail after a commit: the caller sends audio_stream_end (or the browser-STT text). */
  onTurnEnd: (spoke: boolean) => void;
  onMutedSpeech?: () => void;
  onLevel?: (rms: number) => void;
  echoRisk: () => boolean;
}

export type CaptureError = "not_allowed" | "not_found" | "insecure" | "unsupported" | "failed";

export function captureErrorCode(error: unknown): CaptureError {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "not_allowed";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "not_found";
  return "failed";
}

export class VoiceCapture {
  readonly vad: VadMachine;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private context: AudioContext, private cb: CaptureCallbacks, pauseMs: number) {
    this.vad = new VadMachine(pauseMs);
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error("insecure"), { name: window.isSecureContext ? "NotSupportedError" : "InsecureError" });
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    await this.context.audioWorklet.addModule("/pcm-worklet.js");
    this.source = this.context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.context, "pcm-capture");
    this.source.connect(this.node);
    // Output stays silent; connecting keeps the processor running.
    this.node.connect(this.context.destination);
    this.node.port.onmessage = (event: MessageEvent<ArrayBuffer | { type: string }>) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) this.onBuffer(data);
      else if (data?.type === "flushed") this.onFlushed();
    };
  }

  private onBuffer(buffer: ArrayBuffer) {
    const rms = rmsPcm16(new Int16Array(buffer));
    this.cb.onLevel?.(this.vad.muted ? 0 : rms);
    const events = this.vad.feed({ buffer, rms, now: performance.now(), echoRisk: this.cb.echoRisk() });
    for (const event of events) {
      if (event.type === "start") this.cb.onTurnStart(event.preRoll, false);
      else if (event.type === "frame") this.cb.onFrame(event.buffer);
      else if (event.type === "commit") this.node?.port.postMessage({ type: "flush" });
      else if (event.type === "muted_speech") this.cb.onMutedSpeech?.();
    }
  }

  private onFlushed() {
    const spoke = this.vad.spoke;
    this.vad.finish();
    this.cb.onTurnEnd(spoke);
  }

  /** Interrupt / talk now: start a turn at once. */
  beginManual() {
    if (this.vad.recording || this.vad.muted) return;
    this.vad.begin(performance.now());
    this.cb.onTurnStart([], true);
  }

  /** Send now. */
  commit() {
    if (this.vad.commit()) this.node?.port.postMessage({ type: "flush" });
  }

  /** Drop the current turn without sending anything more. */
  cancel() {
    if (this.vad.recording) this.vad.finish();
  }

  setMuted(muted: boolean) {
    if (muted && this.vad.recording) this.commit();
    this.vad.muted = muted;
  }

  setEnabled(enabled: boolean) {
    this.vad.enabled = enabled;
  }

  setPauseMs(ms: number) {
    this.vad.pauseMs = ms;
  }

  get recording() {
    return this.vad.recording;
  }

  stop() {
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.disconnect();
    }
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node = null;
    this.source = null;
    this.stream = null;
  }
}

/** One-off mic level check for the setup wizard: resolves with a stop function; calls onLevel ~30x/s. */
export async function micLevelMeter(onLevel: (rms: number) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += (data[i] ?? 0) ** 2;
    onLevel(Math.sqrt(sum / data.length));
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
  };
}
