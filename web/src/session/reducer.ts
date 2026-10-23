/* Pure session state: every server message (PROTOCOL.md) and local action goes through `sessionReducer`.
 * No I/O here, so it is unit-tested in reducer.test.ts. useSession.ts wires it to the socket and audio. */
import type {
  Debrief, FeedbackRecord, InputMode, LanguageItem, LowConfWord, Question, ServerError, ServerMessage, SttInfo, TurnKind,
} from "../lib/types";

/** Start-time engine codes and end-of-session codes: the session cannot continue. */
export const FATAL_CODES = new Set([
  "bad_start", "not_installed", "not_running", "no_model", "not_configured", "unreachable", "unauthorized",
  "billing_required", "connection_lost", "session_failed",
]);

export type Phase =
  | "connecting" // socket open, waiting for session_started
  | "live"
  | "ending" // end_session sent
  | "saving"
  | "debrief_pending"
  | "done" // debrief arrived, or nothing to save
  | "failed";

/** US-13 AC5 / US-04: a live session the user can pick up again. `engine`: the AI engine stopped answering ("Resume"
 * turns on when it is back); `voice`: the connection to the server dropped. */
export interface Interruption {
  kind: "engine" | "voice";
  code: string;
  message: string;
  /** The server has finished with this socket (saving, closed): resuming needs a new socket and the saved record. */
  ended: boolean;
  /** A new socket is being opened to continue the saved session. */
  resuming?: boolean;
  /** The last try to continue failed (the server's words, or "" for a plain "could not connect"). */
  failed?: string;
}

/** Codes of a dead engine / session: the user can wait for it and resume. `connection_lost`: the socket itself. */
const ENDS_SOCKET = new Set(["connection_lost", "session_failed", "resume_unavailable"]);

export interface TranscriptItem {
  key: string;
  speaker: "model" | "user";
  text: string;
  kind?: TurnKind;
  threadId?: string;
  turnId?: number;
  interrupted?: boolean;
  /** Model line still streaming. */
  live?: boolean;
  lowConf?: LowConfWord[];
}

export interface StrongerState {
  status: "loading" | "ready" | "unavailable";
  rewrite?: string;
  placeholders?: string[];
  message?: string;
}

export interface SuggestionState {
  status: "pending" | "ready" | "unavailable";
  question: string;
  story?: string;
  answer?: string;
  points?: string[];
  message?: string;
}

export interface SessionState {
  phase: Phase;
  input: InputMode;
  sessionId: string;
  mode: "interview" | "english";
  engine: string;
  model: string;
  speaks: boolean;
  questions: Question[];
  stt: SttInfo | null;
  suggesterAvailable: boolean;
  suggestOn: boolean;
  warnings: string[];
  ready: boolean;
  /** Mike's turn is open (turn_start .. response_complete). */
  mikeTurnOpen: boolean;
  /** A user answer was sent and Mike has not started replying yet. */
  awaitingReply: boolean;
  /** The user is recording a voice answer (set locally on activity_start). */
  recording: boolean;
  recordingTurnId: number | null;
  /** Voice turns (activity_start) that have no verdict yet; each gets exactly one: interrupted or voice_turn_dropped. */
  openVoiceTurns: number[];
  /** `awaitingReply` as it was when the voice turn started: what a dropped turn goes back to. */
  awaitingBeforeVoice: boolean;
  preview: string;
  transcript: TranscriptItem[];
  /** Main-question thread ids in the order Mike asked them. */
  threadOrder: string[];
  currentThreadId: string;
  /** Follow-up lines asked in the current thread. */
  followUps: string[];
  currentQuestionText: string;
  closing: boolean;
  /** Which thread each user turn answered (turn_id -> thread id). */
  threadOfTurn: Record<number, string>;
  feedback: Record<string, FeedbackRecord>;
  feedbackOrder: string[];
  /** D96: feedback is made after End. Where that work is: answers done of the total (null before it starts). */
  feedbackProgress: { done: number; total: number } | null;
  unavailable: Record<string, { code: string; message: string; threadId: string }>;
  stronger: Record<string, StrongerState>;
  /** "Edit what I said": feedback ids being checked again (the old feedback stays until the new one is there). */
  rechecking: Record<string, true>;
  /** The last check-again that failed; the editor shows it. */
  recheckError: { feedbackId: string; code: string; message: string } | null;
  suggestion: SuggestionState | null;
  notice: { code: string; message: string } | null;
  error: ServerError | null;
  fatal: ServerError | null;
  savedSessionId: string;
  debrief: Debrief | null;
  saveError: string;
  endedReason: string;
  lastTurnMs: number | null;
  /** Set while the session is paused by a dropped connection or a dead engine (US-13 AC5). */
  interrupted: Interruption | null;
}

