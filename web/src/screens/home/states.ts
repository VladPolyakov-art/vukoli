/* Every Home v2 state of ds/screens/home.md §5 as data: a script context + the inputs replayed through the setup
 * script (script.ts) + view flags + what the shell around it shows. Stories, the review entry and the screenshots all
 * read this one table, so a state is reachable by props and still playable (frames.tsx keeps it live). */
import type { RecentState, ShellEngine } from "../../components/AppShell";
import {
  CTX_ENGLISH, CTX_ENGLISH_FIRST, CTX_FIRST, CTX_NEGOTIATE, CTX_NEGOTIATE_AGAIN, CTX_NEGOTIATE_LAST, CTX_NO_CV, CTX_OVERFLOW, CTX_RETURNING, CTX_TOUGH,
  CV_FILE, JOB_FILE, JOB_LINK, KESTREL_LONG, KESTREL_PASTED, LONG_NAME, PASTED_LONG, PASTED_TEXT,
} from "./fixtures";
import type { NumbersValues } from "./numbers";
import { suggestionsFor, type CvResult, type JobResult, type RangeResult, type ScriptContext, type StartInput } from "./script";
import { TALK_HIDDEN } from "./talkFixtures";
import type { HomeViewProps, JobItem, PlanRow } from "./types";

/** One step replayed through the script. `pick` answers the last open question with that reply id. */
export type SceneInput =
  | { do: "begin"; input: StartInput }
  | { do: "pick"; reply: string }
  | { do: "say"; text: string }
  | { do: "resolve"; result: JobResult }
  | { do: "update"; job: JobItem }
  | { do: "skip" }
  | { do: "change"; row: PlanRow; value: string }
  | { do: "attach"; file: { name: string; size: string } }
  | { do: "resolveCv"; result: CvResult }
  /** Tough talk: the post's salary range arrived. */
  | { do: "resolveRange"; result: RangeResult }
  /** Tough talk: the numbers card is sent (the open card's values, with these typed over them). */
  | { do: "numbers"; values?: Partial<NumbersValues> }
  /** Interview plan: the numbers of the salary part, as typed in the dialog. */
  | { do: "moneyNumbers"; values: Partial<NumbersValues> }
  | { do: "tactics"; hidden: boolean };

export interface HomeScene {
  label: string;
  note?: string;
  ctx: ScriptContext;
  /** No inputs: the start screen. */
  inputs?: SceneInput[];
  /** View flags (name, banners, text mode, starting, an open menu, the composer…). */
  props?: Partial<HomeViewProps>;
  recent: RecentState;
  engine: ShellEngine;
  /** D73: the "ready" toast at the top after End (while the session is saved, its Recents row loads instead). */
  toast?: "saved";
  /** Keep a pending read pending (the "Reading the job…" states); otherwise the harness resolves it after a pause. */
  hold?: boolean;
  /** How a pending read resolves when played live. */
  resolveWith?: JobResult;
  /** How the post's range resolves when played live (default: 85,000–98,000 EUR). */
  rangeWith?: RangeResult;
  /** Review: the open numbers card shows these values / its errors (as typed, then Use these numbers pressed). */
  numbersView?: { values?: Partial<NumbersValues>; showErrors?: boolean };
  /** How a CV sent in the chat resolves when played live (D89). */
  cvWith?: CvResult;
  /** D90: the mic in the chat starts listening / with this error under the composer; played live it writes DICTATED. */
  dictate?: "listening" | "no_speech";
}

export const ENGINE_READY: ShellEngine = { name: "Ollama · qwen3:4b", status: "ready" };
export const ENGINE_DOWN: ShellEngine = { name: "Ollama · qwen3:4b", status: "notReady" };

export const RECENT_READY: RecentState = {
  status: "ready",
  items: [
    { id: "s3", title: "Kestrel Pay · Senior Product Designer", track: "interview" },
    { id: "s2", title: "English practice", track: "english" },
    { id: "s1", title: "Lumen Health · Product Designer, Design Systems", track: "interview" },
  ],
};
/** D73: the session just ended is the top row, loading ("2 of 5" once the server has said); the others as before. */
const RECENT_SAVING: RecentState = {
  status: "ready",
  items: [{ id: "s4", title: "Kestrel Pay · Senior Product Designer", track: "interview", pending: true, progress: { done: 2, total: 5, stage: "feedback" } }, ...RECENT_READY.items],
};
export const RECENT_EMPTY: RecentState = { status: "ready", items: [] };
export const RECENT_LONG: RecentState = {
  status: "ready",
  items: [
    { id: "s3", title: "Kestrel Payments International Holdings · Senior Staff Product Designer, Platform Experience and Growth", track: "interview" },
    { id: "s2", title: "English · Talk about your work and the projects you are most proud of this year", track: "english" },
    { id: "s1", title: "Lumen Health · Product Designer, Design Systems", track: "interview" },
  ],
};

