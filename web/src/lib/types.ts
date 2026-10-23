/* Types for the REST API and the session WebSocket protocol (app/server/PROTOCOL.md, data_version 1). */

export type EngineId = "ollama" | "openai_compatible" | "claude_cli" | "codex_cli" | "antigravity_cli" | "gemini_live";
export type StatusCode =
  | "ready" | "unverified" | "not_installed" | "not_running" | "no_model" | "not_configured" | "unreachable"
  | "unauthorized" | "billing_required" | "disconnected" | "error";

export interface EngineStatus {
  code: StatusCode;
  ready: boolean;
  message: string;
  hint: string;
  hint_command: string;
  fix_url: string;
  model: string;
  warnings: string[];
}

export interface EngineInfo {
  id: EngineId;
  name: string;
  kind: "text" | "live";
  local: boolean;
  cost: string;
  data_line: string;
  needs: string[];
  terms_note: string;
  privacy_note: string;
  setup_url: string;
  status: EngineStatus;
  selected: boolean;
}

export interface EnginesResponse { selected: EngineId; engines: EngineInfo[] }

export interface OllamaModel { name: string; size: number | null; thinking_only: boolean }
export interface OllamaModelsResponse {
  models: OllamaModel[];
  recommended: string;
  recommended_voice: string;
  ram_gb?: number;
  selected?: string;
  selected_voice?: string;
  status?: EngineStatus;
}

/** POST /engines/{id}/connect (D83): the fresh status after looking for the installed engine (and starting Ollama). */
export interface EngineConnectResult {
  status: EngineStatus;
  started: boolean;
}

/** The Ollama model download (D85): one at a time, run by the server in the background. */
export interface OllamaPull {
  model: string;
  state: "idle" | "pulling" | "done" | "error" | "cancelled";
  phase: "" | "manifest" | "download" | "verify";
  error: string;
  completed: number;
  total: number;
  recommended: string;
  options: { model: string; size_gb: number }[];
}

export interface EngineTestResult {
  ok: boolean;
  status: EngineStatus;
  latency_ms?: number;
  reply?: string;
  code?: string;
  message?: string;
}

export type Level = "A2" | "B1" | "B2" | "C1";
export type LayerOrder = "content-first" | "delivery-first";

export interface Settings {
  engine: EngineId;
  ollama: { url: string; model: string; voice_model: string };
  openai_compatible: { base_url: string; model: string; has_api_key: boolean };
  claude_cli: { model: string };
  codex_cli: { model: string };
  antigravity_cli: { model: string };
  gemini_live: { model: string; text_model: string; voice: string; has_api_key: boolean };
  voice: string;
  kokoro_speed: number;
  stt: { backend: "auto" | "mlx" | "faster_whisper" | "none"; model: string };
  answer_suggester: boolean;
  telemetry_opt_in: boolean;
  obsidian_dir: string;
  layer_order: LayerOrder;
  level: Level;
  strictness: 1 | 2 | 3;
  questions_per_session: number;
  /** D80: how Mike addresses the user; "" = no name ("You" in the app). */
  name: string;
}

export interface SettingsPatch {
  engine?: EngineId;
  ollama?: Partial<{ url: string; model: string; voice_model: string }>;
  openai_compatible?: Partial<{ base_url: string; api_key: string; model: string }>;
  claude_cli?: Partial<{ model: string }>;
  codex_cli?: Partial<{ model: string }>;
  antigravity_cli?: Partial<{ model: string }>;
  gemini_live?: Partial<{ api_key: string; model: string; text_model: string; voice: string }>;
  voice?: string;
  kokoro_speed?: number;
  stt?: Partial<{ backend: Settings["stt"]["backend"]; model: string }>;
  answer_suggester?: boolean;
  telemetry_opt_in?: boolean;
  obsidian_dir?: string;
  layer_order?: LayerOrder;
  name?: string;
  level?: Level;
  strictness?: number;
  questions_per_session?: number;
}