/** The open voice turns after a verdict for `turn` (none: for all of them). */
function settle(open: number[], turn: number | undefined): number[] {
  return turn === undefined ? [] : open.filter((id) => id !== turn);
}

export function initialState(input: InputMode, mode: "interview" | "english" = "interview"): SessionState {
  return {
    phase: "connecting", input, sessionId: "", mode, engine: "", model: "", speaks: false, questions: [], stt: null,
    suggesterAvailable: false, suggestOn: false, warnings: [], ready: false, mikeTurnOpen: false, awaitingReply: false,
    recording: false, recordingTurnId: null, openVoiceTurns: [], awaitingBeforeVoice: false, preview: "", transcript: [], threadOrder: [], currentThreadId: "",
    followUps: [], currentQuestionText: "", closing: false, threadOfTurn: {}, feedback: {}, feedbackOrder: [],
    feedbackProgress: null, unavailable: {}, stronger: {}, rechecking: {}, recheckError: null, suggestion: null, notice: null, error: null, fatal: null,
    savedSessionId: "", debrief: null, saveError: "", endedReason: "", lastTurnMs: null, interrupted: null,
  };
}

export type LocalAction =
  | { type: "local/voice_turn_started"; turnId: number }
  | { type: "local/voice_turn_sent" }
  | { type: "local/voice_turn_dropped"; turnId?: number }
  | { type: "local/user_turn"; turnId: number; text: string }
  | { type: "local/stronger_requested"; feedbackId: string }
  | { type: "local/recheck_requested"; feedbackIds: string[] }
  | { type: "local/dismiss_recheck_error" }
  | { type: "local/suggest"; on: boolean }
  | { type: "local/end_requested" }
  | { type: "local/input_changed"; input: InputMode }
  | { type: "local/socket_closed" }
  /** "Resume" with the socket still open (the engine was down, the connection was not). */
  | { type: "local/resumed_in_place" }
  /** "Resume" over a new socket that continues the saved session. */
  | { type: "local/resume_requested"; input: InputMode }
  | { type: "local/client_error"; code: string; message: string }
  | { type: "local/dismiss_notice" }
  | { type: "local/dismiss_error" };

export type SessionAction = ServerMessage | LocalAction;

let keySeq = 0;
const nextKey = (prefix: string) => `${prefix}-${++keySeq}`;

/** The user has answered at least once and the round is not over: there is something to pick up again. */
function interruptible(state: SessionState): boolean {
  return state.phase === "live" && !!state.sessionId && !state.closing && !state.fatal
    && state.transcript.some((x) => x.speaker === "user");
}

/** The server finished with the socket while the session was interrupted. */
function ended(state: SessionState): SessionState {
  return state.interrupted && !state.interrupted.ended ? { ...state, interrupted: { ...state.interrupted, ended: true } } : state;
}

function upsertUser(transcript: TranscriptItem[], turnId: number | undefined | null, text: string, threadId: string,
  lowConf?: LowConfWord[]): TranscriptItem[] {
  const idx = turnId == null ? -1 : transcript.findIndex((t) => t.speaker === "user" && t.turnId === turnId);
  if (idx >= 0) {
    const copy = transcript.slice();
    const prev = copy[idx]!;
    copy[idx] = { ...prev, text, lowConf: lowConf ?? prev.lowConf };
    return copy;
  }
  return [...transcript, { key: nextKey("u"), speaker: "user", text, turnId: turnId ?? undefined, threadId, lowConf }];
}