const ENGINE_BANNER = { body: "The AI model (Ollama) isn't running. Open the Ollama app, or paste this into Terminal:", command: "ollama serve" };
const engineDown: Partial<HomeViewProps> = { engineReady: false, engineBanner: ENGINE_BANNER };

const ret = { ctx: CTX_RETURNING, recent: RECENT_READY, engine: ENGINE_READY, props: { name: "Alex" } };
const first = { ctx: CTX_FIRST, recent: RECENT_EMPTY, engine: ENGINE_READY };

/* Paths through the script, reused by several states. */
const ASK_JOB: SceneInput[] = [{ do: "begin", input: { kind: "text", text: "I want to practise for an interview" } }];
const SAVED_PICKED: SceneInput[] = [...ASK_JOB, { do: "pick", reply: "job:v2" }];
const ASK_ANYTHING: SceneInput[] = [...SAVED_PICKED, { do: "pick", reply: "round:behavioural" }];
const PLAN: SceneInput[] = [
  { do: "begin", input: { kind: "text", text: "I have a behavioural round with Kestrel Pay" } },
  { do: "pick", reply: "anything:none" },
];
const PASTED: SceneInput[] = [
  { do: "begin", input: { kind: "text", text: PASTED_TEXT } },
  { do: "resolve", result: { ok: true, job: KESTREL_PASTED } },
];
const PASTED_PLAN: SceneInput[] = [...PASTED, { do: "pick", reply: "round:behavioural" }, { do: "pick", reply: "anything:none" }];
const NOTE = "I freeze when they ask about salary.";
const NOTE_LONG = "I freeze when they ask about salary, and I tend to ramble when they ask why I want to leave my current team. Please ask me both, and stop me if an answer runs past two minutes. Also ask one question about working with engineers who disagree with a design decision.";

/* Tough talk paths. The post's range is the one Kestrel Pay lists. */
const RANGE: RangeResult = { ok: true, low: 85000, high: 98000, currency: "EUR" };
const NEG_SCENARIO: SceneInput[] = [{ do: "begin", input: { kind: "suggestion", id: "negotiate" } }];
const NEG_START: SceneInput[] = [{ do: "begin", input: { kind: "suggestion", id: "negotiate", scenario: "offer" } }];
const scenarioStart = (scenario: "screening" | "internship" | "counteroffer" | "raise"): SceneInput[] => [{ do: "begin", input: { kind: "suggestion", id: "negotiate", scenario } }, { do: "pick", reply: "role:type" }, { do: "say", text: "Product Designer" }];
const RAISE_NUMBERS: SceneInput[] = [...scenarioStart("raise"), { do: "numbers", values: { currentPay: "60,000", ask: "72,000", month: "none" } }];
const COUNTER_NUMBERS: SceneInput[] = [...scenarioStart("counteroffer"), { do: "numbers", values: { currentPay: "60,000", newOffer: "70,000", reason: "growth" } }];
const NEG_NUMBERS: SceneInput[] = [...NEG_START, { do: "pick", reply: "job:v1" }, { do: "resolveRange", result: RANGE }];
const NEG_STYLE: SceneInput[] = [...NEG_NUMBERS, { do: "numbers", values: { target: "96,000" } }];
const NEG_PLAN: SceneInput[] = [...NEG_STYLE, { do: "pick", reply: "style:firm" }];
/* Negotiation v3 (D118): prepare first, the mini-course, "your case". */
const NEG_PREP: SceneInput[] = NEG_PLAN;
const NEG_COURSE: SceneInput[] = [...NEG_PREP, { do: "pick", reply: "prep:yes" }];
const NEG_CASE1: SceneInput[] = [...NEG_COURSE, { do: "pick", reply: "course:skip" }];
const NEG_CASE3: SceneInput[] = [...NEG_CASE1, { do: "say", text: "Cut onboarding drop-off by a third.\nLed the checkout redesign for 40k merchants." }, { do: "pick", reply: "case2:market" }];
const NEG_CASE_PLAN: SceneInput[] = [...NEG_CASE3, { do: "pick", reply: "case3:step_up" }, { do: "pick", reply: "case3:sign_on" }, { do: "pick", reply: "case3:done" }];
const TOUGH_PLAN: SceneInput[] = [{ do: "begin", input: { kind: "suggestion", id: "tough" } }, { do: "pick", reply: "theme:money" }];