export interface Health { ok: boolean; version: string; data_version: number; data_dir: string; web_built: boolean; /** US-23 AC4: a probe write into the data folder worked. */ storage_ok?: boolean }

export interface Voice { id: string; label: string; locale: string; gender: string }
/** POST /api/check/voice (D81). `audio`: Mike's reply as base64 WAV, null when speech is off. */
export interface VoiceCheckResult { ok: boolean; heard: string; reply?: string; audio?: string | null; code?: string; message?: string; latency_ms?: number }
export interface VoicesResponse { voices: Voice[]; default: string; tts: { available: boolean; [k: string]: unknown } }
export interface SttInfo { available: boolean; backend: string; word_confidence?: boolean; model?: string }

/** D79: the CV is several files plus a pasted note; `text` joins them (what Mike reads). */
export interface ProfileFile { id: string; name: string; chars: number; added: string }
export interface Profile { text: string; source: string; updated: string; note: string; files: ProfileFile[] }

export interface VacancySummary { id: string; title: string; created_at: string; source: string; questions: number }
export interface Question {
  id: string;
  competency: string;
  text: string;
  follow_ups?: { tag: string; text: string }[];
  source?: string;
  anchor?: string;
}
export interface Vacancy { id: string; title: string; text: string; source: string; created_at: string; questions: Question[] }

export interface SessionSummary {
  id: string;
  title: string;
  mode: "interview" | "english" | "";
  started_at: string;
  duration_s: number | null;
  engine: string;
  answers: number;
  verdict: string;
  /** D69: the debrief said the session was too short (fewer than 3 answers). */
  too_short?: boolean;
  /** Main questions planned for the session. */
  planned?: number;
  /** The first main question asked — tells apart sessions with the same title. */
  first_question?: string;
  /** D80: in the Archive, not in Recents. */
  archived?: boolean;
}
export interface TrashItem { trash_id: string; id: string; title: string; started_at: string; deleted_at: string }

export interface TranscriptTurn { role: "user" | "model"; text: string; question_id?: string; kind?: string }

export interface SessionRecord {
  id: string;
  mode: "interview" | "english";
  round_type?: string;
  engine: string;
  model?: string;
  level?: Level;
  strictness?: number;
  input?: string;
  vacancy_id?: string;
  vacancy_title?: string;
  started_at: string;
  ended_at?: string;
  duration_s?: number;
  title: string;
  questions: Question[];
  transcript: TranscriptTurn[];
  feedback: FeedbackRecord[];
  debrief: Debrief | null;
  stats?: { answers: number; turns: number };
  /** D88: requests this session sent, and how far the plan's own counter moved (Codex, Claude). */
  usage?: SessionUsage;
  /** D96: present while the feedback and the debrief are still being made after the call. */
  post_call?: PostCall;
}

/** Where the work after the call stands: `feedback` (answer by answer), then `debrief`. */
export interface PostCall {
  state: "running";
  stage: "feedback" | "debrief";
  done: number;
  total: number;
}

export interface SessionUsage {
  engine: string;
  requests: number;
  windows?: { id: string; before: number; after: number }[];
}

/** D88: the plan limit Settings → AI engine shows. Codex and Claude report a percent; Antigravity and Gemini publish
 * no number, so Vukoli shows its own count of requests. */
export interface LimitWindow {
  id: string;
  used_percent: number;
  resets_at: string | null;
  /** The window has reset since the plan last reported it (Claude reports only on a request). */
  stale: boolean;
}

export type EngineLimits =
  | { engine: EngineId; kind: "none" }
  | { engine: EngineId; kind: "pending" }
  | {
    engine: EngineId; kind: "percent"; plan: string; as_of: string; windows: LimitWindow[];
    estimate: { sessions: number; at_least: boolean; window: string } | null;
  }
  | { engine: EngineId; kind: "count"; period: "week" | "day"; requests: number; resets_at?: string };

