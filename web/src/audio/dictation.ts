/* Dictation into a text field (D90, the mic in the chat with Mike): tap, speak, tap again, the words land in the field.
 * The same choice as a session (session/startConfig.ts): the local STT on this computer by default; the browser's
 * recognition when the user picked it in Settings, or when the local one isn't set up. No audio or text is kept. */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, fileToBase64 } from "../lib/api";
import { prefs } from "../lib/prefs";
import type { SttInfo } from "../lib/types";
import { BrowserStt, browserSttSupported } from "./browserStt";
import { captureErrorCode, type CaptureError } from "./capture";

export type DictationState = "idle" | "listening" | "transcribing";
export type DictationError = CaptureError | "no_speech" | "stt_failed";
export type DictationMode = "local" | "browser";

/** A clip stops by itself after two minutes (the server takes up to two). */
export const DICTATION_MAX_MS = 120_000;
/** Shorter than this is nothing said (the server's STT skips under half a second too). */
const MIN_BYTES = 16_000;

/** Which recogniser dictation uses; null when neither works here (the mic is then not offered). */
export function dictationMode(stt: SttInfo | null | undefined, browser = browserSttSupported()): DictationMode | null {
  const serverOk = stt?.available !== false;
  if ((prefs.stt() === "browser" || !serverOk) && browser) return "browser";
  return serverOk ? "local" : null;
}

/** The mic as one clip of 16 kHz PCM16 (public/pcm-worklet.js, as in a session), no voice detection. */
class ClipRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private frames: ArrayBuffer[] = [];
  private flushed: (() => void) | null = null;

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error("insecure"), { name: window.isSecureContext ? "NotSupportedError" : "InsecureError" });
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext();
    await this.context.audioWorklet.addModule("/pcm-worklet.js");
    const source = this.context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.context, "pcm-capture");
    source.connect(this.node);
    this.node.connect(this.context.destination);
    this.node.port.onmessage = (event: MessageEvent<ArrayBuffer | { type: string }>) => {
      if (event.data instanceof ArrayBuffer) this.frames.push(event.data);
      else if (event.data?.type === "flushed") this.flushed?.();
    };
  }

  /** Stop and hand over everything recorded. */
  async stop(): Promise<Blob> {
    if (this.node) {
      await new Promise<void>((resolve) => {
        this.flushed = resolve;
        this.node?.port.postMessage({ type: "flush" });
        window.setTimeout(resolve, 500);       // a stalled worklet must not hold the field
      });
    }
    this.release();
    return new Blob(this.frames);
  }

  release() {
    if (this.node) this.node.port.onmessage = null;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.context?.close().catch(() => {});
    this.node = null;
    this.stream = null;
    this.context = null;
  }
}

export interface Dictation {
  mode: DictationMode | null;
  state: DictationState;
  error: DictationError | null;
  /** Idle → listening; listening → the words go to `onText`. */
  toggle: () => void;
  clearError: () => void;
}

export function useDictation(stt: SttInfo | null | undefined, onText: (text: string) => void): Dictation {
  const mode = dictationMode(stt);
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<DictationError | null>(null);
  const recorder = useRef<ClipRecorder | null>(null);
  const browser = useRef<BrowserStt | null>(null);
  const timer = useRef<number | null>(null);
  const deliver = useRef(onText);
  useEffect(() => { deliver.current = onText; }, [onText]);

  const finish = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const b = browser.current;
    if (b) {
      browser.current = null;
      const text = b.text();
      b.stop();
      setState("idle");
      if (text) deliver.current(text);
      else setError("no_speech");
      return;
    }
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    setState("transcribing");
    try {
      const clip = await r.stop();
      if (clip.size < MIN_BYTES) { setError("no_speech"); return; }
      const { text } = await api.transcribe(await fileToBase64(new File([clip], "clip.pcm")));
      if (text.trim()) deliver.current(text.trim());
      else setError("no_speech");
    } catch {
      setError("stt_failed");
    } finally {
      setState("idle");
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (mode === "browser") {
      const b = new BrowserStt();
      b.onDenied = () => { b.stop(); browser.current = null; setState("idle"); setError("not_allowed"); };
      if (!b.start()) { setError("unsupported"); return; }
      browser.current = b;
    } else if (mode === "local") {
      const r = new ClipRecorder();
      try {
        await r.start();
      } catch (e) {
        r.release();
        const name = (e as { name?: string } | null)?.name ?? "";
        setError(name === "InsecureError" ? "insecure" : name === "NotSupportedError" ? "unsupported" : captureErrorCode(e));
        return;
      }
      recorder.current = r;
    } else {
      return;
    }
    setState("listening");
    timer.current = window.setTimeout(() => { void finish(); }, DICTATION_MAX_MS);
  }, [mode, finish]);

  // Leaving the screen mid-dictation: the mic is released, nothing is sent.
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    browser.current?.stop();
    recorder.current?.release();
  }, []);

  const toggle = useCallback(() => {
    if (state === "idle") void start();
    else if (state === "listening") void finish();
  }, [state, start, finish]);

  return { mode, state, error, toggle, clearError: useCallback(() => setError(null), []) };
}
