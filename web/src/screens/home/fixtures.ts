/* Home fixture: docs/ia.md §6 (Alex Morgan, Product Designer; Kestrel Pay / Lumen Health / Fieldnote). All fictional.
 * The stress fixture (+30% text) lives apart, as the shared rules ask (ds/screens/_index.md §2). */
import type { ScriptContext } from "./script";
import type { JobItem, Phrase, WeakItem } from "./types";

export const KESTREL: JobItem = {
  id: "v1",
  company: "Kestrel Pay",
  role: "Senior Product Designer",
  added: "Oct 18",
  preview: "Own the end-to-end checkout experience for small merchants on web and mobile.",
  questions: 12,
  state: "ready",
};
export const LUMEN: JobItem = {
  id: "v2",
  company: "Lumen Health",
  role: "Product Designer, Design Systems",
  added: "Oct 15",
  preview: "Grow the design system that three clinical product teams build on.",
  questions: 8,
  state: "ready",
};
export const FIELDNOTE: JobItem = {
  id: "v3",
  company: "Fieldnote",
  role: "Lead UX Designer",
  added: "Oct 9",
  preview: "Lead research and design for a note-taking tool used by field teams.",
  questions: 9,
  state: "ready",
};
export const JOBS: JobItem[] = [KESTREL, LUMEN, FIELDNOTE];

export const WEAK: WeakItem[] = [
  { id: "w1", layer: "content", title: "No result in your answers", short: "no result", phrase: "no result in 4 answers", tip: "End each story with what changed.", count: "4 answers in 2 sessions" },
  { id: "w2", layer: "content", title: "“we” instead of “I”", short: "“we” instead of “I”", phrase: "“we” instead of “I” in 3", tip: "Say what you did yourself.", count: "3 answers" },
  { id: "w3", layer: "language", title: "“I have led” for finished projects", short: "“I have led”", count: "2 times" },
  { id: "w4", layer: "delivery", title: "About 9 fillers per answer", short: "fillers", count: "5 answers" },
];

export const PHRASES: Phrase[] = [
  { id: "p1", from: "discuss about the plan", to: "discuss the plan", wrong: "about", right: "", times: 2 },
  { id: "p2", from: "since three years", to: "for three years", wrong: "since", right: "for", times: 2 },
];

/** The pasted job (1,240 characters in the map; this one is long enough to read as a job). */
export const PASTED_TEXT = [
  "Senior Product Designer at Kestrel Pay",
  "",
  "Kestrel Pay builds payments for small merchants. You will own the end-to-end checkout experience on web and mobile.",
  "You will lead research, shape the design system and work with two engineering squads and a product manager.",
  "We expect six or more years in product design, a portfolio with shipped payment or commerce flows, and clear writing.",
  "You will run usability tests every sprint, turn what you learn into clear decisions and present them to leadership.",
  "You care about accessibility, you write clear specs, and you enjoy pairing with engineers on the details of a flow.",
  "Nice to have: experience with risk and fraud tooling, merchant onboarding, or designing for several markets at once.",
  "We offer a hybrid setup, a learning budget, and a team that ships every week. Interviews: HR screen, behavioural, portfolio.",
].join("\n");
export const JOB_LINK = "https://jobs.lumenhealth.example/product-designer-design-systems";
export const JOB_FILE = { name: "kestrel-pay-senior-pd.pdf", size: "184 KB" };
/** D89: the CV sent later in the chat. */
export const CV_FILE = { name: "alex-morgan-cv.pdf", size: "96 KB" };
/** What the fake dictation "hears" in stories (D90). */
export const DICTATED = "They asked me last time about stakeholder pushback, I'd like to practise that";

/** Returning user: 2 interviews, CV, three saved jobs, four weak spots, last time Kestrel Pay · Behavioural · Standard. */
export const CTX_RETURNING: ScriptContext = {
  track: "interview",
  firstVisit: false,
  hasCv: true,
  jobs: JOBS,
  last: { date: "Oct 19", jobId: KESTREL.id, round: "behavioural", strictness: 2 },
  strictness: 2,
  questions: 5,
  weak: WEAK,
  weakSessions: 2,
  level: "B2",
  phrases: PHRASES,
};
export const CTX_FIRST: ScriptContext = {
  track: "interview",
  firstVisit: true,
  hasCv: false,
  jobs: [],
  strictness: 2,
  questions: 5,
  weak: [],
  weakSessions: 0,
  level: null,
  phrases: [],
};
export const CTX_NO_WEAK: ScriptContext = { ...CTX_RETURNING, weak: [], weakSessions: 0 };
export const CTX_NO_CV: ScriptContext = { ...CTX_RETURNING, hasCv: false };
export const CTX_ENGLISH: ScriptContext = { ...CTX_RETURNING, track: "english" };
export const CTX_ENGLISH_FIRST: ScriptContext = { ...CTX_FIRST, track: "english" };

/** A pasted job the server read (company and role from its first line). */
export const KESTREL_PASTED: JobItem = { ...KESTREL, id: "v9", added: "Oct 20", questions: 0, state: "preparing" };

/* ---------- stress fixture (+30%): long names, 7 jobs ---------- */

export const LONG_NAME = "Alexandra-Marie Okonkwo-Lindqvist";

export const KESTREL_LONG: JobItem = {
  ...KESTREL,
  company: "Kestrel Payments International Holdings",
  role: "Senior Staff Product Designer, Platform Experience and Growth",
  preview: "Own the end-to-end checkout experience for small and mid-size merchants across web, mobile and in-store terminals.",
};
export const JOBS_MANY: JobItem[] = [
  KESTREL_LONG,
  LUMEN,
  { ...FIELDNOTE, state: "preparing" },
  { id: "v4", company: "Brightline", role: "Product Designer, Growth", added: "Oct 8", preview: "Run experiments on onboarding.", questions: 10, state: "ready" },
  { id: "v5", company: "Northwind Labs", role: "Design Lead", added: "Oct 6", preview: "Short post.", questions: 3, state: "short" },
  { id: "v6", company: "Paperplane", role: "UX Researcher", added: "Oct 3", preview: "Interview customers every week.", questions: 9, state: "ready" },
  { id: "v7", company: "Tidewater Logistics", role: "Senior Designer, Dispatch Tools", added: "Sep 28", preview: "Tools for dispatchers.", questions: 7, state: "ready" },
];
export const WEAK_LONG: WeakItem[] = [
  { ...WEAK[0]!, phrase: "no measurable result or outcome in 4 of your answers", tip: "End each story with what changed for the customer, the team or the business, with a number if you have one." },
  { ...WEAK[1]!, phrase: "“we” instead of “I” when you describe your own part of the work, in 3 answers" },
  ...WEAK.slice(2),
];
export const CTX_OVERFLOW: ScriptContext = {
  ...CTX_RETURNING,
  jobs: JOBS_MANY,
  last: { ...CTX_RETURNING.last!, jobId: KESTREL_LONG.id },
  weak: WEAK_LONG,
};

/** A 40-line job (the overflow chat clamps it to 3 lines + "Show all"). */
export const PASTED_LONG = Array.from({ length: 5 }, () => PASTED_TEXT).join("\n\n");
