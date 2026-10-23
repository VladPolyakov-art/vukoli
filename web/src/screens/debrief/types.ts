/* View model of the Debrief screen (ds/screens/debrief.md). Pure data: the live container maps a saved session
 * into it (`mapRecord.ts`), stories and the review page use the fixtures. Text that comes from the model or the
 * user (questions, answers, fixes) is plain English data; every chrome string comes from the locale file. */
import type { IconName } from "../../ds";
import type { LayerOrder } from "../../lib/types";

export type Layer = "content" | "language" | "delivery";
export type DebriefVariant = "interview" | "english" | "example";
export type DebriefState = "ready" | "loading" | "preparing" | "notFound" | "error";

/** A sentence made of plain text and marked fragments (G20): `fix` in "Say", `heard` in "Heard as", `unsure` for a low-confidence word. */
export type Segment = string | { kind: "fix" | "heard" | "unsure"; text: string };
export type Segments = Segment[];

export interface MetaItem {
  icon: IconName;
  text: string;
  /** Link target (the storage item goes to Settings → Storage). */
  href?: string;
  /** `warning` = a system state (not saved). */
  tone?: "warning";
}

/** Evidence under a weak spot: "Questions 1, 2, 4" or "Most in question 4 (12)". Numbers are links to the cards. */
export interface Evidence { kind: "questions" | "most"; ids: number[]; trail?: string }

export interface WeakSpotModel {
  id: string;
  layer: Layer;
  title: string;
  evidence?: Evidence;
  fix?: string;
  /** Content only: a second point under a hairline. */
  also?: { text: string; ids: number[]; fix?: string };
}

export type ScaleStep = 0 | 1 | 2;
export interface VerdictModel {
  /** Index in `Not ready yet · Getting there · Ready`; absent when the server gives only a sentence. */
  step?: ScaleStep;
  headline: string;
  line?: string;
}

export interface Correction {
  id: string;
  /** English: `Turn 2 · 01:40`. */
  turn?: { n: number; at?: string };
  /** A typed answer: the row says "You typed" instead of "Heard as". */
  typed?: boolean;
  heard: Segments;
  say: Segments;
  why: string;
  dismissed?: boolean;
}

export type RemovedLine =
  | { kind: "misheard"; text: string }
  | { kind: "name"; text: string }
  | { kind: "unsure"; n: number };

export interface ContentBlock { items: { lead?: string; text: string }[] }
export interface LanguageBlock { corrections: Correction[]; removed: RemovedLine[]; note?: boolean }
export interface DeliveryBlock {
  fillers?: number;
  /** "2:20" */
  length?: string;
  words?: number;
  pace?: { wpm: number; verdict: "slow" | "comfortable" | "fast" };
  /** `"uh" (6), "like" (4)` */
  mostFillers?: string;
  engineNote?: boolean;
  textMode?: boolean;
}

export interface StrongerModel {
  status: "idle" | "loading" | "ready" | "unavailable";
  text?: Segments;
  /** Shows the "fill in your real number" note under the text. */
  placeholders?: boolean;
}

export interface QuestionModel {
  n: number;
  question: string;
  /** Badge labels on the collapsed card; a missing layer shows no badge. */
  summary: { content?: string; language?: string; delivery?: string };
  /** "2:20" */
  duration?: string;
  /** "03:35": needs a per-question start time saved with the session (default decision O2). */
  startsAt?: string;
  followUps: number;
  misheard?: number;
  suggestion?: boolean;
  edited?: boolean;
  /** Feedback never arrived: a short info line instead of the layer blocks. */
  unavailable?: boolean;
  followUp?: string;
  answer: Segments;
  followUpAnswer?: string;
  layers: { content?: ContentBlock; language?: LanguageBlock; delivery?: DeliveryBlock };
  stronger?: StrongerModel;
}

export interface EnglishModel {
  /** Corrections kept (each one with its turn). */
  corrections: Correction[];
  /** How many corrections show before "Show 2 more". */
  visible: number;
  /** Corrections whose phrase came up twice. */
  repeated: number;
  removed: RemovedLine[];
  phrases: { from: string; to: string; times: number }[];
  /** Absent when the length is not known (live data). */
  practiseMinutes?: number;
}