export interface MemorySummary {
  sessions_considered: number;
  total_sessions: number;
  weak_spots: { tag: string; layer: LayerName; sessions: number; text?: string }[];
}

export interface TelemetryInfo { opt_in: boolean; events: number; file: string; remote: boolean; what: string }

/* ---------- feedback ---------- */

export type LayerName = "content" | "language" | "delivery";
export type LayerStatus = "ok" | "fix" | "unavailable" | "pending" | string;

export interface LowConfWord { w: string; start?: number; end?: number; p?: number }

export interface DeliveryMetrics {
  words?: number;
  fillers?: number;
  fillers_per_100w?: number;
  restarts?: number;
  seconds?: number;
  wpm?: number;
  long_pauses?: number;
  mode?: "voice" | "text";
  fillers_note?: string;
  not_available?: string[];
}

export type FlagStatus = "active" | "unconfirmed" | "confirmed" | "dismissed";

export interface LanguageItem {
  id: string;
  tag: string;
  original: string;
  heard_as?: string;
  better: string[];
  reason: string;
  level?: string;
  severity: number;
  possibly_misheard?: boolean;
  status: FlagStatus;
}

export interface LayerBase {
  layer?: LayerName;
  status: LayerStatus;
  severity?: number;
  tag?: string;
  fix?: string;
  code?: string;
}
export interface DeliveryLayer extends LayerBase { metrics?: DeliveryMetrics }
export interface LanguageLayer extends LayerBase {
  reason?: string;
  possibly_misheard?: number;
  items?: LanguageItem[];
  phrase_to_keep?: { phrase: string; why: string };
}
export interface ContentLayer extends LayerBase {
  evidence?: string;
  praise?: string;
  tips?: string[];
  missing?: string[];
}

export interface StrongerVersion { rewrite: string; placeholders: string[] }

export interface FeedbackRecord {
  id: string;
  turn_id: number | null;
  question: string;
  question_id: string;
  competency: string;
  answer_kind: "main" | "follow_up" | "turn";
  answer: string;
  source: string;
  created_at?: string;
  complete: boolean;
  cascade?: string;
  heard_as_words?: LowConfWord[];
  stronger?: StrongerVersion;
  /** The user corrected what they said ("Edit what I said"): the feedback was made again from this text. */
  edited?: boolean;
  layers: { delivery?: DeliveryLayer; language?: LanguageLayer; content?: ContentLayer };
}

export interface WeakSpot { layer: LayerName; tag: string; text: string; evidence?: string[] }
export interface Debrief {
  verdict: string;
  weak_spots: WeakSpot[];
  strength: string;
  next_step: string;
  source: "model" | "template" | string;
  too_short?: boolean;
}

/* ---------- WebSocket: client -> server ---------- */

export type InputMode = "voice" | "browser_stt" | "text";

export interface StartMessage {
  type: "start";
  mode: "interview" | "english";
  round_type?: "hr" | "behavioural" | "mix";
  questions?: number;
  strictness?: number;
  level?: Level;
  input: InputMode;
  vacancy_id?: string;
  voice?: string;
  speak: boolean;
  suggest: boolean;
  topic?: string;
  /** A weak-spot drill (interview only): the saved session is named "Drill · …". */
  drill?: boolean;
  engine?: EngineId;
  /** US-13 AC5: continue this saved session (after a dropped connection) instead of starting a new one. */
  resume_session_id?: string;
}

export type ClientMessage =
  | StartMessage
  /** `manual`: the Interrupt button, so Mike stops for good (no waiting to see whether it was speech). */
  | { type: "activity_start"; turn_id: number; manual?: boolean }
  | { type: "audio_stream_end" }
  /** Browser recognition heard nothing in a voice turn opened by activity_start. */
  | { type: "activity_cancel"; turn_id?: number }
  | { type: "user_turn"; text: string; turn_id: number; source: "text" | "browser_stt" }
  | { type: "redo_answer" }
  | { type: "suggest"; on: boolean }
  | { type: "request_stronger"; feedback_id: string }
  | { type: "recheck"; feedback_id: string; text: string; flag_id?: string }
  | { type: "flag_action"; feedback_id: string; flag_id: string; action: "confirm" | "dismiss" | "restore" }
  | { type: "input_mode"; input: InputMode }
  | { type: "silence" }
  | { type: "ping"; t: number }
  | { type: "end_session" };