export const SCENES = {
  /* ---------- start screen ---------- */
  returning: { ...ret, label: "Returning user" },
  firstVisit: { ...first, label: "First visit", props: { name: "Alex" } },
  noName: { ...first, label: "No profile name" },
  english: { ...ret, ctx: CTX_ENGLISH, label: "English practice" },
  afterEndSaving: { ...ret, label: "After End: saving", recent: RECENT_SAVING },
  afterEndSaved: { ...ret, label: "After End: saved", toast: "saved" },
  typed: { ...ret, label: "Typed a message", props: { name: "Alex", composer: { text: "I have an HR screen with Lumen tomorrow" } } },
  pasted: { ...ret, label: "Pasted a job", props: { name: "Alex", composer: { text: PASTED_TEXT } } },
  fileAttached: { ...ret, label: "Job file attached", props: { name: "Alex", composer: { text: "", file: JOB_FILE } } },
  loading: { ...ret, label: "Loading", props: { name: "Alex", loading: true, suggestions: [] }, recent: { status: "loading" }, engine: { name: "Ollama · qwen3:4b", status: "checking" } },
  engineDown: { ...ret, label: "Engine not running", props: { name: "Alex", ...engineDown }, engine: ENGINE_DOWN },
  browserUnsupported: { ...ret, label: "Browser can't recognise speech", props: { name: "Alex", browserBanner: true } },
  storageError: {
    ...first,
    label: "Saved sessions unreadable",
    props: { name: "Alex", storageError: true, suggestions: suggestionsFor(CTX_FIRST).filter((x) => x.id !== "example") },
    recent: { status: "error" },
  },
  overflowStart: { ...ret, ctx: CTX_OVERFLOW, label: "Overflow, text +30%", props: { name: LONG_NAME }, recent: RECENT_LONG },
  quickTextMode: { ...ret, label: "Quick start, answering by typing", props: { name: "Alex", textMode: true } },
  quickStarting: { ...ret, label: "Start mic pressed", props: { name: "Alex", starting: true } },
  /* QA-02: the remembered job's questions are still being written: the mic waits, as Start does in the plan. */
  quickWaiting: {
    ...ret,
    label: "Start mic waits for the job's questions",
    props: { name: "Alex", quickStart: { detail: "Kestrel Pay · Behavioural · 5 questions · voice", answer: "voice", wait: true } },
  },

  /* ---------- setup chat ---------- */
  jobReading: { ...ret, label: "Reading a pasted job", inputs: [{ do: "begin", input: { kind: "text", text: PASTED_TEXT } }], hold: true },
  jobPasted: { ...ret, label: "Job read", inputs: PASTED },
  linkFetching: { ...ret, label: "Opening a link", inputs: [{ do: "begin", input: { kind: "text", text: JOB_LINK } }], hold: true },
  linkError: { ...ret, label: "Link needs a login", inputs: [{ do: "begin", input: { kind: "text", text: JOB_LINK } }, { do: "resolve", result: { ok: false } }] },
  fileReading: { ...ret, label: "Reading a file", inputs: [{ do: "begin", input: { kind: "file", ...JOB_FILE } }], hold: true },
  fileError: { ...ret, label: "File can't be read", inputs: [{ do: "begin", input: { kind: "file", ...JOB_FILE } }, { do: "resolve", result: { ok: false } }] },
  askJob: { ...ret, label: "T1: which job", inputs: ASK_JOB },
  savedJobPicked: { ...ret, label: "Saved job picked → T2", inputs: SAVED_PICKED },
  keywordMatch: { ...ret, label: "Keywords matched → T3", inputs: [{ do: "begin", input: { kind: "text", text: "I have an HR screen with Lumen tomorrow" } }] },
  askRound: { ...first, label: "T2: which round (first visit)", inputs: [{ do: "begin", input: { kind: "suggestion", id: "general" } }] },
  askAnything: { ...ret, label: "T3: anything else", inputs: ASK_ANYTHING },
  /* D89: a file in the chat. At T3 without a CV it is the CV; at T1 it is the job. */
  askAnythingNoCv: { ...ret, ctx: CTX_NO_CV, label: "T3, no CV yet", inputs: ASK_ANYTHING },
  cvAttached: { ...ret, ctx: CTX_NO_CV, label: "CV attached in the chat", inputs: ASK_ANYTHING, props: { name: "Alex", composer: { text: "", file: CV_FILE } } },
  cvReading: { ...ret, ctx: CTX_NO_CV, label: "Reading the CV", inputs: [...ASK_ANYTHING, { do: "attach", file: CV_FILE }], hold: true },
  cvAdded: { ...ret, ctx: CTX_NO_CV, label: "CV added", inputs: [...ASK_ANYTHING, { do: "attach", file: CV_FILE }, { do: "resolveCv", result: "ok" }] },
  cvError: {
    ...ret, ctx: CTX_NO_CV, label: "CV can't be read", cvWith: "unreadable",
    inputs: [...ASK_ANYTHING, { do: "attach", file: CV_FILE }, { do: "resolveCv", result: "unreadable" }],
  },
  /* D90: the chat composer is one row, [+] [text] [mic]; the mic dictates into the field. */
  dictating: { ...ret, label: "Dictating a reply", inputs: ASK_ANYTHING, dictate: "listening" },
  dictationError: { ...ret, label: "Dictation caught nothing", inputs: ASK_ANYTHING, dictate: "no_speech" },
  jobFileInChat: { ...ret, label: "Job file at T1", inputs: [...ASK_JOB, { do: "attach", file: JOB_FILE }], hold: true },
  roundNotCaught: { ...first, label: "Round not caught", inputs: [{ do: "begin", input: { kind: "suggestion", id: "general" } }, { do: "say", text: "not sure honestly" }] },
  freeTextNote: { ...ret, label: "T3 answered in words", inputs: [...ASK_ANYTHING, { do: "say", text: NOTE }] },
  plan: { ...ret, label: "Plan", inputs: PLAN },
  planPreparing: { ...ret, label: "Plan, questions preparing", inputs: PASTED_PLAN },
  planPrepError: { ...ret, label: "Plan, questions failed", inputs: [...PASTED_PLAN, { do: "update", job: { ...KESTREL_PASTED, state: "error" } }] },
  planMoneyOff: { ...ret, label: "Interview plan, salary talk offered", note: "A row \"End with a salary talk\", off by default.", inputs: PLAN },
  planMoneyOn: { ...ret, label: "Interview plan, ends with a salary talk", inputs: [...PLAN, { do: "moneyNumbers", values: { role: "Senior Product Designer", target: "96,000", currency: "EUR" } }] },
  planNoCv: { ...ret, ctx: CTX_NO_CV, label: "Plan without a CV", inputs: PLAN },
  planEngineDown: { ...ret, label: "Plan, engine not running", inputs: PLAN, props: { name: "Alex", ...engineDown }, engine: ENGINE_DOWN },
  planTextMode: { ...ret, label: "Plan, answering by typing", inputs: PLAN, props: { name: "Alex", textMode: true, browserBanner: true } },
  planChangeOpen: { ...ret, label: "Plan, Change round open", inputs: PLAN, props: { name: "Alex", initialOverlay: "change-round" } },
  skipped: { ...ret, label: "Skip questions at T2", inputs: [...SAVED_PICKED, { do: "skip" }] },
  again: { ...ret, label: "Kestrel Pay again", inputs: [{ do: "begin", input: { kind: "suggestion", id: "again" } }] },
  drill: { ...ret, label: "Drill my weak spots", inputs: [{ do: "begin", input: { kind: "suggestion", id: "drill" } }] },
  drillPlan: { ...ret, label: "Drill plan", inputs: [{ do: "begin", input: { kind: "suggestion", id: "drill" } }, { do: "pick", reply: "focus:content" }] },
  example: { ...first, label: "Show me an example", inputs: [{ do: "begin", input: { kind: "suggestion", id: "example" } }] },
  englishLevel: { ...first, ctx: CTX_ENGLISH_FIRST, label: "English, level (first visit)", inputs: [{ do: "begin", input: { kind: "suggestion", id: "en-free" } }] },
  englishPhrases: {
    ...ret,
    ctx: CTX_ENGLISH,
    label: "English, phrases question",
    inputs: [{ do: "begin", input: { kind: "suggestion", id: "en-work" } }, { do: "pick", reply: "level:B2" }],
  },
  englishPlan: {
    ...ret,
    ctx: CTX_ENGLISH,
    label: "English plan",
    inputs: [{ do: "begin", input: { kind: "suggestion", id: "en-work" } }, { do: "pick", reply: "level:B2" }, { do: "pick", reply: "phrases:yes" }],
  },
  starting: { ...ret, label: "Start pressed, connecting", inputs: PLAN, props: { name: "Alex", starting: true } },
  overflowSetup: {
    ...ret,
    ctx: CTX_OVERFLOW,
    label: "Setup overflow, text +30%",
    note: "Long job post (40 lines, collapsed to 3), long company and role, a 300-character note, 7 jobs in Change job.",
    props: { name: LONG_NAME, initialOverlay: "change-job" },
    recent: RECENT_LONG,
    inputs: [
      { do: "begin", input: { kind: "text", text: PASTED_LONG } },
      { do: "resolve", result: { ok: true, job: { ...KESTREL_LONG, questions: 12, state: "ready" } } },
      { do: "pick", reply: "round:behavioural" },
      { do: "say", text: NOTE_LONG },
    ],
  },

  /* ---------- tough talk (tough-talk.md §2) ---------- */
  negScenario: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: which kind of call", note: "Five scenarios with a one-line blurb each; the first question of the setup.", inputs: NEG_SCENARIO },
  negScenarioMobile: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: which kind of call, 375", inputs: NEG_SCENARIO },
  negRaiseForm: { ...ret, ctx: CTX_NEGOTIATE, label: "Raise: numbers form", note: "Current pay, the raise you ask for, an optional review month.", inputs: scenarioStart("raise") },
  negRaiseError: { ...ret, ctx: CTX_NEGOTIATE, label: "Raise: errors", note: "The ask is not above the current pay.", inputs: scenarioStart("raise"), numbersView: { values: { currentPay: "72,000", ask: "60,000" }, showErrors: true } },
  negCounterForm: { ...ret, ctx: CTX_NEGOTIATE, label: "Counteroffer: numbers form", inputs: scenarioStart("counteroffer") },
  negScreeningForm: { ...ret, ctx: CTX_NEGOTIATE, label: "Screening: numbers form", inputs: scenarioStart("screening") },
  negInternForm: { ...ret, ctx: CTX_NEGOTIATE, label: "Internship: numbers form", inputs: scenarioStart("internship") },
  negRaisePlan: { ...ret, ctx: CTX_NEGOTIATE, label: "Raise: plan with tactics", inputs: [...RAISE_NUMBERS, { do: "pick", reply: "style:firm" }] },
  negCounterPlan: { ...ret, ctx: CTX_NEGOTIATE, label: "Counteroffer: plan with tactics", inputs: [...COUNTER_NUMBERS, { do: "pick", reply: "style:firm" }] },
  negRole: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-1: which role", inputs: NEG_START },
  negRoleTyping: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-1: type the role", inputs: [...NEG_START, { do: "pick", reply: "role:type" }] },
  negRangeReading: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: reading the post for a range", inputs: [...NEG_START, { do: "pick", reply: "job:v1" }], hold: true },
  negNumbersEmpty: {
    ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-2: numbers, nothing known",
    note: "No job, role typed: no range, no remembered numbers.",
    inputs: [...NEG_START, { do: "pick", reply: "role:type" }, { do: "say", text: "Product Designer" }],
  },
  negNumbersPrefilled: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-2: numbers, range from the post", inputs: NEG_NUMBERS },
  negNumbersError: {
    ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-2: numbers, errors",
    note: "Top below bottom, no target: errors appear on submit, in the field, with the icon.",
    inputs: NEG_NUMBERS,
    numbersView: { values: { low: "98,000", high: "85,000", target: "" }, showErrors: true },
  },
  negNumbersMobile: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-2: numbers, 375", inputs: NEG_NUMBERS },
  negStyleFirst: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate N-3: style, first try", inputs: NEG_STYLE },
  negStyleAgain: { ...ret, ctx: CTX_NEGOTIATE_AGAIN, label: "Negotiate N-3: style, returning", inputs: NEG_STYLE },
  negPlan: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate plan with tactics", inputs: NEG_PLAN },
  negPlanMobile: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate plan, 375", inputs: NEG_PLAN },
  negPlanOffer: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate plan, real offer (N7 joins)", inputs: [...NEG_PLAN, { do: "change", row: "offer", value: "on" }] },
  negPlanNumbersOpen: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate plan: Change your numbers", inputs: NEG_PLAN, props: { name: "Alex", initialOverlay: "change-numbers" } },
  negPlanStyleOpen: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate plan: Change Mike", inputs: NEG_PLAN, props: { name: "Alex", initialOverlay: "change-style" } },
  negPrepAsk: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: prepare first?", inputs: NEG_PREP },
  negPrepAskLast: { ...ret, ctx: CTX_NEGOTIATE_LAST, label: "Negotiate: prepare first? (a case from last time)", inputs: NEG_PREP },
  negCourseStep: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: mini-course, step 1", inputs: NEG_COURSE },
  negCourseStepMobile: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: mini-course, step 1, 375", inputs: NEG_COURSE },
  negCaseResults: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: your case, results", inputs: NEG_CASE1 },
  negCaseFallbacks: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: your case, what else would work", inputs: [...NEG_CASE3, { do: "pick", reply: "case3:step_up" }] },
  negCasePlan: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: Your case card and the plan row", inputs: NEG_CASE_PLAN },
  negCasePlanMobile: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate: Your case card and the plan row, 375", inputs: NEG_CASE_PLAN },
  negPlanHidden: { ...ret, ctx: { ...CTX_NEGOTIATE, talk: TALK_HIDDEN }, label: "Negotiate plan, tactics hidden", inputs: NEG_PLAN },
  negPlanEngineDown: { ...ret, ctx: CTX_NEGOTIATE, label: "Negotiate plan, engine not running", inputs: NEG_PLAN, props: { name: "Alex", ...engineDown }, engine: ENGINE_DOWN },
  negSkipped: { ...ret, ctx: CTX_NEGOTIATE_AGAIN, label: "Negotiate: Skip with remembered numbers", inputs: [...NEG_START, { do: "pick", reply: "job:v1" }, { do: "resolveRange", result: RANGE }, { do: "skip" }] },
  toughTheme: { ...ret, ctx: CTX_TOUGH, label: "Tough T-1: which theme", inputs: [{ do: "begin", input: { kind: "suggestion", id: "tough" } }] },
  toughThemeMobile: { ...ret, ctx: CTX_TOUGH, label: "Tough T-1: which theme, 375", inputs: [{ do: "begin", input: { kind: "suggestion", id: "tough" } }] },
  toughPlan: { ...ret, ctx: CTX_TOUGH, label: "Tough plan with tactics", inputs: TOUGH_PLAN },
  toughPlanMobile: { ...ret, ctx: CTX_TOUGH, label: "Tough plan, 375", inputs: TOUGH_PLAN },
  toughPersonal: { ...ret, ctx: CTX_TOUGH, label: "Tough: Personal questions", inputs: [{ do: "begin", input: { kind: "suggestion", id: "tough" } }, { do: "pick", reply: "theme:personal" }] },
  toughPlanThemeOpen: { ...ret, ctx: CTX_TOUGH, label: "Tough plan: Change theme", inputs: TOUGH_PLAN, props: { name: "Alex", initialOverlay: "change-theme" } },
  toughPlanHidden: { ...ret, ctx: { ...CTX_TOUGH, talk: TALK_HIDDEN }, label: "Tough plan, tactics hidden", inputs: TOUGH_PLAN },
  toughPlanEngineDown: { ...ret, ctx: CTX_TOUGH, label: "Tough plan, engine not running", inputs: TOUGH_PLAN, props: { name: "Alex", ...engineDown }, engine: ENGINE_DOWN },
} satisfies Record<string, HomeScene>;

export type HomeSceneId = keyof typeof SCENES;