function applyFlag(record: FeedbackRecord, flag: LanguageItem, language?: FeedbackRecord["layers"]["language"]): FeedbackRecord {
  const base = language ?? record.layers.language;
  if (!base) return record;
  const items = (base.items ?? []).map((i) => (i.id === flag.id ? { ...i, ...flag } : i));
  return { ...record, layers: { ...record.layers, language: { ...base, items } } };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    /* ---------- lifecycle ---------- */
    case "session_started":
      return {
        ...state,
        // Continuing a saved session: the transcript and feedback stay, what the cut-off left behind goes.
        ...(state.interrupted ? { interrupted: null, fatal: null, error: null, savedSessionId: "", debrief: null, saveError: "",
          endedReason: "", mikeTurnOpen: false, awaitingReply: false, recording: false, openVoiceTurns: [], notice: null,
          feedbackProgress: null } : null),
        phase: "live", sessionId: action.session_id, mode: action.mode, engine: action.engine,
        model: action.model, speaks: action.speaks, questions: action.questions, stt: action.stt,
        suggesterAvailable: action.suggester_available, suggestOn: action.suggest, warnings: action.warnings ?? [],
      };
    case "ready":
      return { ...state, ready: true };

    /* ---------- Mike's turns ---------- */
    case "turn_start":
      return {
        ...state, mikeTurnOpen: true, awaitingReply: false, notice: null, error: null,
        transcript: [...state.transcript, { key: nextKey("m"), speaker: "model", text: "", live: true }],
      };
    case "transcript_delta": {
      if (action.speaker === "user") {
        // Gemini Live: user captions arrive as deltas.
        if (state.recording) return { ...state, preview: action.full_text };
        return state;
      }
      const transcript = state.transcript.slice();
      let idx = -1;
      for (let i = transcript.length - 1; i >= 0; i--) {
        if (transcript[i]!.speaker === "model" && transcript[i]!.live) { idx = i; break; }
      }
      if (idx < 0) transcript.push({ key: nextKey("m"), speaker: "model", text: action.full_text, live: true });
      else transcript[idx] = { ...transcript[idx]!, text: action.full_text };
      return { ...state, transcript, awaitingReply: false };
    }
    case "turn_complete": {
      if (action.speaker === "user") {
        const threadId = state.currentThreadId;
        const turnId = action.turn_id ?? undefined;
        return {
          ...state,
          transcript: upsertUser(state.transcript, turnId, action.full_text, threadId),
          threadOfTurn: turnId == null ? state.threadOfTurn : { ...state.threadOfTurn, [turnId]: threadId },
          preview: "",
        };
      }
      const kind = action.kind;
      const threadId = action.thread_id || action.question_id || "";
      const transcript = state.transcript.slice();
      let idx = -1;
      for (let i = transcript.length - 1; i >= 0; i--) {
        if (transcript[i]!.speaker === "model" && transcript[i]!.live) { idx = i; break; }
      }
      const item: TranscriptItem = {
        key: idx >= 0 ? transcript[idx]!.key : nextKey("m"), speaker: "model", text: action.full_text, kind,
        threadId: threadId || undefined, interrupted: action.interrupted, live: false,
      };
      if (idx >= 0) transcript[idx] = item;
      else transcript.push(item);
      let next: SessionState = { ...state, transcript };
      if (kind === "question" && threadId) {
        const isNew = !state.threadOrder.includes(threadId);
        const q = state.questions.find((x) => x.id === (action.question_id || threadId));
        next = {
          ...next,
          threadOrder: isNew ? [...state.threadOrder, threadId] : state.threadOrder,
          currentThreadId: threadId,
          currentQuestionText: q?.text ?? action.full_text,
          followUps: isNew ? [] : state.followUps,
          suggestion: isNew ? null : state.suggestion,
        };
      } else if (kind === "follow_up") {
        next = { ...next, followUps: [...state.followUps, action.full_text] };
        if (threadId && !state.currentThreadId) next.currentThreadId = threadId;
      } else if (kind === "turn") {
        // English mode: each coach line is its own "question".
        next = { ...next, currentQuestionText: action.full_text };
      } else if (kind === "closing") {
        next = { ...next, closing: true };
      }
      return next;
    }
    case "response_complete":
      return {
        ...state, mikeTurnOpen: false,
        transcript: state.transcript.map((t) => (t.live ? { ...t, live: false } : t)),
      };
    case "interrupted":
      return {
        ...state, mikeTurnOpen: false, openVoiceTurns: settle(state.openVoiceTurns, action.turn_id),
        transcript: state.transcript.map((t) => (t.live ? { ...t, live: false, interrupted: true } : t)),
      };

    /* ---------- the user's side ---------- */
    case "local/voice_turn_started":
      return {
        ...state, recording: true, recordingTurnId: action.turnId,
        // What a dropped turn goes back to is what it was before the first of the open turns (not a later turn's own wait).
        awaitingBeforeVoice: state.openVoiceTurns.length ? state.awaitingBeforeVoice : state.awaitingReply,
        openVoiceTurns: [...state.openVoiceTurns.filter((id) => id !== action.turnId), action.turnId],
        preview: "", notice: null,
        threadOfTurn: { ...state.threadOfTurn, [action.turnId]: state.currentThreadId },
      };
    case "local/voice_turn_sent":
      return { ...state, recording: false, awaitingReply: true };
    case "local/voice_turn_dropped":
      // The server still answers with a verdict for a turn id (activity_cancel); redo has none: all turns are void.
      return {
        ...state, recording: false, recordingTurnId: null, preview: "",
        openVoiceTurns: action.turnId === undefined ? [] : state.openVoiceTurns,
      };
    case "voice_turn_dropped": {
      // A verdict for a turn that is not open (a second one, or one from before a reconnect) changes nothing.
      if (action.turn_id !== undefined && !state.openVoiceTurns.includes(action.turn_id)) return state;
      const open = settle(state.openVoiceTurns, action.turn_id);
      // Another voice turn is still open: it decides what Mike does, this one only leaves the list.
      if (open.length) return { ...state, openVoiceTurns: open };
      // No answer was given: Mike is as busy (or as idle) as before the clip.
      return {
        ...state, openVoiceTurns: open, recording: false, recordingTurnId: null, preview: "",
        awaitingReply: state.awaitingBeforeVoice,
      };
    }
    case "local/user_turn": {
      const threadId = state.currentThreadId;
      return {
        ...state,
        transcript: upsertUser(state.transcript, action.turnId, action.text, threadId),
        threadOfTurn: { ...state.threadOfTurn, [action.turnId]: threadId },
        awaitingReply: true, recording: false, preview: "", notice: null,
      };
    }
    case "speech_preview":
      return state.recording || state.recordingTurnId === action.turn_id ? { ...state, preview: action.text } : state;
    case "user_transcript": {
      const threadId = state.threadOfTurn[action.turn_id] ?? state.currentThreadId;
      return {
        ...state,
        transcript: upsertUser(state.transcript, action.turn_id, action.text, threadId, action.low_conf),
        threadOfTurn: { ...state.threadOfTurn, [action.turn_id]: threadId },
        preview: "",
      };
    }
    case "notice":
      return { ...state, notice: { code: action.code, message: action.message }, awaitingReply: action.code === "not_heard" ? false : state.awaitingReply };
    case "turn_metrics":
      return { ...state, lastTurnMs: action.total_ms ?? state.lastTurnMs };

    /* ---------- feedback ---------- */
    case "feedback_progress":
      return { ...state, feedbackProgress: { done: action.done, total: action.total } };
    case "feedback": {
      const record = action.feedback;
      return {
        ...state,
        feedback: { ...state.feedback, [record.id]: record },
        feedbackOrder: state.feedbackOrder.includes(record.id) ? state.feedbackOrder : [...state.feedbackOrder, record.id],
      };
    }
    case "feedback_unavailable": {
      const threadId = state.currentThreadId;
      return {
        ...state,
        unavailable: { ...state.unavailable, [action.feedback_id]: { code: action.code, message: action.message, threadId } },
        feedbackOrder: state.feedbackOrder.includes(action.feedback_id) ? state.feedbackOrder : [...state.feedbackOrder, action.feedback_id],
      };
    }
    case "flag_updated": {
      const record = state.feedback[action.feedback_id];
      if (!record) return state;
      return { ...state, feedback: { ...state.feedback, [record.id]: applyFlag(record, action.flag, action.language) } };
    }
    case "local/stronger_requested":
      return { ...state, stronger: { ...state.stronger, [action.feedbackId]: { status: "loading" } } };
    case "stronger_version":
      return {
        ...state,
        stronger: { ...state.stronger, [action.feedback_id]: { status: "ready", rewrite: action.rewrite, placeholders: action.placeholders } },
      };
    case "stronger_unavailable":
      return { ...state, stronger: { ...state.stronger, [action.feedback_id]: { status: "unavailable", message: action.message } } };
    case "local/recheck_requested": {
      const rechecking = { ...state.rechecking };
      action.feedbackIds.forEach((id) => { rechecking[id] = true; });
      return { ...state, rechecking, recheckError: null };
    }
    case "local/dismiss_recheck_error":
      return { ...state, recheckError: null };
    case "answer_edited": {
      const rechecking = { ...state.rechecking };
      delete rechecking[action.feedback_id];
      const stronger = { ...state.stronger };
      delete stronger[action.feedback_id];           // the old stronger answer was for the old words
      return {
        ...state, rechecking, stronger,
        transcript: action.turn_id == null ? state.transcript
          : state.transcript.map((t) => (t.speaker === "user" && t.turnId === action.turn_id ? { ...t, text: action.text, lowConf: undefined } : t)),
      };
    }
    case "recheck_failed": {
      const rechecking = { ...state.rechecking };
      delete rechecking[action.feedback_id];
      return { ...state, rechecking, recheckError: { feedbackId: action.feedback_id, code: action.code, message: action.message } };
    }
    case "answer_reset": {
      const removed = new Set(action.removed_feedback_ids);
      const feedback = { ...state.feedback };
      removed.forEach((id) => { delete feedback[id]; });
      let lastUser = -1;
      for (let i = state.transcript.length - 1; i >= 0; i--) {
        if (state.transcript[i]!.speaker === "user") { lastUser = i; break; }
      }
      return {
        ...state, feedback,
        feedbackOrder: state.feedbackOrder.filter((id) => !removed.has(id)),
        transcript: lastUser >= 0 ? state.transcript.slice(0, lastUser) : state.transcript,
        awaitingReply: false,
      };
    }

    /* ---------- suggester ---------- */
    case "local/suggest":
      return { ...state, suggestOn: action.on, suggestion: action.on ? state.suggestion : null };
    case "suggestion_pending":
      return { ...state, suggestion: { status: "pending", question: action.question } };
    case "suggestion":
      return {
        ...state,
        suggestion: { status: "ready", question: action.question, story: action.story, answer: action.answer, points: action.points },
      };
    case "suggestion_unavailable":
      return { ...state, suggestion: { status: "unavailable", question: action.question, message: action.message } };

    /* ---------- end ---------- */
    case "local/end_requested":
      return state.phase === "live" || state.phase === "connecting" ? { ...state, phase: "ending", interrupted: null } : { ...state, interrupted: null };
    case "saving":
      return { ...ended(state), phase: "saving", recording: false, openVoiceTurns: [] };
    case "session_saved":
      return { ...ended(state), savedSessionId: action.session_id };
    case "debrief_pending":
      return { ...ended(state), phase: "debrief_pending", savedSessionId: action.session_id || state.savedSessionId };
    case "debrief":
      return { ...ended(state), phase: "done", debrief: action.debrief, savedSessionId: action.session_id || state.savedSessionId };
    case "session_ended":
      return { ...ended(state), phase: "done", endedReason: action.reason };
    case "save_error":
      // Nothing was written (US-23 AC4: the data folder is not writable): the screen says so and offers the transcript.
      return { ...state, saveError: action.message, phase: "done" };
    case "error": {
      // A try to continue the saved session failed: back to the interrupted card, with the reason.
      if (state.interrupted?.resuming) {
        return {
          ...state, phase: "live",
          interrupted: {
            ...state.interrupted, resuming: false, ended: true, failed: action.message || "",
            kind: action.code === "connection_lost" || action.code === "resume_unavailable" ? state.interrupted.kind : "engine",
            code: action.code,
          },
        };
      }
      // Mid-session, with at least one answer on record: pause and offer to resume instead of ending the screen.
      if (FATAL_CODES.has(action.code) && interruptible(state)) {
        return {
          ...state, recording: false, openVoiceTurns: [], mikeTurnOpen: false,
          interrupted: {
            kind: action.code === "connection_lost" ? "voice" : "engine", code: action.code,
            message: [action.message, action.hint].filter(Boolean).join(" "), ended: ENDS_SOCKET.has(action.code),
          },
        };
      }
      if (FATAL_CODES.has(action.code)) {
        // A fatal error after saving started is not a failure of the save itself.
        if (state.phase === "saving" || state.phase === "debrief_pending") return { ...state, error: action };
        return { ...state, fatal: action, phase: state.phase === "done" ? "done" : "failed", recording: false, openVoiceTurns: [] };
      }
      return { ...state, error: action, awaitingReply: false };
    }
    case "local/client_error":
      return { ...state, error: { type: "error", code: action.code, message: action.message } };
    case "local/socket_closed": {
      if (state.interrupted?.resuming) {
        return { ...state, phase: "live", mikeTurnOpen: false, recording: false, openVoiceTurns: [], interrupted: { ...state.interrupted, resuming: false, ended: true, failed: "" } };
      }
      if (state.interrupted || interruptible(state)) {
        const interrupted = state.interrupted ?? { kind: "voice" as const, code: "connection_lost", message: "", ended: true };
        return { ...state, mikeTurnOpen: false, recording: false, openVoiceTurns: [], interrupted: { ...interrupted, ended: true } };
      }
      if (state.phase === "done" || state.phase === "failed") return { ...state, mikeTurnOpen: false, recording: false, openVoiceTurns: [] };
      if (state.savedSessionId) return { ...state, phase: "done", mikeTurnOpen: false, recording: false, openVoiceTurns: [] };
      return {
        ...state, phase: "failed", mikeTurnOpen: false, recording: false, openVoiceTurns: [],
        fatal: state.fatal ?? { type: "error", code: "connection_lost", message: "" },
      };
    }
    case "local/resumed_in_place":
      return { ...state, interrupted: null, error: null };
    case "local/resume_requested":
      return state.interrupted
        ? { ...state, phase: "connecting", input: action.input, recording: false, openVoiceTurns: [], preview: "", interrupted: { ...state.interrupted, resuming: true, failed: undefined } }
        : state;
    case "local/input_changed":
      return { ...state, input: action.input, recording: false, openVoiceTurns: [], preview: "" };
    case "local/dismiss_notice":
      return { ...state, notice: null };
    case "local/dismiss_error":
      return { ...state, error: null };
    case "pong":
      return state;
    default:
      return state;
  }
}