/* ---------- WebSocket: server -> client ---------- */

export type TurnKind = "question" | "follow_up" | "wait" | "repeat" | "closing" | "ack" | "turn";

export interface ServerError {
  type: "error";
  code: string;
  message: string;
  hint?: string;
  retryable?: boolean;
  hint_command?: string;
  fix_url?: string;
  engine?: string;
}

export type ServerMessage =
  | {
      type: "session_started";
      session_id: string;
      mode: "interview" | "english";
      engine: string;
      model: string;
      speaks: boolean;
      questions: Question[];
      audio: { sample_rate_out: number; sample_rate_in: number };
      stt: SttInfo;
      suggester_available: boolean;
      suggest: boolean;
      warnings: string[];
    }
  | { type: "ready" }
  | { type: "turn_start"; speaker: "model" }
  | { type: "transcript_delta"; speaker: "model" | "user"; delta: string; full_text: string }
  | {
      type: "turn_complete";
      speaker: "model" | "user";
      full_text: string;
      kind?: TurnKind;
      question_id?: string;
      thread_id?: string;
      turn_id?: number | null;
      interrupted?: boolean;
    }
  | { type: "response_complete" }
  /** Speech: Mike's reply is cut off. `turn_id`: the voice turn that proved to be speech (none: all open turns). */
  | { type: "interrupted"; turn_id?: number }
  /** The voice turn was no speech (noise, Whisper's "Thank you." on silence, Mike's echo): Mike's reply goes on.
   * Exactly one of `interrupted` / `voice_turn_dropped` closes every activity_start. */
  | { type: "voice_turn_dropped"; turn_id?: number }
  /** Not a verdict: the live captions of a long turn stay empty, so it no longer holds Mike back. */
  | { type: "voice_turn_noise"; turn_id: number }
  | { type: "speech_preview"; turn_id: number; text: string }
  | { type: "user_transcript"; turn_id: number; text: string; backend?: string; low_conf?: LowConfWord[] }
  | { type: "notice"; code: string; message: string }
  | { type: "turn_metrics"; turn_id?: number; total_ms?: number; first_text_ms?: number; path?: string }
  /** D96: feedback is made after End. `done` of `total` answers are finished (done 0 opens the work). */
  | { type: "feedback_progress"; done: number; total: number }
  | { type: "feedback"; feedback: FeedbackRecord }
  | { type: "feedback_unavailable"; feedback_id: string; code: string; message: string }
  | { type: "flag_updated"; feedback_id: string; flag: LanguageItem; language: LanguageLayer }
  | { type: "stronger_version"; feedback_id: string; rewrite: string; placeholders: string[] }
  | { type: "stronger_unavailable"; feedback_id: string; code: string; message: string }
  | { type: "answer_reset"; question: string; removed_feedback_ids: string[] }
  | { type: "answer_edited"; feedback_id: string; turn_id: number | null; text: string }
  | { type: "recheck_failed"; feedback_id: string; code: string; message: string }
  | { type: "suggestion_pending"; question: string }
  | { type: "suggestion"; question: string; story: string; answer: string; points: string[] }
  | { type: "suggestion_unavailable"; question: string; code: string; message: string }
  | { type: "saving" }
  | { type: "session_saved"; session_id: string }
  | { type: "debrief_pending"; session_id: string }
  | { type: "debrief"; session_id: string; debrief: Debrief }
  | { type: "session_ended"; saved: boolean; reason: string }
  | { type: "save_error"; code: string; message: string }
  | ServerError
  | { type: "pong"; t: number };