/** One line of the saved talk (D71: the Debrief shows the whole conversation as a chat). */
export interface ConversationTurn {
  id: string;
  speaker: "mike" | "user";
  text: string;
  /** The question the line belongs to (1-based); absent for small talk and in English practice. */
  q?: number;
  /** Mike asks question `q` here. */
  opens?: boolean;
  followUp?: boolean;
}

export interface DebriefModel {
  id: string;
  title: string;
  meta: MetaItem[];
  /** Obsidian folder is set: the menu offers "Export to Obsidian" (US-23 AC3). */
  obsidian?: boolean;
  saved?: boolean;
  verdict?: VerdictModel;
  /** Live only: the verdict is being written (`pending`), could not be written (`missing`) or was built without the model (`template`). */
  verdictNotice?: "pending" | "missing" | "template";
  partial?: { answered: number; total: number };
  weakSpots: WeakSpotModel[];
  /** `questions` and `minutes` are absent when the server does not tell them (live data). */
  drill?: { questions?: number; points: number; minutes?: number };
  questions: QuestionModel[];
  /** The numbers of questions that were never asked in a partial session. */
  skipped?: { from: number; to: number };
  english?: EnglishModel;
  /** The saved transcript; without it (fixtures) the chat is rebuilt from the questions. */
  conversation?: ConversationTurn[];
}

/** Local UI state a static state can start in (review frames, stories). */
export interface DebriefUi {
  /** The question whose breakdown shows next to the chat (default: the first one in `open`, else the first question). */
  selected?: number;
  open?: number[];
  /** Questions whose "stronger answer" starts open. */
  strongerOpen?: number[];
  renaming?: boolean;
  editing?: { question: number; correction: string };
  rechecking?: number;
  /** D80: the folded verdict bar starts open (review, stories). */
  verdictOpen?: boolean;
}

export interface DebriefActions {
  /** Return a promise that resolves `false` when saving failed: the title goes back to the old one. */
  onRename?: (title: string) => void | Promise<boolean | void>;
  /** "Write the debrief again" (live: the model was not available). */
  onRerun?: () => void;
  onDownload?: () => void;
  onExport?: () => void;
  /** D80: move the chat out of Recents into the Archive. */
  onArchive?: () => void;
  onTrash?: () => void;
  onDrill?: () => void;
  onPractise?: () => void;
  onStartFirst?: () => void;
  onRetry?: () => void;
  /** Dismiss / restore a correction ("Not counted"). Without them the buttons are not shown. */
  onDismiss?: (question: number, correction: string) => void;
  onRestore?: (question: number, correction: string) => void;
  /** "Not what you said?" → save and check again. Without it the editor is not offered. Resolving false means the
   * check failed: the editor opens again with the text the user typed. */
  onRecheck?: (question: number, correction: string, text: string) => void | Promise<boolean>;
  onStronger?: (question: number) => void;
}

export interface DebriefViewProps extends DebriefActions {
  variant: DebriefVariant;
  state: DebriefState;
  model?: DebriefModel;
  layerOrder: LayerOrder;
  ui?: DebriefUi;
  /** Build-up on first open (Debrief build-up, `useFreshOnce`). */
  buildUp?: boolean;
  /** Storage is not writable (US-23 AC4). */
  storageError?: boolean;
  /** D96, `state="preparing"`: where the work after the call stands ("Preparing feedback · 2 of 5 answers"). Without it the
   * screen only says the debrief is being written. */
  progress?: { done: number; total: number; stage: "feedback" | "debrief" };
  /** Live: the rerun is in flight. */
  rerunning?: boolean;
  /** Live: an action failed (flag, stronger answer, trash); shown as an error callout under the header. */
  notice?: string;
  /** Live: the question being checked again (the container knows when it is done); undefined = the view's own state. */
  rechecking?: number | null;
  className?: string;
}

/** Layer order for the weak spots and layer blocks (GR8). */
export function layerSequence(order: LayerOrder): Layer[] {
  return order === "delivery-first" ? ["delivery", "language", "content"] : ["content", "language", "delivery"];
}
