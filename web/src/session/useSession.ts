/* Wires the session socket (/ws/session) to the reducer, the mic (VoiceCapture or BrowserStt) and Mike's audio.
 * Turn ids, echo guard and barge-in follow the prototype (studio.js): starting to speak silences Mike at once and
 * sends activity_start. Whether it was speech is the server's call (a breath or a click opens a turn too): with a
 * local engine his audio is only held back until `interrupted` (speech: it is discarded) or `voice_turn_dropped`
 * (noise: it plays on). Gemini Live cuts him off for good, as before. */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { MAX_BUFFERED_BYTES } from "../audio/framing";
import { BrowserStt, browserSttSupported } from "../audio/browserStt";
import { captureErrorCode, VoiceCapture, type CaptureError } from "../audio/capture";
import { micLevel } from "../audio/level";
import { Playback } from "../audio/playback";
import { prefs } from "../lib/prefs";
import type { ClientMessage, InputMode, ServerMessage, StartMessage } from "../lib/types";
import { t } from "../i18n";
import { initialState, sessionReducer } from "./reducer";
import type { RecheckEdit } from "./recheck";

export interface SessionConfig {
  start: StartMessage;
  /** Voice input recognised by the browser (Web Speech) instead of the server's local STT. */
  browserStt: boolean;
  /** Seconds of quiet that end a voice answer; 0 = manual (Send now). */
  pauseSec: number;
}

