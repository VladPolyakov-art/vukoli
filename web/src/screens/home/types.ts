/* Home screen model, v2 (ds/screens/home.md v2, review v1 → D47a/b). Home is a start screen (greeting, one composer,
 * up to 3 suggestions) that turns into a short scripted setup chat with Mike and ends in a plan card with the one
 * primary button. The pure `HomeView` takes all of this by props; the live `HomeScreen` feeds it from the API and
 * runs the script (`script.ts`). Nothing here knows about the network. */
import type { ReactNode } from "react";
import type { IconName, WeakSpotLayer } from "../../ds";
import type { FocusSpot, Level, NegotiatePrep, NegotiateScenario, MoneyTalkStart, NegotiateStart, NegotiateStyle, TacticCardData, ToughTalkContent, ToughTheme } from "../../lib/types";
import type { NumbersValues } from "./numbers";

export type Track = "interview" | "english" | "tough" | "negotiate";
/** `?track=` on Home (AC5 of US-62): the practice whose setup chat opens. Anything else is the interview home. */
export function trackFromParam(value: string | null): Track {
  return value === "english" || value === "tough" || value === "negotiate" ? value : "interview";
}
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
  /** The server's tag ("we_not_i"): what the interviewer is told to work on. Fixtures have none. */
  tag?: string;
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
  | "en-free" | "en-work" | "en-small" | "en-phrases"
  /** Tough talk (tough-talk.md §2.1): the two practice chips next to "Practise English". */
  | "tough" | "negotiate";
/** `practice`: the second chip row (Practise English · Tough questions · Negotiate salary, tough-talk.md §2.1). */
export interface Suggestion { id: SuggestionId; icon: IconName; label: string; group?: "practice" }

export interface SetupReply {
  id: string;
  label: string;
  icon?: IconName;
  /** A multi-select reply (negotiate prep, "what else would work"): shown pressed; the question stays open. */
  selected?: boolean;
}

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
  /** Negotiate N-2: the numbers card sits inside this message (until it is submitted). */
  numbers?: NumbersTurn;
  /** A short term / description list under the message (the scenario question). */
  list?: Array<{ term: string; text: string }>;
  /** Negotiate v3: the "Your case" summary card under this message (lever names, not ids). */
  caseCard?: { results: string[]; reason: string; fallbacks: string[] };
}

/** The numbers card inside Mike's message (tough-talk.md §2.4). */
export interface NumbersTurn {
  values: NumbersValues;
  /** Prefilled from the job post: "From the job post — check it". */
  fromPost: boolean;
  /** The role field is shown only when N-1 did not give the role. */
  roleField: boolean;
  currencies: string[];
  /** Negotiation v2: which fields the card shows (absent: the offer call). */
  scenario?: NegotiateScenario;
  /** Review states: the card opens with its errors shown (as after a press on "Use these numbers"). */
  showErrors?: boolean;
}

/** What the setup remembers between visits and the server content it needs (tough-talk.md §2.3, §3). */
export interface NumbersMemory { role?: string; low?: number; high?: number; target: number; currency: string; hasOffer: boolean }
export interface TalkContext {
  /** `GET /api/tough-talk/content`; null while it loads or when the server did not answer. */
  content: ToughTalkContent | null;
  /** The style used last time (US-64 AC2); null = first time. */
  lastStyle: NegotiateStyle | null;
  /** US-63 AC6: last values per job, else last used. */
  numbers: { last: NumbersMemory | null; byJob: Record<string, NumbersMemory> };
  /** "Hide tactics" per mode (Settings → Practice turns them back on). */
  tacticsHidden: { tough: boolean; negotiate: boolean };
  /** Negotiate v3: `GET /api/talk/last-case` per scenario (null = none saved; absent = not asked yet). */
  lastCases?: Partial<Record<NegotiateScenario, NegotiatePrep | null>>;
}

export type PlanRow = "job" | "round" | "strictness" | "level" | "topic" | "focus" | "role" | "style" | "offer" | "theme" | "scenario" | "money" | "case";

