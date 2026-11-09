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
/** Answer of "Sign in" (Claude Code, Codex): `opened` = a terminal window runs the CLI's own sign-in; otherwise show `command`. */
export interface EngineSignInResult {
  opened: boolean;
  command: string;
}

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
  /** D102: ask "How did it go?" after the 1st finished session and then every 5th (Settings → Privacy and data). */
  feedback_ask: boolean;
  /** D117: which engine writes the feedback and debrief after the call; "" = the conversation engine. */
  debrief_engine: DebriefEngine;
}

/** "" = same as the conversation. Gemini Live is not an option (it only talks). */
export type DebriefEngine = "" | Exclude<EngineId, "gemini_live">;

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
  feedback_ask?: boolean;
  debrief_engine?: DebriefEngine;
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
  mode: PracticeMode | "";
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
  /** Tough talk: the History result in numbers (docs/features/tough-talk/protocol.md); null for other modes. */
  talk_result?: TalkResult | null;
}
/** `GET /api/sessions` row of a tough / negotiate session. Amounts are plain integers; null when no offer was made. */
export type TalkResult =
  | { kind: "tough"; calm: number | null; total: number | null }
  | {
    kind: "negotiate"; outcome: string | null; currency: string | null; opening: number | null; final_offer: number | null;
    gain_now: number | null; captured_now_pct: number | null;
    step_up: { later: number; after_months: number; in_writing: boolean } | null; no_offer: boolean;
    /** Negotiation v2 (protocol.md §7.6); absent on v1 rows. */
    version?: 2; scenario?: NegotiateScenario; objections?: number; answered?: number;
    first_number?: number | null; vs_band?: "below" | "inside" | "above" | null;
  };
/** D105: one hit of `GET /sessions/search`. `match.q` is the question number the Debrief shows it under (`?q=n`). */
export interface SearchResult {
  id: string;
  title: string;
  /** "Job · date" (the job is left out when the title already says it). */
  subtitle: string;
  mode: PracticeMode | "";
  archived: boolean;
  started_at: string;
  match: { field: "title" | "job" | "question" | "answer"; snippet: string; q?: number };
}
export interface TrashItem { trash_id: string; id: string; title: string; started_at: string; deleted_at: string }

export interface TranscriptTurn { role: "user" | "model"; text: string; question_id?: string; kind?: string }