export function socketUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/session`;
}

export function useSession(config: SessionConfig) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => initialState(config.start.input, config.start.mode));
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micError, setMicError] = useState<CaptureError | "stt_unsupported" | "stt_denied" | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const playback = useRef<Playback | null>(null);
  const capture = useRef<VoiceCapture | null>(null);
  const stt = useRef<BrowserStt | null>(null);
  const turnId = useRef(0);
  /** The voice turn being recorded (or last recorded); typed turns also count in `turnId`. */
  const voiceTurn = useRef(0);
  /** Latest mic level 0..1 for the live mic indicator; written per audio frame, read per animation frame (no re-render). */
  const level = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  /** Browser speech recognition for voice answers; set at start, re-decided when a text session switches to voice. */
  const browserRef = useRef(config.browserStt);

  const send = useCallback((msg: ClientMessage) => {
    const socket = ws.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }, []);

  const endRef = useRef<() => void>(() => {});

  const sendPcm = useCallback((buffer: ArrayBuffer) => {
    const socket = ws.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      dispatch({ type: "local/client_error", code: "socket_backlog", message: t("session.errors.backlog") });
      endRef.current();
      return;
    }
    socket.send(buffer);
  }, []);

  const stopMic = useCallback(() => {
    level.current = 0;
    capture.current?.stop();
    capture.current = null;
    stt.current?.stop();
    stt.current = null;
  }, []);

  /** Start the microphone for voice input. Falls back to text input (with a reason) when it fails. */
  const startMic = useCallback(async () => {
    const context = ctx.current;
    if (!context || capture.current) return;
    const useBrowser = browserRef.current;
    if (useBrowser && !browserSttSupported()) {
      setMicError("stt_unsupported");
      dispatch({ type: "local/input_changed", input: "text" });
      return;
    }
    const cap = new VoiceCapture(context, {
      onTurnStart: (preRoll, manual) => {
        const pb = playback.current;
        turnId.current += 1;
        voiceTurn.current = turnId.current;
        if (pb && (manual || stateRef.current.engine === "gemini_live")) {
          pb.suppressed = true;
          pb.stop();
        } else pb?.hold(turnId.current);
        send({ type: "activity_start", turn_id: turnId.current, ...(manual ? { manual: true } : {}) });
        if (!useBrowser) preRoll.forEach(sendPcm);
        dispatch({ type: "local/voice_turn_started", turnId: turnId.current });
      },
      onFrame: (buffer) => {
        if (!useBrowser) sendPcm(buffer);
      },
      onTurnEnd: () => {
        const ended = voiceTurn.current;
        playback.current?.turnEnded(ended);
        if (!useBrowser) {
          send({ type: "audio_stream_end" });
          dispatch({ type: "local/voice_turn_sent" });
          return;
        }
        // Give the browser a moment to finalise the last words, then send the recognised text.
        window.setTimeout(() => {
          const recogniser = stt.current;
          const text = recogniser?.text() ?? "";
          recogniser?.consume();
          if (text) {
            send({ type: "user_turn", text, turn_id: ended, source: "browser_stt" });
            dispatch({ type: "local/user_turn", turnId: ended, text });
          } else {
            // Nothing recognised: the server lets Mike's held reply go on (voice_turn_dropped). The notice is for a
            // user who was expected to answer, not for a noise while Mike was speaking or about to reply.
            const mikeBusy = playback.current?.hasHeldAudio || stateRef.current.mikeTurnOpen
              || stateRef.current.awaitingBeforeVoice;
            dispatch({ type: "local/voice_turn_dropped", turnId: ended });
            if (stateRef.current.engine !== "gemini_live") send({ type: "activity_cancel", turn_id: ended });
            playback.current?.release(ended);
            if (!mikeBusy) dispatch({ type: "notice", code: "not_heard", message: t("session.notice.notHeard") });
          }
        }, configRef.current.pauseSec ? 250 : 700);
      },
      onLevel: (rms) => { level.current = micLevel(rms); },
      onMutedSpeech: () => dispatch({ type: "notice", code: "muted_speech", message: t("session.notice.mutedSpeech") }),
      // Also while Mike is about to reply (his first words are on their way and so is their echo).
      echoRisk: () => (playback.current?.echoRisk ?? false) || stateRef.current.awaitingReply,
    }, configRef.current.pauseSec * 1000);
    try {
      await cap.start();
    } catch (error) {
      cap.stop();
      setMicError(captureErrorCode(error));
      dispatch({ type: "local/input_changed", input: "text" });
      return;
    }
    capture.current = cap;
    cap.setEnabled(stateRef.current.phase === "live" && !stateRef.current.closing);
    if (useBrowser) {
      const rec = new BrowserStt();
      rec.isEcho = () => !(capture.current?.recording ?? false) && (playback.current?.playing ?? false);
      rec.onText = (text) => {
        if (capture.current?.recording) dispatch({ type: "speech_preview", turn_id: turnId.current, text });
      };
      rec.onDenied = () => {
        setMicError("stt_denied");
        stopMic();
        dispatch({ type: "local/input_changed", input: "text" });
      };
      rec.start();
      stt.current = rec;
    }
  }, [send, sendPcm, stopMic]);

  /** Audio context + Mike's playback; made at start for voice or spoken sessions, or on the switch to voice. */
  const ensureAudio = useCallback(() => {
    if (ctx.current) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    void context.resume().catch(() => {});
    ctx.current = context;
    const pb = new Playback(context);
    pb.onChange = setPlaying;
    playback.current = pb;
  }, []);

  /* ---------- socket lifecycle ---------- */
  /** Open the session socket and send `start`. Also the way back after a dropped connection: a `start` with
   * `resume_session_id` makes the server continue the saved session on a new socket (US-13 AC5). */
  const openSocket = useCallback((start: StartMessage) => {
    const previous = ws.current;
    if (previous) {
      previous.onmessage = null;
      previous.onclose = null;
      if (previous.readyState === WebSocket.OPEN || previous.readyState === WebSocket.CONNECTING) previous.close();
    }
    const socket = new WebSocket(socketUrl());
    socket.binaryType = "arraybuffer";
    ws.current = socket;
    socket.onopen = () => socket.send(JSON.stringify(start));
    socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (ws.current !== socket) return;
      if (event.data instanceof ArrayBuffer) {
        if (!stateRef.current.interrupted) playback.current?.enqueue(event.data);
        return;
      }
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "turn_start" && playback.current) playback.current.suppressed = false;
      if (msg.type === "interrupted") playback.current?.cutOff(msg.turn_id);
      if (msg.type === "voice_turn_dropped" || msg.type === "voice_turn_noise") playback.current?.release(msg.turn_id);
      dispatch(msg);
    };
    socket.onclose = () => {
      if (ws.current !== socket) return;
      dispatch({ type: "local/socket_closed" });
    };
  }, []);

  useEffect(() => {
    const start = configRef.current.start;
    if (start.speak || start.input !== "text") ensureAudio();
    openSocket(start);
    return () => {
      const socket = ws.current;
      ws.current = null;
      if (socket) {
        socket.onmessage = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
      }
      stopMic();
      playback.current?.stop();
      playback.current = null;
      const context = ctx.current;
      ctx.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
  }, [stopMic, ensureAudio, openSocket]);

  /* Start the mic once the session is live (voice input only), not while it is paused by an interruption. */
  useEffect(() => {
    if (state.phase === "live" && state.input !== "text" && !state.interrupted && !capture.current) void startMic();
  }, [state.phase, state.input, state.interrupted, startMic]);

  /* Voice turns are allowed only while the session is live and before Mike's closing line. */
  useEffect(() => {
    capture.current?.setEnabled(state.phase === "live" && !state.closing && !state.interrupted);
    if ((state.phase !== "live" && state.phase !== "connecting") || state.interrupted) stopMic();
  }, [state.phase, state.closing, state.interrupted, stopMic]);

  /* An interruption stops Mike's voice at once (the dialogue stays on screen, nothing new is said until Resume). */
  useEffect(() => {
    if (state.interrupted) playback.current?.stop();
  }, [state.interrupted]);

  /* Close the socket once the session is over. */
  useEffect(() => {
    if (state.phase === "done") ws.current?.close();
  }, [state.phase]);

  /* ---------- actions ---------- */
  const end = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "live" && s.phase !== "connecting" && !s.interrupted) return;
    capture.current?.cancel();
    playback.current?.stop();
    dispatch({ type: "local/end_requested" });
    if (ws.current?.readyState === WebSocket.OPEN) send({ type: "end_session" });
    else ws.current?.close();
  }, [send]);
  endRef.current = end;

  const actions = useMemo(() => ({
    sendText(text: string) {
      const clean = text.trim();
      if (!clean || stateRef.current.phase !== "live") return false;
      playback.current?.stop();
      turnId.current += 1;
      send({ type: "user_turn", text: clean, turn_id: turnId.current, source: "text" });
      dispatch({ type: "local/user_turn", turnId: turnId.current, text: clean });
      return true;
    },
    toggleMute() {
      setMuted((m) => {
        const next = !m;
        capture.current?.setMuted(next);
        return next;
      });
    },
    /** Interrupt Mike / talk now. */
    interrupt() {
      if (stateRef.current.input !== "text" && capture.current && !muted) capture.current.beginManual();
      else playback.current?.stop();
    },
    sendNow() {
      capture.current?.commit();
    },
    redo() {
      capture.current?.cancel();
      playback.current?.stop();                 // the voice turn is abandoned: nothing will say whether to resume Mike
      dispatch({ type: "local/voice_turn_dropped" });
      send({ type: "redo_answer" });
    },
    flag(feedbackId: string, flagId: string, action: "confirm" | "dismiss" | "restore") {
      send({ type: "flag_action", feedback_id: feedbackId, flag_id: flagId, action });
    },
    stronger(feedbackId: string) {
      dispatch({ type: "local/stronger_requested", feedbackId });
      send({ type: "request_stronger", feedback_id: feedbackId });
    },
    /** "Edit what I said": each changed answer is checked again on the server (the old feedback stays until it is there). */
    recheck(edits: RecheckEdit[]) {
      if (!edits.length) return;
      if (ws.current?.readyState !== WebSocket.OPEN) {
        dispatch({ type: "recheck_failed", feedback_id: edits[0]!.feedbackId, code: "connection_lost", message: t("session.edit.failed") });
        return;
      }
      dispatch({ type: "local/recheck_requested", feedbackIds: edits.map((e) => e.feedbackId) });
      edits.forEach((e) => send({ type: "recheck", feedback_id: e.feedbackId, text: e.text, ...(e.flagId ? { flag_id: e.flagId } : {}) }));
    },
    dismissRecheckError() {
      dispatch({ type: "local/dismiss_recheck_error" });
    },
    setSuggest(on: boolean) {
      dispatch({ type: "local/suggest", on });
      send({ type: "suggest", on });
    },
    switchToText() {
      stopMic();
      send({ type: "input_mode", input: "text" });
      dispatch({ type: "local/input_changed", input: "text" });
    },
    /** D64: back to voice in the same session; the mic starts from the live-phase effect, and a failure falls back to
     * text with the reason, as at start. */
    switchToVoice() {
      ensureAudio();
      if (configRef.current.start.input === "text") browserRef.current = prefs.stt() === "browser" && browserSttSupported();
      const input = browserRef.current ? "browser_stt" : "voice";
      setMicError(null);
      send({ type: "input_mode", input });
      dispatch({ type: "local/input_changed", input });
    },
    /** D66: "Try again" in the mic help — ask for the mic afresh (the user may have just allowed it). In voice the
     * live-phase effect restarts it once the old capture is gone; from text it is the switch to voice. */
    retryMic() {
      stopMic();
      setMicError(null);
      if (stateRef.current.input === "text") {
        ensureAudio();
        const input = browserRef.current ? "browser_stt" : "voice";
        send({ type: "input_mode", input });
        dispatch({ type: "local/input_changed", input });
      } else void startMic();
    },
    /** US-13 AC5: pick the session up again. The engine came back with the socket still open: just carry on. The
     * connection is gone: a new socket continues the saved session, by voice or (`"text"`) by typing. */
    resume(wanted?: "text") {
      const s = stateRef.current;
      const paused = s.interrupted;
      if (!paused || paused.resuming) return;
      const socketOpen = ws.current?.readyState === WebSocket.OPEN && !paused.ended;
      if (wanted === "text") {
        stopMic();
        if (socketOpen) send({ type: "input_mode", input: "text" });
      }
      if (socketOpen) {
        if (wanted === "text") dispatch({ type: "local/input_changed", input: "text" });
        dispatch({ type: "local/resumed_in_place" });
        return;
      }
      const input: InputMode = wanted === "text" || s.input === "text" ? "text" : browserRef.current ? "browser_stt" : "voice";
      if (input !== "text") {
        ensureAudio();
        setMicError(null);
      }
      dispatch({ type: "local/resume_requested", input });
      openSocket({ ...configRef.current.start, input, resume_session_id: s.sessionId });
    },
    dismissNotice() {
      dispatch({ type: "local/dismiss_notice" });
    },
    dismissError() {
      dispatch({ type: "local/dismiss_error" });
    },
    end,
  }), [send, stopMic, startMic, ensureAudio, openSocket, end, muted]);

  const getLevel = useCallback(() => level.current, []);

  return { state, playing, muted, micError, actions, getLevel };
}