export interface PlanModel {
  kind: "interview" | "drill" | "english" | "tough" | "negotiate";
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
  focus?: { id: "all" | WeakSpotLayer; label: string; spots: string; tags?: FocusSpot[] };
  /** Drill: the Change focus menu ("All 4", "Content 2", …). */
  focusOptions?: { id: "all" | WeakSpotLayer; label: string }[];
  /** Negotiate salary (kind `negotiate`): the numbers card's values, as the `start.negotiate` block wants them. */
  negotiate?: NegotiateStart & { company?: string };
  /** Negotiate: the scenario of the call (the plan's Scenario row). */
  scenario?: NegotiateScenario;
  /** Negotiate v3: the person's case (the plan's "Your case" row); absent = no prep or nothing answered. Levers by name. */
  case?: { results: string[]; reason: string; fallbacks: string[] };
  /** Interview: "End with a salary talk". `values` are the screening fields; `ready` = they are valid (else turning it on asks for them). */
  money?: { on: boolean; ready: boolean; values: NumbersValues; roleEditable: boolean; currencies: string[]; start?: MoneyTalkStart };
  /** Tough questions (kind `tough`): the chosen theme and its display name ("Money"). */
  tough?: { theme: ToughTheme; themeName: string };
  /** Tough talk: the tactic strip above Start (cards from `GET /api/tough-talk/content`, in the order of the call);
   * `tacticsHidden` is the "Hide tactics" preference (Settings → Practice). */
  tactics?: TacticCardData[];
  tacticsHidden?: boolean;
  /** Tough talk: options for the Change menus and the numbers dialog. */
  talk?: {
    styles: { id: NegotiateStyle; label: string; difficulty: string }[];
    themes: { id: ToughTheme; label: string }[];
    currencies: string[];
    /** The range in the numbers came from the job post ("From the job post — check it"). */
    fromPost: boolean;
    /** The role is typed, not taken from a saved job: the dialog shows the Role field. */
    roleEditable: boolean;
    scenarios: { id: NegotiateScenario; name: string; blurb: string }[];
    /** The numbers as typed so far (the dialog starts from them when the scenario changed and they no longer fit). */
    numbers?: NumbersValues;
  };
  /** English. */
  level?: Level;
  topic?: string;
  phrases?: string[];
}

export interface SetupModel {
  /** The practice this chat sets up (the chip may switch it away from the page's track). */
  track?: Track;
  turns: SetupTurn[];
  /** "Step 2 of 3"; none once the plan is shown, or for Again / Drill. */
  step?: { n: number; of: number };
  canSkip: boolean;
  /** Overrides the composer placeholder of the turn (negotiate: "Type the role, e.g. Product Designer"). */
  placeholder?: string;
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
  /** The browser can install Vukoli as an app and the user has not said no: a quiet card on the start screen. */
  installCard?: boolean;
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
  initialOverlay?: "change-job" | "change-round" | "change-strictness" | "change-numbers" | "change-style" | "change-theme";
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
  /** D111: the "Quick start" button next to the composer: a call right away, Mike asks "interview or English?". */
  onQuickCall?: () => void;
  onReply?: (turnId: string, replyId: string) => void;
  onTurnAction?: (turnId: string, actionId: TurnActionId) => void;
  onSkip?: () => void;
  onChange?: (row: PlanRow, value: string) => void;
  /** Negotiate: the numbers card of Mike's message (turn id) or the plan's "Change your numbers" dialog (null) was submitted. */
  onNumbers?: (turnId: string | null, values: NumbersValues) => void;
  /** "Hide tactics" / "Show them" on the plan card of a tough-talk mode. */
  onTactics?: (hidden: boolean) => void;
  onRemoveNote?: () => void;
  onRetryPrep?: () => void;
  onAddCv?: () => void;
  onStart?: () => void;
  onTypeInstead?: () => void;
  onRetryEngine?: () => void;
  onUseTextMode?: () => void;
  onDismissBrowser?: () => void;
  onInstall?: () => void;
  onDismissInstall?: () => void;
}