export interface SessionRecord {
  id: string;
  mode: PracticeMode;
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
  debrief: AnyDebrief | null;
  /** Tough talk (protocol.md §4): the saved state of a `negotiate` session; carries hidden numbers, so the web reads only
   * what the debrief and History need and never shows `floor` / `ceiling` / `opening` before the debrief says so. */
  negotiation?: NegotiationRecord;
  /** Tough talk: the saved state of a `tough` session. */
  tough?: ToughRecord;
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

/** D98 (rubric §9.2): `said` is an exact fragment of the answer (`quote`) or a delivery number (`metric`); `lands_as`
 * is the interviewer's likely reading. Old servers and sessions saved before D98 send none of the three. */
export interface WeakSpot {
  layer: LayerName;
  tag: string;
  text: string;
  /** Answer positions as saved ("q6" = the sixth scored answer, a follow-up counts): not question numbers; the page uses `questions`. */
  evidence?: string[];
  /** The questions this spot showed in ("q4"), the numbers on the debrief's tabs; built by the server at read time. */
  questions?: string[];
  said?: string;
  said_kind?: "quote" | "metric";
  lands_as?: string;
}
/** D98 (rubric §9.1): the seven scorecard rows, in this order. */
export type ScoreKey = "structure" | "own_part" | "result" | "relevance" | "reflection" | "language" | "delivery";
export interface ScoreRow {
  key: ScoreKey;
  /** 1–5; null = nothing to judge ("Not asked this time"). */
  score: number | null;
  answers: number;
  /** The questions that lost points ("q2" = question 2, as in `WeakSpot.questions`), each once. */
  lost: string[];
}
/** D98 (rubric §9.3): one step per weak spot, up to three; the first has the drill. */
export interface PlanStep { layer: LayerName; tag: string; text: string; drill: boolean; /** The questions of this step's own weak spot ("q4"). */ questions?: string[] }
/** D99 (rubric §9.4): the step of the verdict scale, computed by the server from the scorecard at read time. */
export interface VerdictStepData {
  value: 0 | 1 | 2;
  /** Scorecard rows between the user and the next step, lowest score first. */
  gap: ScoreKey[];
  /** The score those rows need: 3 (from step 0), 4 (from step 1); null at step 2. */
  target: 3 | 4 | null;
}
export interface Debrief {
  /** Interview and English debriefs have no `kind`; the tough-talk ones do (`AnyDebrief` narrows on it). */
  kind?: "interview" | "english";
  verdict: string;
  weak_spots: WeakSpot[];
  /** Interview debriefs only; all three D98 parts are built by the server in code at read time. */
  scorecard?: { rows: ScoreRow[] };
  /** Absent: too short, English mode, or no row has a score. */
  step?: VerdictStepData;
  plan?: PlanStep[];
  strength: string;
  next_step: string;
  source: "model" | "template" | string;
  too_short?: boolean;
  /** Interview with a salary talk at the end (protocol.md §7.5): the screening-shaped debrief of that part. */
  money_talk?: NegotiateDebrief | null;
}

/* ---------- WebSocket: client -> server ---------- */

export type InputMode = "voice" | "browser_stt" | "text";

export interface FocusSpot {
  layer: "content" | "language" | "delivery";
  tag: string;
}

export interface StartMessage {
  type: "start";
  /** `quick` (D111): Mike asks "interview or English?" first; the answer sets the practice (`mode_selected`). */
  mode: "interview" | "english" | "quick" | "tough" | "negotiate";
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
  /** A drill's focus: the weak spots (layer + tag, as in the debrief) the questions and the interviewer work on. */
  focus?: FocusSpot[];
  engine?: EngineId;
  /** US-13 AC5: continue this saved session (after a dropped connection) instead of starting a new one. */
  resume_session_id?: string;
  /** `mode: "negotiate"` (protocol.md §1); in an interview with `money_talk`: role, target, range, currency. */
  negotiate?: NegotiateStart | MoneyTalkStart;
  /** Interview only: end with a salary talk (protocol.md §7.5). */
  money_talk?: boolean;
  /** `mode: "tough"`. */
  tough?: { theme: ToughTheme };
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
  /** Tough talk: ask for a tactic card for this moment (works offline on the server, no model). */
  /** `another`: a different card for the same moment (the server skips the cards already shown at this turn). */
  | { type: "hint"; another?: boolean }
  | { type: "request_stronger"; feedback_id: string }
  | { type: "recheck"; feedback_id: string; text: string; flag_id?: string }
  | { type: "flag_action"; feedback_id: string; flag_id: string; action: "confirm" | "dismiss" | "restore" }
  | { type: "input_mode"; input: InputMode }
  | { type: "silence" }
  | { type: "ping"; t: number }
  | { type: "end_session" };

/* ---------- WebSocket: server -> client ---------- */

/** `quick_choice`: only on a user turn, the answer to a quick start's "interview or English?" (not an answer to coach). */
export type TurnKind =
  | "question" | "follow_up" | "wait" | "repeat" | "closing" | "ack" | "turn" | "quick_choice"
  /** Tough: a pushback line, and the neutral line for a personal question. */
  | "pressure" | "move_on"
  /** Negotiation v2: Mike checks with the hiring manager; and the interview's switch to the salary part. */
  | "checking" | "money_start";

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
      mode: "interview" | "english" | "tough" | "negotiate";
      /** A quick start: `mode` and `questions` are decided by the user's answer (`mode_selected`). */
      quick?: boolean;
      engine: string;
      model: string;
      speaks: boolean;
      questions: Question[];
      audio: { sample_rate_out: number; sample_rate_in: number };
      stt: SttInfo;
      suggester_available: boolean;
      suggest: boolean;
      warnings: string[];
      /** Tough talk: the Hint button works (`hint_available`) and the Talk-now control is on. */
      talk?: boolean;
      hint_available?: boolean;
      /** `negotiate`: what the call is about. `style` stays "surprise" while hidden. Never any hidden number. */
      negotiate?: Partial<NegotiateStart> & { period: "year"; scenario?: NegotiateScenario; scenario_name?: string; user_opens?: boolean };
      /** Interview with a salary talk at the end (protocol.md §7.5). */
      money_talk?: { enabled: boolean; style: NegotiateStyle; role: string; currency: string; target: number; job_low: number | null; job_high: number | null } | null;
      /** `tough`: the theme and how many questions (ids only in `questions`, text is empty). */
      tough?: { theme: ToughTheme; theme_name: string; total: number };
    }
  | { type: "ready" }
  /** Quick start (D111): the user chose; the session is, from here on, this practice (and is saved under this title). */
  | { type: "mode_selected"; mode: "interview" | "english"; questions: Question[]; title: string }
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
      /** Tough talk: 1-based position of the question and the total (kind `question`), and, with kind `closing` in
       * `negotiate`, how the call ended. */
      index?: number;
      total?: number;
      outcome?: NegotiateOutcome;
      /** Negotiation v2: the "let me check" line (`check_s` seconds) and the come-back line. */
      checking?: boolean;
      check_s?: number;
      came_back?: boolean;
      /** Negotiation v3 (D118): 1..5, Mike's turns in a negotiate call when the course was taken. */
      talk_step?: number;
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
  /** Tough talk: the answer to `{type:"hint"}`. */
  | ({ type: "hint" } & HintCard)
  /** D117: ~1 s after a `hint`, the model's own-words example for that card. Applies only if `n` and `card_id` still match the card shown; may never come. */
  | { type: "hint_update"; n: number; card_id: string; example: string }
  | { type: "saving" }
  | { type: "session_saved"; session_id: string }
  | { type: "debrief_pending"; session_id: string }
  | { type: "debrief"; session_id: string; debrief: AnyDebrief }
  | { type: "session_ended"; saved: boolean; reason: string }
  | { type: "save_error"; code: string; message: string }
  | ServerError
  | { type: "pong"; t: number };

/** US-60 (D102): in-app feedback. `app_line` is the exact line the "attach" box adds. */
export type FeedbackKind = "idea" | "problem" | "other" | "session";
export interface FeedbackConfig { configured: boolean; issues_url: string; app_line: string }
export interface FeedbackBody {
  kind: FeedbackKind;
  message: string;
  rating?: number;
  email?: string;
  attach_meta: boolean;
  session_id?: string;
}
export interface SessionFinished { count: number; ask: boolean; configured: boolean }


/* ---------- Tough talk (modes `tough` and `negotiate`, docs/features/tough-talk/protocol.md) ---------- */

/** Every practice mode a session can have. `quick` is only a start message; the session turns into one of these. */
export type PracticeMode = "interview" | "english" | "tough" | "negotiate";
export type NegotiateStyle = "friendly" | "firm" | "tight" | "surprise";
export type NegotiateOutcome = "accepted" | "time" | "declined" | "turn_cap" | "noted";
export type NegotiateScenario = "screening" | "offer" | "internship" | "counteroffer" | "raise";
export type LeaveReason = "money" | "growth" | "manager" | "remote" | "other";
export type ToughTheme = "money" | "leaving" | "weakness" | "fit" | "english" | "personal" | "mix";

/** `start.negotiate` (protocol.md §1). Amounts are plain integers in the form currency. */
export interface NegotiateStart {
  /** Negotiation v2; a start without it is the offer call. */
  scenario?: NegotiateScenario;
  current_pay?: number;
  ask?: number;
  review_month?: number;
  new_offer?: number;
  leave_reason?: LeaveReason;
  role: string;
  job_low?: number;
  job_high?: number;
  target: number;
  currency: string;
  style: NegotiateStyle;
  has_real_offer: boolean;
  /** Negotiation v3 (D118): only when the person chose to prepare (or reused their last case). */
  prep?: NegotiatePrep;
}

/** The person's case (prd-v3-prep §5, §6). Lever ids: step_up, sign_on, review, remote, title, part_now, dated_raise. */
export interface NegotiateCase { results: string[]; reason: string; fallbacks: string[] }
export interface NegotiatePrep extends NegotiateCase { course: boolean }

/** `start.negotiate` of an interview with `money_talk` (the style follows the interview strictness). */
export interface MoneyTalkStart { role: string; target: number; job_low?: number; job_high?: number; currency: string }

/** A tactic card from `GET /api/tough-talk/content` (N1..N10 for negotiate, T1, T2, N3 for tough). */
export interface TacticCardData {
  id: string;
  title: string;
  rule: string;
  evidence: string;
  example: string;
  modes: Array<"negotiate" | "tough">;
}
/** One step of the mini-course (prd-v3-prep §4). */
export interface CourseStep { title: string; rule: string; example: string }
export interface ToughTalkContent {
  cards: TacticCardData[];
  /** Negotiation v3: the 5-step mini-course per scenario family. Absent on an older server: the setup skips the course. */
  course?: { offer?: CourseStep[]; raise?: CourseStep[] };
  themes: Array<{ id: ToughTheme; name: string; count: number; personal: boolean }>;
  /** Negotiation v2: the five scenarios in menu order. */
  scenarios?: Array<{ id: NegotiateScenario; name: string; blurb: string; mike_role?: string; opens?: string; fields?: string[]; levers?: string[] }>;
  leave_reasons?: Array<{ id: LeaveReason; name: string }>;
  styles: Array<{ id: NegotiateStyle; name: string; difficulty: string; blurb: string }>;
  currencies: string[];
  notes: { no_data: string; practice: string; personal: string };
  tough_total: number;
}
/** `GET /api/vacancies/{id}/salary-range`: nulls when the post lists no annual range. */
export interface SalaryRange { low: number | null; high: number | null; currency: string | null; title: string }

/** The server's answer to `{type:"hint"}`. `shape` is tough only (the answer-shape line of the current question). */
export interface HintCard {
  mode: "negotiate" | "tough";
  card_id: string;
  title: string;
  text: string;
  example: string;
  shape?: string;
  n: number;
}

export interface HintUsed { card_id: string; turn: number; n?: number }
/** Saved `negotiation` block; only the fields the web reads are typed. Hidden numbers stay unread until the debrief. */
export interface NegotiationRecord {
  scenario?: NegotiateScenario;
  style: NegotiateStyle;
  surprise?: boolean;
  currency: string;
  role: string;
  job_low?: number | null;
  job_high?: number | null;
  target: number;
  has_real_offer?: boolean;
  offer?: number | null;
  outcome?: string | null;
  user_turns?: number;
  hints_used?: HintUsed[];
  [key: string]: unknown;
}
export interface ToughRecord {
  theme: ToughTheme;
  theme_name: string;
  ids: string[];
  index?: number;
  hints_used?: HintUsed[];
  [key: string]: unknown;
}

/** Negotiation v2 additions (protocol.md §7.4); all optional so v1 records still type. */
export interface NegotiateObjection { id: string; turn: number; mike_line: string; user_reply: string | null; answered: boolean; may_be_wrong: boolean }
export interface NegotiateSection {
  first_number?: number | null; first_turn?: number | null; vs_band?: "below" | "inside" | "above" | null;
  asked_range?: boolean; got_range?: boolean; range_given?: boolean; revealed_current?: boolean; tied_to_scope?: boolean; flexible_on_package?: boolean;
  level_asked?: boolean; level_won?: boolean; step_up_line?: string | null; results_named?: boolean;
  reason_named?: boolean; reason?: string | null; counter_matched?: boolean; counter_in_writing?: boolean; time_asked?: boolean;
  unwritten_promise_accepted?: boolean; deadline_accepted?: boolean; decision?: "stay" | "leave" | "time" | null; note?: string;
  asked?: number; current?: number;
  raise_now?: { amount: number; pct_of_current: number } | null;
  dated?: { amount: number; after_months: number; criteria: boolean; in_writing: boolean } | null;
  other_levers?: string[]; threat_without_offer?: boolean; captured_now_pct?: number | null; captured_later_pct?: number | null;
}
/** Negotiation v3: one line of "Before the real talk". `id` "prep_skipped" adds "Practise again with prep". */
export interface HomeworkItem { id: string; text: string; quote: string | null; card_id: string | null }
export interface NegotiateDebrief {
  kind: "negotiate";
  version?: 2;
  homework?: HomeworkItem[];
  repeats?: { count: number; quote: string } | null;
  case?: (NegotiateCase & { course: boolean }) | null;
  scenario?: NegotiateScenario;
  scenario_name?: string;
  objections?: NegotiateObjection[];
  who_moved?: { mike: Array<{ turn?: number; label?: string }>; you: Array<{ turn?: number; label?: string }>; mike_total: number; you_total: number };
  check?: { used: boolean; turn: number; result: { kind: string; from: number | null; to: number | null; lever: string | null } | null } | null;
  deadline?: { said: boolean; turn: number; asked_time: boolean; label: string } | null;
  section?: NegotiateSection;
  verdict: string;
  practice_note: string;
  source: string;
  cards: string[];
  hints_used: Array<{ card_id: string; title: string; turn: number }>;
  style: NegotiateStyle;
  style_name: string;
  surprise: boolean;
  role: string;
  currency: string;
  period: "year";
  outcome: NegotiateOutcome | "ended";
  outcome_label: string;
  no_offer: boolean;
  summary: {
    opening: number | null;
    final_offer: number | null;
    floor: number | null;
    ceiling: number | null;
    captured_pct: number | null;
    position_pct: number | null;
    rounds_used: number;
    round_cap: number;
    captured_now_pct: number | null;
    captured_later_pct: number | null;
    year_one: number | null;
    target: number;
    job_low: number | null;
    job_high: number | null;
    range_source: "job_range" | "your_target";
  };
  hidden_range: { floor: number; ceiling: number; text: string } | null;
  offer_path: Array<{ turn: number; offer: number; label: string }>;
  shifts: Array<{ turn: number; from: number; to: number; cause: string; cause_label: string; quote: string }>;
  deal: {
    now: number; later: number; after_months: number; in_writing: boolean; criteria_named: boolean; line: string;
  } | null;
  levers_won: Array<{ lever: string; label: string; value: string; by: "ask" | "offered"; turn: number }>;
  missed_levers: Array<{ lever: string; label: string }>;
  say_it_better: Array<{ id: string; title: string; what_happened: string; you_said: string | null; try: string; card_id: string; why?: string }>;
  signals: Array<{ id: string; label: string; good: boolean; quote: string | null }>;
  pressure_notes: string[];
  flags: string[];
  guard_replacements: number;
  competing_offer_note: string | null;
}

export interface ToughSignal {
  id: string;
  label: string;
  bad: boolean;
  source: "model" | "code";
  may_be_wrong?: boolean;
  quote: string;
}
export interface ToughDebriefQuestion {
  n: number;
  question_id: string;
  theme: ToughTheme;
  question: string;
  personal: boolean;
  answers: Array<{ role: "answer" | "follow_up_answer" | "pressure_answer"; text: string }>;
  pushes: Array<{ kind: "follow_up" | "pressure"; text: string }>;
  signals: ToughSignal[];
  calm: boolean;
  calmer_answer: string | null;
  shape: string;
  checking: string;
  trap: string;
  card_ids: string[];
  lawful_note: string | null;
  model_checked: boolean;
}
export interface ToughDebrief {
  kind: "tough";
  verdict: string;
  practice_note: string;
  theme: ToughTheme;
  theme_name: string;
  source: "code+model" | "code" | string;
  cards?: string[];
  hints_used?: Array<{ card_id: string; title: string; turn: number }>;
  summary: {
    answered: number;
    calm: number;
    show_counts: boolean;
    hurt_most: { question_no: number; question: string; signal: string; label: string; quote: string } | null;
  };
  questions: ToughDebriefQuestion[];
}

/** What a saved session's `debrief` can be. Interview and English have no `kind`; tough talk has. */
export type AnyDebrief = Debrief | NegotiateDebrief | ToughDebrief;
export const isNegotiateDebrief = (d: AnyDebrief | null | undefined): d is NegotiateDebrief => d?.kind === "negotiate";
export const isToughDebrief = (d: AnyDebrief | null | undefined): d is ToughDebrief => d?.kind === "tough";
/** The interview / English debrief of a record, or null when it has none or is a tough-talk one. */
export function interviewDebrief(d: AnyDebrief | null | undefined): Debrief | null {
  return d && d.kind !== "negotiate" && d.kind !== "tough" ? d : null;
}
