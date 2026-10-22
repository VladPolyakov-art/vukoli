/* Setup → Check (D81, US-02 AC2): one real round trip. The mic records one phrase (VAD ends it after a short pause,
 * "Done" or 12 s end it early), the server recognises it (or the browser's recogniser does, when the server has no
 * speech recognition), the engine answers in a sentence and Mike says it in the chosen voice. */
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserStt, browserSttSupported } from "../../audio/browserStt";
import { captureErrorCode, VoiceCapture } from "../../audio/capture";
import { micLevel } from "../../audio/level";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/store";
import type { CheckState } from "./types";

const PAUSE_MS = 900;
const MAX_MS = 12_000;
const MIN_BYTES = 16_000; // 0.5 s of 16 kHz PCM16: the server ignores anything shorter

function joinPcm(frames: ArrayBuffer[]): Uint8Array {
  const out = new Uint8Array(frames.reduce((n, f) => n + f.byteLength, 0));
  let at = 0;
  for (const f of frames) {
    out.set(new Uint8Array(f), at);
    at += f.byteLength;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function useVoiceCheck({ voice, serverStt, initial, initialSpeaking = false }: {
  voice: string; serverStt: boolean; initial?: CheckState; initialSpeaking?: boolean;
}) {
  const [state, setState] = useState<CheckState>(initial ?? { phase: "idle" });
  /** Mike's reply is playing (D82: drives the presence glow along the top). */
  const [speaking, setSpeaking] = useState(initialSpeaking);
  const level = useRef(0);
  const ctx = useRef<AudioContext | null>(null);
  const cap = useRef<VoiceCapture | null>(null);
  const rec = useRef<BrowserStt | null>(null);
  const frames = useRef<ArrayBuffer[]>([]);
  const timer = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef("");

  const stopMic = useCallback(() => {
    window.clearTimeout(timer.current);
    cap.current?.stop();
    cap.current = null;
    rec.current?.stop();
    rec.current = null;
    level.current = 0;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  const play = useCallback((b64: string) => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    url.current = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    const a = new Audio(url.current);
    audio.current = a;
    a.onplaying = () => setSpeaking(true);
    a.onpause = a.onended = () => setSpeaking(false);
    void a.play().catch(() => setSpeaking(false));
  }, []);

  useEffect(() => () => {
    stopMic();
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
  }, [stopMic]);

  const send = useCallback(async (body: { audio?: string; text?: string }) => {
    setState({ phase: "thinking", heard: body.text });
    try {
      const r = await api.voiceCheck({ ...body, voice });
      if (r.ok) {
        setState({ phase: "done", heard: r.heard, reply: r.reply ?? "", audio: r.audio ?? null });
        if (r.audio) play(r.audio);
      } else {
        setState({ phase: "error", code: r.code === "not_heard" ? "not_heard" : "engine", message: r.message, heard: r.heard || undefined });
      }
    } catch (e) {
      setState({ phase: "error", code: "failed", message: errorMessage(e) });
    }
  }, [voice, play]);

  /** End the phrase now ("Done", or the 12 s cap). Nothing said yet → "didn't catch that". */
  const finish = useCallback(() => {
    const c = cap.current;
    if (!c) return;
    if (c.recording) c.commit();
    else {
      stopMic();
      setState({ phase: "error", code: "not_heard" });
    }
  }, [stopMic]);

  const start = useCallback(async () => {
    stopMic();
    audio.current?.pause();
    const browser = !serverStt;
    if (browser && !browserSttSupported()) {
      setState({ phase: "error", code: "no_stt" });
      return;
    }
    frames.current = [];
    const context = new AudioContext();
    ctx.current = context;
    const capture = new VoiceCapture(context, {
      onTurnStart: (preRoll) => { if (!browser) frames.current.push(...preRoll); },
      onFrame: (buffer) => { if (!browser) frames.current.push(buffer); },
      onTurnEnd: (spoke) => {
        if (!browser) {
          const pcm = joinPcm(frames.current);
          stopMic();
          if (!spoke || pcm.byteLength < MIN_BYTES) setState({ phase: "error", code: "not_heard" });
          else void send({ audio: toBase64(pcm) });
          return;
        }
        // Give the browser a moment to finalise the last words.
        window.setTimeout(() => {
          const text = rec.current?.text() ?? "";
          stopMic();
          if (text) void send({ text });
          else setState({ phase: "error", code: "not_heard" });
        }, 700);
      },
      onLevel: (rms) => { level.current = micLevel(rms); },
      echoRisk: () => false,
    }, PAUSE_MS);
    setState({ phase: "listening" });
    try {
      await capture.start();
    } catch (error) {
      capture.stop();
      stopMic();
      setState({ phase: "error", code: captureErrorCode(error) === "not_found" ? "mic_missing" : "mic_denied" });
      return;
    }
    cap.current = capture;
    if (browser) {
      const r = new BrowserStt();
      r.onDenied = () => { stopMic(); setState({ phase: "error", code: "mic_denied" }); };
      r.start();
      rec.current = r;
    }
    timer.current = window.setTimeout(finish, MAX_MS);
  }, [serverStt, stopMic, send, finish]);

  const replay = useCallback(() => {
    if (state.phase === "done" && state.audio) play(state.audio);
  }, [state, play]);

  const reset = useCallback(() => { stopMic(); setState({ phase: "idle" }); }, [stopMic]);

  return { state, speaking, start, finish, replay, reset, stop: stopMic, getLevel: () => level.current };
}
