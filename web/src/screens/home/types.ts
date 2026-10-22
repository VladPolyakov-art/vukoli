/* Home screen model, v2 (ds/screens/home.md v2, review v1 → D47a/b). Home is a start screen (greeting, one composer,
 * up to 3 suggestions) that turns into a short scripted setup chat with Mike and ends in a plan card with the one
 * primary button. The pure `HomeView` takes all of this by props; the live `HomeScreen` feeds it from the API and
 * runs the script (`script.ts`). Nothing here knows about the network. */
import type { ReactNode } from "react";
import type { IconName, WeakSpotLayer } from "../../ds";
import type { Level } from "../../lib/types";

export type Track = "interview" | "english";
/** Round types (US-12 AC1: four). */
export type RoundType = "hr" | "behavioural" | "technical" | "mix";
export type Strictness = 1 | 2 | 3;
export type EnglishTopic = "free" | "work" | "small";
export type { Level };

/** A saved job (vacancy). Dates arrive formatted ("Oct 18"). */
export interface JobItem {
  id: string;
  company: string;
  role: string;
  /** "Oct 18" */
  added: string;
  preview?: string;
  questions: number;
  /** `ready` · `preparing` (questions are being written) · `error` (couldn't prepare) · `short` (too little text). */
  state: "ready" | "preparing" | "error" | "short";
}

export interface WeakItem {
  id: string;
  layer: WeakSpotLayer;
  title: string;
  /** Short form for lists ("No result"). */
  short?: string;
  /** In a sentence: "no result in 4 answers". */
  phrase?: string;
  /** What to do about it: "End each story with what changed." (the plan's Watch for row). */
  tip?: string;
  count: string;
}

export interface Phrase { id: string; from: string; to: string; wrong: string; right: string; times: number }

export interface EngineBannerModel {
  body: string;
  command?: string;
}

/** A start-screen suggestion chip (max 3, home.md §3.3). */
export type SuggestionId =
  | "again" | "drill" | "english" | "another" | "general" | "example"
  | "en-free" | "en-work" | "en-small" | "en-phrases";
export interface Suggestion { id: SuggestionId; icon: IconName; label: string }

export interface SetupReply { id: string; label: string; icon?: IconName }

/** What the user's message carries: a pasted job (3 lines + "Show all"), a link or a file. */
export interface SetupAttachment {
  kind: "job" | "link" | "file";
  label: string;
  /** "Job description · 1,240 characters", "184 KB". */
  meta?: string;
}

export type TurnActionId = "edit-job" | "use-general";

/** One message of the setup chat. */
export interface SetupTurn {
  id: string;
  speaker: "mike" | "user";
  state: "final" | "pending" | "error";
  /** Plain text; `**x**` marks bold (a company name). */
  text?: string;
  /** A second line in tertiary text ("Words you marked as misheard aren't counted."). */
  aside?: string;
  pendingLabel?: string;
  attachment?: SetupAttachment;
  /** Quick replies (max 4); the view drops them once the turn is answered. */
  replies?: SetupReply[];
  /** Set once a quick reply (or a typed answer) answered this turn: the replies leave. */
  answered?: boolean;
  /** A text action under the message ("Edit details", "Use general questions"). */
  action?: { id: TurnActionId; label: string; icon?: IconName; button?: boolean };
  /** The example card follows this message (first-visit "Show me an example"). */
  example?: boolean;
  /** The plan card follows this message. */
  plan?: boolean;
}

export type PlanRow = "job" | "round" | "strictness" | "level" | "topic" | "focus";