/* ---------- selectors ---------- */

export interface Thread {
  key: string;
  /** 1-based question number (interview) or turn number (English). */
  number: number;
  question: string;
  records: FeedbackRecord[];
  pendingIds: string[];
  unavailable: { id: string; code: string; message: string }[];
}

/** Group feedback by question thread (owner rule: one panel per thread). English: one thread per answer. */
export function selectThreads(state: SessionState): Thread[] {
  const map = new Map<string, Thread>();
  const order: string[] = [];
  const ensure = (key: string, question: string) => {
    let t = map.get(key);
    if (!t) {
      const idx = state.threadOrder.indexOf(key);
      t = { key, number: idx >= 0 ? idx + 1 : 0, question, records: [], pendingIds: [], unavailable: [] };
      map.set(key, t);
      order.push(key);
    }
    if (!t.question && question) t.question = question;
    return t;
  };
  for (const id of state.feedbackOrder) {
    const record = state.feedback[id];
    const unav = state.unavailable[id];
    if (record) {
      const key = state.mode === "english" ? `t:${record.id}` : record.question_id || "general";
      const t = ensure(key, state.mode === "english" ? record.question : questionText(state, key, record.question));
      t.records.push(record);
      if (!record.complete) t.pendingIds.push(id);       // still being made (a continued session's unfinished answer)
    } else if (unav) {
      const key = state.mode === "english" ? `t:${id}` : unav.threadId || "general";
      ensure(key, questionText(state, key, "")).unavailable.push({ id, code: unav.code, message: unav.message });
    }
  }
  const threads = order.map((k) => map.get(k)!);
  if (state.mode === "english") threads.forEach((t, i) => { t.number = i + 1; });
  return threads;
}

function questionText(state: SessionState, threadId: string, fallback: string) {
  return state.questions.find((q) => q.id === threadId)?.text ?? fallback;
}

export type OrbView = "connecting" | "preparing" | "listening" | "speaking" | "thinking" | "muted" | "your_turn" | "ended";

export function selectOrb(state: SessionState, opts: { playing: boolean; muted: boolean }): OrbView {
  if (state.phase === "connecting") return "connecting";
  if (state.phase !== "live") return "ended";
  if (!state.ready && !state.transcript.length) return "preparing";
  if (state.recording) return "listening";
  if (opts.playing || state.mikeTurnOpen) return "speaking";
  if (state.awaitingReply) return "thinking";
  if (opts.muted && state.input !== "text") return "muted";
  return "your_turn";
}

/** Language items that count now: active or confirmed. Unconfirmed ones are listed separately and never counted. */
export function languageCounts(records: FeedbackRecord[]) {
  let counted = 0;
  let toCheck = 0;
  for (const r of records) {
    for (const item of r.layers.language?.items ?? []) {
      if (item.status === "active" || item.status === "confirmed") counted++;
      else if (item.status === "unconfirmed") toCheck++;
    }
  }
  return { counted, toCheck };
}