export interface PlanModel {
  kind: "interview" | "drill" | "english";
  job: { id: string; company: string; role: string } | null;
  jobStatus: "ready" | "preparing" | "error";
  /** Questions written from the job ("12 questions ready"). */
  questionsReady?: number;
  round: RoundType;
  strictness: Strictness;
  questions: number;
  minutes: number;
  basis: "cv+job" | "job" | "cv" | "general";
  note?: string;
  /** "No result in 4 answers. End each story with what changed." */
  watch?: string;
  hasCv: boolean;
  /** Drill: what the questions aim at. */
  /** `spots`: the weak spots being drilled, as one line ("no result, we instead of I"): the session shows it as its focus. */
  focus?: { id: "all" | WeakSpotLayer; label: string; spots: string };
  /** Drill: the Change focus menu ("All 4", "Content 2", …). */
  focusOptions?: { id: "all" | WeakSpotLayer; label: string }[];
  /** English. */
  level?: Level;
  topic?: string;
  phrases?: string[];
}

export interface SetupModel {
  turns: SetupTurn[];
  /** "Step 2 of 3"; none once the plan is shown, or for Again / Drill. */
  step?: { n: number; of: number };
  canSkip: boolean;
  /** The bottom composer's placeholder follows the chat: job → "Paste a job or a link", reply, plan. */
  stage: "job" | "reply" | "plan";
  plan?: PlanModel;
}

export interface HomeViewProps {
  step: "start" | "setup";
  track: Track;
  /** Profile name: "What are we practising today, Alex?" (US-08 AC3). */
  name?: string;
  /** Settings (and so the name) haven't loaded yet: the greeting keeps its place but stays blank, so it doesn't
   * flash without the name first. */
  namePending?: boolean;
  loading?: boolean;
  /** Mike's engine can start. false: banner, Start disabled with the reason. */
  engineReady: boolean;
  engineBanner?: EngineBannerModel | null;
  /** US-06: the browser can't recognise speech. */
  browserBanner?: boolean;
  /** The user answers by typing: Start shows the keyboard icon. */
  textMode?: boolean;
  /** US-23: saved sessions can't be read. */
  storageError?: boolean;
  suggestions: Suggestion[];
  /** Quick start (D51 item 1): what the round mic at the composer's end starts (its tooltip). None: not offered (English). */
  quickStart?: { detail: string; answer?: "voice" | "text"; /** The remembered job's questions are still being written (QA-02): the button waits. */ wait?: boolean } | null;
  composer: { text: string; file?: { name: string; size: string } };
  setup?: SetupModel;
  /** Saved jobs, for the plan's Change job listbox. */
  jobs: JobItem[];
  /** Start was pressed: the button turns into the connecting pill. */
  starting?: boolean;
  /** Motion: build-up on first load and on return from a session; soft-out while leaving. */
  buildUp?: boolean;
  leaving?: boolean;
  /** Settings: the order of the three layers in the example (GR8). */
  layerOrder?: "content-first" | "delivery-first";
  /** Review states: a menu open on first render. */
  initialOverlay?: "mode" | "change-job" | "change-round" | "change-strictness";
  /** Rendered after the column (VacancyEditor dialog). */
  overlay?: ReactNode;
  onComposerChange?: (text: string) => void;
  /** D90: the mic at the end of the chat composer: dictation into the field (none: no recogniser works here). */
  dictation?: { available: boolean; state: "idle" | "listening" | "transcribing"; error?: string };
  onDictate?: () => void;
  onAddFile?: () => void;
  /** Files pasted or dropped on the composer (D89): the first one is attached, as the + button does. */
  onFiles?: (files: File[]) => void;
  onRemoveFile?: () => void;
  onSend?: () => void;
  onSuggestion?: (id: SuggestionId) => void;
  onQuickStart?: () => void;
  onReply?: (turnId: string, replyId: string) => void;
  onTurnAction?: (turnId: string, actionId: TurnActionId) => void;
  onSkip?: () => void;
  onChange?: (row: PlanRow, value: string) => void;
  onRemoveNote?: () => void;
  onRetryPrep?: () => void;
  onAddCv?: () => void;
  onStart?: () => void;
  onTypeInstead?: () => void;
  onModeChange?: (track: Track) => void;
  onRetryEngine?: () => void;
  onUseTextMode?: () => void;
  onDismissBrowser?: () => void;
}
