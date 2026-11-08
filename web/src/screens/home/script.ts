/* The Home setup chat, scripted (home.md v2 §4, owner default "the setup chat is scripted": no LLM). A pure,
 * deterministic state machine: every function takes the context + the current state and returns the next state.
 * The live HomeScreen and the review harness both run it, so every review state is reachable by replaying inputs.
 *
 * Interview: up to three questions (T1 job · T2 round · T3 anything else), each skipped when the first message already
 * answered it ("I have an HR screen with Lumen tomorrow" → straight to T3, "Step 1 of 1"), then the plan.
 * English: E1 level · E2 topic · phrases (only when there are some), then the plan.
 * Again / Drill / Example: their own short paths. Real work (reading a pasted job, opening a link, reading a file) is
 * a pending Mike message that the container resolves with `resolveJob` once the server answers. */
import { t, tMaybe, tp } from "../../i18n";
import { lowerFirstWord } from "./sessionFocus";
import type { WeakSpotLayer } from "../../ds";
import type { CourseStep, NegotiateCase, NegotiatePrep, NegotiateScenario, NegotiateStyle, TacticCardData, ToughTheme } from "../../lib/types";
import { formatAmount } from "../../lib/amount";
import {
  DEFAULT_SCENARIO, isScenario, numbersFromStart, SCENARIO_FIELDS, SCENARIO_ORDER, toNegotiateStart, validateNumbers, valuesFromMemory, type NumbersValues,
} from "./numbers";
import type {
  EnglishTopic, JobItem, Level, NumbersMemory, Phrase, PlanModel, PlanRow, RoundType, SetupModel, SetupReply, SetupTurn,
  Strictness, Suggestion, SuggestionId, TalkContext, Track, WeakItem,
} from "./types";

export const QUESTIONS_PER_MIN = 4;
export const minutesFor = (questions: number) => questions * QUESTIONS_PER_MIN;
/** Drill is a short session: 3 questions aimed at the focus. */
export const DRILL_QUESTIONS = 3;
/** Pasting at least this much text (or a link) reads as a job (US-10 AC3 keeps 80 as the "short" line). */
export const MIN_JOB_CHARS = 80;
const SHORT_JOB_CHARS = 400;
const ROUNDS: RoundType[] = ["hr", "behavioural", "technical", "mix"];
const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];
const TOPICS: EnglishTopic[] = ["free", "work", "small"];

export interface ScriptContext {
  track: Track;
  firstVisit: boolean;
  hasCv: boolean;
  jobs: JobItem[];
  /** The last interview: Again repeats it, T2 names its round. */
  last?: { date: string; jobId: string | null; round: RoundType; strictness: Strictness };
  strictness: Strictness;
  questions: number;
  weak: WeakItem[];
  weakSessions: number;
  /** English: the level from the last English session (null = first visit). */
  level?: Level | null;
  phrases: Phrase[];
  /** Interview: the plan offers "End with a salary talk" (false for Gemini Live: the server runs it on the scripted / Ollama engines). */
  moneyTalk?: boolean;
  /** Tough talk: server content, remembered style / numbers, hidden-tactics preferences (absent: the chips only). */
  talk?: TalkContext;
}

type Stage =
  | "job" | "round" | "anything" | "level" | "topic" | "phrases" | "drill" | "example" | "plan" | "pending"
  | "scenario" | "role" | "numbers" | "style" | "theme"
  /** Negotiation v3 (D118): the "prepare first?" question, the mini-course, the three case questions. */
  | "prep" | "course" | "case1" | "case2" | "case3";

const isTalk = (track: Track): track is "tough" | "negotiate" => track === "tough" || track === "negotiate";
const STYLE_ORDER: NegotiateStyle[] = ["friendly", "firm", "tight"];
const STYLES: NegotiateStyle[] = ["friendly", "firm", "tight", "surprise"];
const THEMES: ToughTheme[] = ["money", "leaving", "weakness", "fit", "english", "personal", "mix"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "PLN"];
const ROLE_MAX = 80;
const NEGOTIATE_TURNS = 12;
const NEGOTIATE_MINUTES = 10;
const TOUGH_TOTAL = 5;
const TOUGH_MIN_PER_QUESTION = 3;

interface Draft {
  kind: "interview" | "drill" | "english" | "tough" | "negotiate";
  /** undefined = not asked yet, null = general questions. */
  jobId?: string | null;
  round?: RoundType;
  strictness: Strictness;
  note?: string;
  level?: Level;
  topic?: string;
  usePhrases?: boolean;
  focus?: "all" | WeakSpotLayer;
  /** A drill from a debrief works on that debrief's weak spots (C1), not on the shared memory in the context. */
  weak?: WeakItem[];
  /** Negotiate: the role (a saved job's title or typed), the committed numbers card, the range read from the post. */
  scenario?: NegotiateScenario;
  role?: string;
  numbers?: NumbersValues;
  /** Interview: "End with a salary talk" and its numbers (the screening fields). */
  money?: boolean;
  moneyNumbers?: NumbersValues;
  range?: { low: number; high: number; currency: string | null };
  style?: NegotiateStyle;
  /** Tough questions. */
  theme?: ToughTheme;
  /** "Hide tactics" pressed in this chat; undefined = the stored preference. */
  tacticsHidden?: boolean;
  /** Negotiate v3: the answer to "Want to prepare first?" (undefined = not asked / skipped). */
  prep?: "yes" | "no" | "last";
  /** The course was shown in this chat, or the reused case had it: the call shows the steps strip. */
  course?: boolean;
  courseIdx?: number;
  case?: NegotiateCase;
}

export interface SetupState {
  track: Track;
  stage: Stage;
  /** The questions this chat asks, in order (for "Step n of m"). Empty for Again / Drill. */
  steps: Stage[];
  turns: SetupTurn[];
  draft: Draft;
  /** Jobs added during this chat (pasted, linked, file) on top of the context's list. */
  jobs: JobItem[];
  /** A pending job read the container has to resolve. */
  pending?: { turnId: string; kind: "job" | "link" | "file" | "cv" | "range"; jobId?: string; text?: string; url?: string; file?: string; replies?: SetupReply[] };
  skipped?: boolean;
  seq: number;
}

export type StartInput =
  | { kind: "text"; text: string }
  | { kind: "file"; name: string; size: string }
  /** `scenario`: Negotiate opened from a link (`?scenario=`): the scenario question is skipped. */
  | { kind: "suggestion"; id: SuggestionId; scenario?: NegotiateScenario }
  /** "Drill these weak spots" in a debrief: straight to the plan, with that interview's job (F-13-8, F-13-14) and,
   *  when given, that interview's own weak spots instead of the shared memory (C1). `jobId: null` = that interview had no
   *  job: General questions, never the remembered one. */
  | { kind: "drill"; jobId?: string | null; weak?: WeakItem[] };

/* ---------- copy helpers ---------- */

const roundLabel = (r: RoundType) => t(`home.round.${r}`);
const strictKey = { 1: "gentle", 2: "standard", 3: "tough" } as const;
export const strictnessLabel = (s: Strictness) => t(`home.strictness.${strictKey[s]}.label`);
const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
export const numberWord = (n: number) => (n >= 1 && n <= 9 ? t(`chat.num.${n}` as "chat.num.1") : String(n));
const quoted = (s: string) => `“${s}”`;
const listAnd = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${t("chat.setup.and")} ${items[items.length - 1]}`;

export const roundValue = (r: RoundType) => `${roundLabel(r)}: ${lowerFirst(t(r === "technical" ? "home.round.technicalHint" : `home.round.${r}Hint`))}`;
export const strictnessValue = (s: Strictness) => `${strictnessLabel(s)}: ${lowerFirst(t(`home.strictness.${strictKey[s]}.desc`))}`;
export const levelValue = (l: Level) => `${l}: ${lowerFirst(t(`english.levels.${l}`))}`;
export const layerLabel = (layer: WeakSpotLayer) => t(`feedback.layer.${layer}`);

export function looksLikeUrl(text: string) {
  return /^https?:\/\/\S+$/i.test(text.trim()) || /^[\w-]+(\.[\w-]+)+\/\S*$/i.test(text.trim());
}
export function looksLikeJob(text: string): boolean {
  const v = text.trim();
  return v.length >= MIN_JOB_CHARS || looksLikeUrl(v);
}

/* ---------- keyword matching (deterministic, English only) ---------- */

export function matchRound(text: string): RoundType | undefined {
  const v = text.toLowerCase();
  if (/\bhr\b|screen|recruiter/.test(v)) return "hr";
  if (/behaviou?r|stories|story round/.test(v)) return "behavioural";
  if (/technical|\btech\b|case study|whiteboard|portfolio/.test(v)) return "technical";
  if (/\bmix|unseen|surprise|random/.test(v)) return "mix";
  return undefined;
}
export function matchStrictness(text: string): Strictness | undefined {
  const v = text.toLowerCase();
  if (/gentle|easy|soft|kind|nervous/.test(v)) return 1;
  if (/tough|hard|push|strict|harsh/.test(v)) return 3;
  return undefined;
}
export function matchJob(text: string, jobs: JobItem[]): JobItem | undefined {
  const v = text.toLowerCase();
  return jobs.find((j) => {
    const name = j.company.toLowerCase();
    const first = name.split(/\s+/)[0] ?? name;
    return v.includes(name) || (first.length > 2 && new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(v));
  });
}
/** ", Product Manager" after the company, or nothing when the role is not known: no dangling comma (13, QA-04). */
const roleTail = (job: { role: string }) => (job.role.trim() ? `, ${job.role.trim()}` : "");
const matchGeneral = (text: string) => /general|any role|no job|common questions/.test(text.toLowerCase());
export function matchLevel(text: string): Level | undefined {
  const m = text.toUpperCase().match(/\b(A2|B1|B2|C1)\b/);
  return m ? (m[1] as Level) : undefined;
}
export function matchTopic(text: string): EnglishTopic | undefined {
  const v = text.toLowerCase();
  if (/small talk|chat|weather|weekend/.test(v)) return "small";
  if (/\bwork\b|\bjob\b|project|career/.test(v)) return "work";
  if (/free|anything/.test(v)) return "free";
  return undefined;
}

/* ---------- suggestions (home.md §3.3, max 3) ---------- */

/** The second row (tough-talk.md §2.1): always the same three, in the same order. */
function practiceRow(): Suggestion[] {
  return [
    { id: "english", icon: "chat", label: t("chat.suggest.english"), group: "practice" },
    { id: "tough", icon: "hand", label: t("home.talk.chipTough"), group: "practice" },
    { id: "negotiate", icon: "target", label: t("home.talk.chipNegotiate"), group: "practice" },
  ];
}

export function suggestionsFor(ctx: ScriptContext): Suggestion[] {
  if (isTalk(ctx.track)) return [];
  if (ctx.track === "english") {
    if (ctx.level && ctx.phrases.length) {
      return [
        { id: "en-work", icon: "briefcase", label: t("chat.suggest.work") },
        { id: "en-small", icon: "chat", label: t("chat.suggest.small") },
        { id: "en-phrases", icon: "redo", label: tp("chat.suggest.phrases", ctx.phrases.length) },
      ];
    }
    return [
      { id: "en-free", icon: "chat", label: t("chat.suggest.free") },
      { id: "en-work", icon: "briefcase", label: t("chat.suggest.work") },
      { id: "en-small", icon: "chat", label: t("chat.suggest.small") },
    ];
  }
  if (ctx.firstVisit || !ctx.last) {
    return [
      { id: "general", icon: "chat", label: t("chat.suggest.general") },
      { id: "example", icon: "eye", label: t("chat.suggest.example") },
      ...practiceRow(),
    ];
  }
  const lastJob = ctx.jobs.find((j) => j.id === ctx.last?.jobId);
  return [
    { id: "again", icon: "briefcase", label: t("chat.suggest.again", { company: lastJob?.company ?? t("chat.suggest.general") }) },
    ctx.weak.length
      ? { id: "drill", icon: "content", label: t("chat.suggest.drill") }
      : { id: "another", icon: "folder", label: t("chat.suggest.another") },
    ...practiceRow(),
  ];
}

/* ---------- state helpers ---------- */

function empty(ctx: ScriptContext, track: Track): SetupState {
  return {
    track,
    stage: "job",
    steps: [],
    turns: [],
    draft: { kind: track === "english" ? "english" : isTalk(track) ? track : "interview", strictness: ctx.strictness },
    jobs: [],
    seq: 0,
  };
}

const allJobs = (ctx: ScriptContext, s: SetupState) => [...s.jobs, ...ctx.jobs.filter((j) => !s.jobs.some((x) => x.id === j.id))];

function push(s: SetupState, turn: Omit<SetupTurn, "id" | "state"> & { state?: SetupTurn["state"] }): SetupState {
  const id = `t${s.seq + 1}`;
  return { ...s, seq: s.seq + 1, turns: [...s.turns, { state: "final", ...turn, id }] };
}
const user = (s: SetupState, text: string, extra: Partial<SetupTurn> = {}) => push(answerLast(s), { speaker: "user", text, ...extra });
const mike = (s: SetupState, text: string, extra: Partial<SetupTurn> = {}) => push(s, { speaker: "mike", text, ...extra });

/** The open question gets answered: its quick replies leave (motion 3.7 "Quick replies"). */
function answerLast(s: SetupState): SetupState {
  let changed = false;
  const turns = s.turns.map((turn) => {
    if (turn.speaker === "mike" && turn.replies?.length && !turn.answered) {
      changed = true;
      return { ...turn, answered: true };
    }
    return turn;
  });
  return changed ? { ...s, turns } : s;
}

/** Which of the interview questions still need asking. */
function interviewSteps(d: Draft): Stage[] {
  const steps: Stage[] = [];
  if (d.jobId === undefined) steps.push("job");
  if (!d.round) steps.push("round");
  steps.push("anything");
  return steps;
}
function englishSteps(ctx: ScriptContext, d: Draft): Stage[] {
  const steps: Stage[] = [];
  if (!d.level) steps.push("level");
  if (!d.topic) steps.push("topic");
  if (ctx.phrases.length && d.usePhrases === undefined) steps.push("phrases");
  return steps;
}

/* ---------- questions ---------- */

const jobReplies = (ctx: ScriptContext, s: SetupState): SetupReply[] => [
  ...allJobs(ctx, s).slice(0, 3).map((j) => ({ id: `job:${j.id}`, label: j.company, icon: "briefcase" as const })),
  { id: "job:general", label: t("chat.suggest.general") },
];
const roundReplies = (): SetupReply[] => ROUNDS.map((r) => ({ id: `round:${r}`, label: roundLabel(r) }));
const anythingReplies = (): SetupReply[] => [
  { id: "anything:none", label: t("chat.setup.nothingElse") },
  { id: "anything:gentle", label: t("chat.setup.beGentle") },
  { id: "anything:tough", label: t("chat.setup.pushHarder") },
];
const levelLine = (l: Level) => `${l} · ${t(`chat.setup.levelShort.${l}`)}`;

function ask(ctx: ScriptContext, s: SetupState, stage: Stage): SetupState {
  const next = { ...s, stage };
  switch (stage) {
    case "job": {
      const saved = allJobs(ctx, s).length > 0;
      return mike(next, t(saved ? "chat.setup.askJob" : "chat.setup.askJobNoSaved"), { replies: jobReplies(ctx, s) });
    }
    case "round":
      return mike(next, ctx.last ? t("chat.setup.askRound", { round: roundLabel(ctx.last.round) }) : t("chat.setup.askRoundFirst"), { replies: roundReplies() });
    case "anything": {
      const text = ctx.hasCv ? t("chat.setup.askAnything") : `${t("chat.setup.noCv")} ${t("chat.setup.askAnything")}`;
      return mike(next, text, { replies: anythingReplies() });
    }
    case "level": {
      const last = ctx.level;
      if (last) {
        const i = LEVELS.indexOf(last);
        const replies: SetupReply[] = [{ id: `level:${last}`, label: t("chat.setup.levelYes", { level: last }) }];
        if (i > 0) replies.push({ id: `level:${LEVELS[i - 1]}`, label: t("chat.setup.levelEasier", { level: LEVELS[i - 1]! }) });
        if (i < LEVELS.length - 1) replies.push({ id: `level:${LEVELS[i + 1]}`, label: t("chat.setup.levelHarder", { level: LEVELS[i + 1]! }) });
        return mike(next, t("chat.setup.levelSame", { level: last }), { replies });
      }
      return mike(next, t("chat.setup.levelFirst"), { replies: LEVELS.map((l) => ({ id: `level:${l}`, label: levelLine(l) })) });
    }
    case "topic":
      return mike(next, t("chat.setup.topic"), { replies: TOPICS.map((tp2) => ({ id: `topic:${tp2}`, label: t(`english.topics.${tp2}`) })) });
    case "phrases": {
      const list = listAnd(ctx.phrases.slice(0, 3).map((p) => quoted(p.from)));
      return mike(next, tp("chat.setup.phrases", ctx.phrases.length, { count: numberWord(ctx.phrases.length), list }), {
        replies: [{ id: "phrases:yes", label: t("chat.setup.phrasesYes") }, { id: "phrases:no", label: t("chat.setup.phrasesNo") }],
      });
    }
    default:
      return next;
  }
}

/** Ask the next open question, or show the plan. */
function advance(ctx: ScriptContext, s: SetupState): SetupState {
  const open = s.track === "english" ? englishSteps(ctx, s.draft) : interviewSteps(s.draft);
  if (s.track === "interview" && s.draft.kind === "interview") {
    // T3 is asked once: after it was answered the plan follows.
    const anythingDone = s.stage === "anything" || s.skipped;
    const next = open.find((st) => st !== "anything") ?? (anythingDone ? undefined : "anything");
    return next ? ask(ctx, s, next) : showPlan(ctx, s);
  }
  const next = open[0];
  return next ? ask(ctx, s, next) : showPlan(ctx, s);
}

function showPlan(_ctx: ScriptContext, s: SetupState, text = t("chat.setup.plan")): SetupState {
  return mike({ ...s, stage: "plan" }, text, { plan: true });
}

/* ---------- entry points ---------- */

/** The first message from the start screen. */
export function begin(ctx: ScriptContext, input: StartInput): SetupState {
  let s = empty(ctx, ctx.track);
  if (input.kind === "suggestion") return suggestion(ctx, s, input.id, input.scenario);
  if (input.kind === "drill") {
    // Nothing to ask: the weak spots are known and the job comes with the link. The focus stays changeable in the plan.
    s.draft = { ...s.draft, kind: "drill", jobId: input.jobId === undefined ? ctx.last?.jobId ?? null : input.jobId, round: "mix", focus: "all", weak: input.weak?.length ? input.weak : undefined };
    return showPlan(ctx, s, t("chat.setup.drillDirect"));
  }
  if (input.kind === "file") {
    s = push(s, { speaker: "user", attachment: { kind: "file", label: input.name, meta: input.size } });
    s.steps = ["job", "round", "anything"];
    return readJob(s, "file", { file: input.name });
  }
  const text = input.text.trim();
  if (ctx.track === "english") {
    s = user(s, text);
    // A level said in the message is taken; otherwise Mike asks (a returning user confirms the last one once).
    const level = matchLevel(text);
    const topic = matchTopic(text);
    s.draft = { ...s.draft, level, topic: topic ? t(`english.topics.${topic}`) : level ? undefined : text };
    s.steps = englishSteps(ctx, s.draft);
    return advance(ctx, s);
  }
  if (looksLikeJob(text)) {
    const url = looksLikeUrl(text);
    s = push(s, {
      speaker: "user",
      text: url ? text : undefined,
      attachment: url ? undefined : { kind: "job", label: text, meta: t("chat.setup.jobMeta", { n: text.length.toLocaleString("en-US") }) },
    });
    s.steps = ["job", "round", "anything"];
    return readJob(s, url ? "link" : "job", url ? { url: text } : { text });
  }
  s = user(s, text);
  const job = matchJob(text, ctx.jobs);
  const round = matchRound(text);
  const strict = matchStrictness(text);
  s.draft = { ...s.draft, jobId: job ? job.id : matchGeneral(text) ? null : undefined, round, strictness: strict ?? s.draft.strictness };
  s.steps = interviewSteps(s.draft);
  if (job && round) s = mike(s, t("chat.setup.keywordMatch", { round: roundLabel(round), company: job.company }));
  else if (job) s = mike(s, pickedLine(job));
  else if (round) s = mike(s, t("chat.setup.roundOnly", { round: roundLabel(round) }));
  return advance(ctx, s);
}

function pickedLine(job: JobItem) {
  if (job.state === "preparing") return t("chat.setup.savedPreparing", { company: job.company, roleTail: roleTail(job) });
  return tp("chat.setup.savedPicked", job.questions, { company: job.company, roleTail: roleTail(job) });
}

function suggestion(ctx: ScriptContext, s: SetupState, id: SuggestionId, scenario?: NegotiateScenario): SetupState {
  const label = id === "tough" ? t("home.talk.chipTough")
    : id === "negotiate" ? t("home.talk.chipNegotiate")
    : suggestionsFor(ctx).find((x) => x.id === id)?.label ?? id;
  switch (id) {
    case "again": {
      const last = ctx.last;
      const job = ctx.jobs.find((j) => j.id === last?.jobId);
      s = user(s, label);
      s.draft = { ...s.draft, jobId: job?.id ?? null, round: last?.round ?? "behavioural", strictness: last?.strictness ?? ctx.strictness };
      const vars = { date: last?.date ?? "", round: roundLabel(s.draft.round!), strictness: strictnessLabel(s.draft.strictness) };
      return showPlan(ctx, s, job ? t("chat.setup.again", { ...vars, company: job.company }) : t("chat.setup.againGeneral", vars));
    }
    case "drill": {
      s = user(s, label);
      s.draft = { ...s.draft, kind: "drill", jobId: ctx.last?.jobId ?? null, round: "mix" };
      const top = ctx.weak.slice(0, 2).map((w) => w.phrase ?? lowerFirstWord(w.title));
      const rest = ctx.weak.length - top.length;
      const head = ctx.weakSessions > 1 ? t("chat.setup.drill", { n: ctx.weakSessions, list: listAnd(top) }) : t("chat.setup.drillOne", { list: listAnd(top) });
      const more = rest > 0 ? ` ${tp("chat.setup.drillMore", rest, { n: numberWord(rest) })}` : "";
      const counts = (["content", "language", "delivery"] as const)
        .map((layer) => ({ layer, n: ctx.weak.filter((w) => w.layer === layer).length }))
        .filter((x) => x.n > 0);
      return mike({ ...s, stage: "drill" }, `${upperFirst(head)}${more} ${t("chat.setup.drillAsk")}`, {
        aside: t("home.workOn.misheard"),
        replies: [
          { id: "focus:all", label: t("chat.setup.drillAll", { n: ctx.weak.length }) },
          ...counts.map((c) => ({ id: `focus:${c.layer}`, label: `${layerLabel(c.layer)} ${c.n}`, icon: c.layer })),
        ],
      });
    }
    case "example": {
      s = user(s, label);
      s = mike({ ...s, stage: "example" }, t("chat.setup.example"), { example: true });
      return mike(s, t("chat.setup.exampleTry"), {
        replies: [{ id: "example:general", label: t("chat.suggest.general") }, { id: "example:english", label: t("chat.suggest.english") }],
      });
    }
    case "english": {
      // Keep the conversation (the example path ends here too); the track switches to English.
      s = user({ ...s, track: "english", draft: { kind: "english", strictness: ctx.strictness } }, label);
      s.steps = englishSteps(ctx, s.draft);
      return advance(ctx, s);
    }
    case "general": {
      s = user(s, label);
      s.draft = { ...s.draft, jobId: null };
      s.steps = interviewSteps(s.draft);
      s = mike(s, t("chat.setup.generalPicked"));
      return advance(ctx, s);
    }
    case "another": {
      s = user(s, label);
      s.steps = interviewSteps(s.draft);
      return advance(ctx, s);
    }
    case "en-free": case "en-work": case "en-small": {
      const topic = id.slice(3) as EnglishTopic;
      s = user(s, label);
      s.draft = { ...s.draft, topic: t(`english.topics.${topic}`) };
      s.steps = englishSteps(ctx, s.draft);
      return advance(ctx, s);
    }
    case "en-phrases": {
      s = user(s, label);
      s.draft = { ...s.draft, usePhrases: true, topic: t("english.topics.work") };
      s.steps = englishSteps(ctx, s.draft);
      return advance(ctx, s);
    }
    case "tough": {
      s = user({ ...s, track: "tough", draft: { kind: "tough", strictness: ctx.strictness } }, label);
      s.steps = ["theme"];
      return askTheme(ctx, s);
    }
    case "negotiate": {
      s = user({ ...s, track: "negotiate", draft: { kind: "negotiate", strictness: ctx.strictness, scenario } }, label);
      if (scenario) {
        s.steps = ["role", "numbers", "style", "prep"];
        return askRole(ctx, s);
      }
      s.steps = ["scenario", "role", "numbers", "style", "prep"];
      return askScenario(ctx, s);
    }
  }
}

function readJob(s: SetupState, kind: "job" | "link" | "file", payload: { text?: string; url?: string; file?: string }): SetupState {
  const label = kind === "link" ? t("chat.setup.openingLink") : kind === "file" ? t("chat.setup.readingFile") : t("chat.setup.readingJob");
  const next = push({ ...s, stage: "pending" }, { speaker: "mike", state: "pending", pendingLabel: label });
  return { ...next, pending: { turnId: next.turns[next.turns.length - 1]!.id, kind, ...payload } };
}

export type JobResult =
  | { ok: true; job: JobItem; short?: boolean }
  | { ok: false };

/** The server answered a pending read: the pending message becomes the answer, then the next question. */
export function resolveJob(ctx: ScriptContext, s: SetupState, result: JobResult): SetupState {
  const p = s.pending;
  if (!p) return s;
  const turns = s.turns.filter((x) => x.id !== p.turnId);
  let next: SetupState = { ...s, turns, pending: undefined };
  if (!result.ok) {
    const text = p.kind === "file" ? t("chat.setup.fileError") : t("chat.setup.linkError");
    next = push({ ...next, stage: "job" }, {
      speaker: "mike",
      state: "error",
      text,
      action: p.kind === "file" ? undefined : { id: "use-general", label: t("chat.setup.useGeneral"), button: true },
    });
    return next;
  }
  const job = result.job;
  const short = result.short ?? (p.text !== undefined && p.text.length < SHORT_JOB_CHARS);
  next.jobs = [job, ...next.jobs.filter((j) => j.id !== job.id)];
  next.draft = { ...next.draft, jobId: job.id };
  const got = t("chat.setup.jobGot", { company: job.company, roleTail: roleTail(job) });
  next = mike(next, short ? `${got} ${t("chat.setup.jobShort")}` : got, { action: { id: "edit-job", label: t("chat.setup.editDetails"), icon: "edit" } });
  return advance(ctx, { ...next, stage: "job" });
}

/** A quick reply was picked. */
export function pick(ctx: ScriptContext, s: SetupState, turnId: string, replyId: string): SetupState {
  const turn = s.turns.find((x) => x.id === turnId);
  const reply = turn?.replies?.find((r) => r.id === replyId);
  if (!turn || !reply || turn.answered) return s;
  const [kind, value = ""] = replyId.split(":") as [string, string];
  if (kind === "example") {
    return suggestion(ctx, { ...s, turns: s.turns.map((x) => (x.id === turnId ? { ...x, answered: true } : x)) }, value === "english" ? "english" : "general");
  }
  if (kind === "case3" && value !== "done" && value !== "skip") return toggleFallback(s, turnId, value);
  if (kind === "case3") return finishCase3(ctx, s, value === "skip");
  let next = user(s, reply.label);
  switch (kind) {
    case "prep":
      return answerPrep(ctx, next, value as "yes" | "no" | "last");
    case "course":
      return value === "next" ? nextCourseStep(ctx, next) : askCase1(ctx, next);
    case "case1":
      return askCase2(ctx, next);
    case "case2":
      next.draft = { ...next.draft, case: { ...caseOf(next.draft), reason: value === "skip" ? "" : reasonLabel(value) } };
      return askCase3(ctx, next);
    case "job": {
      if (s.track === "negotiate") {
        const job = allJobs(ctx, next).find((j) => j.id === value);
        if (job && !hasField(next.draft, "range")) return askNumbers(ctx, { ...next, draft: { ...next.draft, jobId: job.id, role: job.role.trim() || undefined } });
        return job ? chooseJobForRange(next, job) : askNumbers(ctx, { ...next, draft: { ...next.draft, jobId: null } });
      }
      if (value === "general") {
        next.draft = { ...next.draft, jobId: null };
        next = mike(next, t("chat.setup.generalPicked"));
      } else {
        const job = allJobs(ctx, next).find((j) => j.id === value);
        next.draft = { ...next.draft, jobId: value };
        if (job) next = mike(next, pickedLine(job));
      }
      return advance(ctx, { ...next, stage: "job" });
    }
    case "round":
      next.draft = { ...next.draft, round: value as RoundType };
      return advance(ctx, { ...next, stage: "round" });
    case "anything":
      if (value === "gentle") { next.draft = { ...next.draft, strictness: 1 }; next = mike(next, t("chat.setup.gentle")); }
      if (value === "tough") { next.draft = { ...next.draft, strictness: 3 }; next = mike(next, t("chat.setup.tough")); }
      return advance(ctx, { ...next, stage: "anything" });
    case "level":
      next.draft = { ...next.draft, level: value as Level };
      return advance(ctx, { ...next, stage: "level" });
    case "topic":
      next.draft = { ...next.draft, topic: t(`english.topics.${value as EnglishTopic}`) };
      return advance(ctx, { ...next, stage: "topic" });
    case "phrases":
      next.draft = { ...next.draft, usePhrases: value === "yes" };
      return advance(ctx, { ...next, stage: "phrases" });
    case "focus":
      next.draft = { ...next.draft, focus: value as "all" | WeakSpotLayer };
      return showPlan(ctx, next);
    case "scenario": {
      const sc = isScenario(value) ? value : DEFAULT_SCENARIO;
      next.draft = { ...next.draft, scenario: sc };
      return askRole(ctx, { ...next, stage: "scenario" });
    }
    case "role": // "No job, I'll type it": Mike repeats what to type, the composer says it too.
      next.draft = { ...next.draft, jobId: null };
      return mike({ ...next, stage: "role" }, t("home.talk.negotiate.rolePlaceholder"));
    case "style":
      next.draft = { ...next.draft, style: value as NegotiateStyle };
      return askPrep(ctx, next);
    case "theme": {
      next.draft = { ...next.draft, theme: value as ToughTheme };
      if (value === "personal") next = mike(next, t("home.talk.tough.personal"));
      return showPlan(ctx, next, t("home.talk.planLine"));
    }
    default:
      return next;
  }
}

/** A typed reply in the setup composer. */
export function say(ctx: ScriptContext, s: SetupState, raw: string): SetupState {
  const text = raw.trim();
  if (!text || s.pending) return s;
  if (s.stage === "job" && looksLikeJob(text)) {
    const url = looksLikeUrl(text);
    const next = push(answerLast(s), {
      speaker: "user",
      text: url ? text : undefined,
      attachment: url ? undefined : { kind: "job", label: text, meta: t("chat.setup.jobMeta", { n: text.length.toLocaleString("en-US") }) },
    });
    return readJob(next, url ? "link" : "job", url ? { url: text } : { text });
  }
  let next = user(s, text);
  switch (s.stage) {
    case "scenario": {
      const sc = matchScenario(text, ctx);
      if (!sc) return mike(next, t("home.talk.scenario.noMatch"), { replies: scenarioReplies(ctx), list: scenarioList(ctx) });
      next.draft = { ...next.draft, scenario: sc };
      return askRole(ctx, next);
    }
    case "role": {
      const job = matchJob(text, allJobs(ctx, s));
      if (job && !hasField(next.draft, "range")) return askNumbers(ctx, { ...next, draft: { ...next.draft, jobId: job.id, role: job.role.trim() || undefined } });
      if (job) return chooseJobForRange(next, job);
      next.draft = { ...next.draft, jobId: null, role: text.slice(0, ROLE_MAX) };
      return askNumbers(ctx, next);
    }
    case "numbers":
      next.draft = { ...next.draft, note: text };
      return mike(next, t("home.talk.noted"));
    case "style": {
      const style = matchStyle(text);
      if (!style) return mike(next, t("home.talk.negotiate.styleNoMatch"), { replies: styleReplies(ctx.talk?.lastStyle ?? null) });
      next.draft = { ...next.draft, style };
      return askPrep(ctx, next);
    }
    case "prep": {
      const v = text.toLowerCase();
      const a = /\blast\b|\bsame\b|\bmy case\b/.test(v) ? "last" : /\bno\b|\bnot\b|skip|start now|\bnope\b/.test(v) ? "no" : /\byes\b|\bprepare\b|\bsure\b|\bok/.test(v) ? "yes" : undefined;
      if (!a || (a === "last" && !lastCaseOf(ctx, s.draft))) return mike(next, t("home.talk.prep.noMatch"), { replies: prepReplies(ctx, s.draft) });
      return answerPrep(ctx, next, a);
    }
    case "course":
      return nextCourseStep(ctx, next);
    case "case1": {
      next.draft = { ...next.draft, case: { ...caseOf(next.draft), results: splitResults(text) } };
      return askCase2(ctx, next);
    }
    case "case2":
      next.draft = { ...next.draft, case: { ...caseOf(next.draft), reason: text.slice(0, CASE_MAX) } };
      return askCase3(ctx, next);
    case "case3": {
      const have = new Set(caseOf(next.draft).fallbacks);
      matchLevers(text, scenarioOf(next.draft)).forEach((id) => have.add(id));
      next.draft = { ...next.draft, case: { ...caseOf(next.draft), fallbacks: [...have] } };
      return finishCase(ctx, next);
    }
    case "theme": {
      const theme = matchTheme(text);
      if (!theme) return mike(next, t("home.talk.tough.noMatch"), { replies: themeReplies() });
      next.draft = { ...next.draft, theme };
      if (theme === "personal") next = mike(next, t("home.talk.tough.personal"));
      return showPlan(ctx, next, t("home.talk.planLine"));
    }
    case "job": {
      const job = matchJob(text, allJobs(ctx, s));
      if (job) { next.draft = { ...next.draft, jobId: job.id }; next = mike(next, pickedLine(job)); return advance(ctx, next); }
      if (matchGeneral(text)) { next.draft = { ...next.draft, jobId: null }; next = mike(next, t("chat.setup.generalPicked")); return advance(ctx, next); }
      return mike(next, t("chat.setup.jobNotCaught"), { replies: jobReplies(ctx, s) });
    }
    case "round": {
      const round = matchRound(text);
      if (!round) return mike(next, t("chat.setup.roundNotCaught"), { replies: roundReplies() });
      next.draft = { ...next.draft, round };
      return advance(ctx, next);
    }
    case "anything": {
      const strict = matchStrictness(text);
      next.draft = { ...next.draft, note: text, strictness: strict ?? next.draft.strictness };
      next = mike(next, t("chat.setup.noted"));
      return advance(ctx, next);
    }
    case "level": {
      const level = matchLevel(text);
      if (!level) return mike(next, t("chat.setup.levelNotCaught"), { replies: LEVELS.map((l) => ({ id: `level:${l}`, label: levelLine(l) })) });
      next.draft = { ...next.draft, level };
      return advance(ctx, next);
    }
    case "topic": {
      const topic = matchTopic(text);
      next.draft = { ...next.draft, topic: topic ? t(`english.topics.${topic}`) : text };
      return advance(ctx, next);
    }
    case "phrases":
      next.draft = { ...next.draft, usePhrases: !/\bno\b|not/.test(text.toLowerCase()) };
      return advance(ctx, next);
    case "plan": {
      if (isTalk(s.track)) {
        next.draft = { ...next.draft, note: text };
        return mike(next, t("chat.setup.noted"));
      }
      const round = matchRound(text);
      const strict = matchStrictness(text);
      const job = matchJob(text, allJobs(ctx, s));
      const what: string[] = [];
      if (round) { next.draft = { ...next.draft, round }; what.push(roundLabel(round)); }
      if (strict) { next.draft = { ...next.draft, strictness: strict }; what.push(strictnessLabel(strict)); }
      if (job) { next.draft = { ...next.draft, jobId: job.id }; what.push(job.company); }
      return mike(next, what.length ? t("chat.setup.changed", { what: what.join(", ") }) : t("chat.setup.cantChange"));
    }
    default:
      return next;
  }
}

/** A file sent in the chat (D89): at the job question it is the job; anywhere else it is the user's CV, saved to the
 * profile. The open question's quick replies wait under Mike's answer, so the chat carries on where it was. */
export function attach(_ctx: ScriptContext, s: SetupState, file: { name: string; size: string }): SetupState {
  if (s.pending) return s;
  const open = [...s.turns].reverse().find((x) => x.speaker === "mike" && x.replies?.length && !x.answered);
  const sent = push(answerLast(s), { speaker: "user", attachment: { kind: "file", label: file.name, meta: file.size } });
  if (s.stage === "job") return readJob(sent, "file", { file: file.name });
  const next = push(sent, { speaker: "mike", state: "pending", pendingLabel: t("chat.setup.readingCv") });
  return { ...next, pending: { turnId: next.turns[next.turns.length - 1]!.id, kind: "cv", file: file.name, replies: open?.replies } };
}

/** The CV was read, couldn't be read, or the profile has no room for another file: Mike says which, and the question
 * that was open is open again under his answer. */
export type CvResult = "ok" | "unreadable" | "full";
export function resolveCv(_ctx: ScriptContext, s: SetupState, result: CvResult): SetupState {
  const p = s.pending;
  if (!p || p.kind !== "cv") return s;
  const next = { ...s, turns: s.turns.filter((x) => x.id !== p.turnId), pending: undefined };
  const ok = result === "ok";
  let text = t(ok ? "chat.setup.cvGot" : result === "full" ? "chat.setup.cvFull" : "chat.setup.cvError");
  if (ok && s.stage === "anything") text = `${text} ${t("chat.setup.askAnything")}`;
  return mike(next, text, { state: ok ? "final" : "error", replies: p.replies });
}

/* ---------- tough talk (tough-talk.md §2.3 - §2.6) ---------- */

const currenciesOf = (ctx: ScriptContext) => ctx.talk?.content?.currencies ?? CURRENCIES;
export const styleName = (id: NegotiateStyle) => t(`home.talk.styleName.${id}` as "home.talk.styleName.firm");
export const themeName = (id: ToughTheme) => t(`home.talk.themes.${id}` as "home.talk.themes.money");
const styleLabel = (id: NegotiateStyle): string =>
  id === "friendly" ? t("home.talk.style.friendly.easy")
  : id === "firm" ? t("home.talk.style.firm.medium")
  : id === "tight" ? t("home.talk.style.tight.hard")
  : t("home.talk.negotiate.surprise");
const difficultyLabel = (id: NegotiateStyle) =>
  id === "friendly" ? t("home.talk.difficulty.easy") : id === "firm" ? t("home.talk.difficulty.medium") : id === "tight" ? t("home.talk.difficulty.hard") : "";

export function matchStyle(text: string): NegotiateStyle | undefined {
  const v = text.toLowerCase();
  if (/surprise|random|any/.test(v)) return "surprise";
  if (/tight|hard|budget/.test(v)) return "tight";
  if (/firm|medium/.test(v)) return "firm";
  if (/friend|warm|easy|soft/.test(v)) return "friendly";
  return undefined;
}
export function matchTheme(text: string): ToughTheme | undefined {
  const v = text.toLowerCase();
  if (/personal/.test(v)) return "personal";
  if (/\bmix|all of|everything/.test(v)) return "mix";
  if (/money|salary|pay|budget/.test(v)) return "money";
  if (/leav|gap|fired|quit/.test(v)) return "leaving";
  if (/weak|failure|mistake/.test(v)) return "weakness";
  if (/\bfit\b|culture|why us/.test(v)) return "fit";
  if (/english|language/.test(v)) return "english";
  return undefined;
}

const roleReplies = (ctx: ScriptContext, s: SetupState): SetupReply[] => [
  ...allJobs(ctx, s).slice(0, 3).map((j) => ({ id: `job:${j.id}`, label: j.company, icon: "briefcase" as const })),
  { id: "role:type", label: t("home.talk.negotiate.noJob"), icon: "edit" as const },
];
const styleReplies = (last: NegotiateStyle | null): SetupReply[] => {
  if (!last || last === "surprise") return STYLES.map((id) => ({ id: `style:${id}`, label: styleLabel(id) }));
  const i = STYLE_ORDER.indexOf(last);
  const replies: SetupReply[] = [{ id: `style:${last}`, label: t("home.talk.negotiate.styleYes", { style: styleName(last) }) }];
  const easier = STYLE_ORDER[i - 1];
  const harder = STYLE_ORDER[i + 1];
  if (easier) replies.push({ id: `style:${easier}`, label: t("home.talk.negotiate.styleEasier", { style: styleName(easier) }) });
  if (harder) replies.push({ id: `style:${harder}`, label: t("home.talk.negotiate.styleHarder", { style: styleName(harder) }) });
  replies.push({ id: "style:surprise", label: t("home.talk.negotiate.surprise") });
  return replies;
};
const themeReplies = (): SetupReply[] => THEMES.map((id) => ({ id: `theme:${id}`, label: themeName(id) }));

function askRole(ctx: ScriptContext, s: SetupState): SetupState {
  return mike({ ...s, stage: "role" }, hasField(s.draft, "range") ? t("home.talk.negotiate.role") : t("home.talk.negotiate.roleNow"), { replies: roleReplies(ctx, s) });
}
/* ---------- Negotiation v2: the scenario question ---------- */

export const scenarioOf = (d: Draft): NegotiateScenario => d.scenario ?? DEFAULT_SCENARIO;
const hasField = (d: Draft, f: (typeof SCENARIO_FIELDS)[NegotiateScenario][number]) => SCENARIO_FIELDS[scenarioOf(d)].includes(f);
/** The name and the one-line blurb of a scenario: the server's content, else the bundled text. */
export function scenarioInfo(ctx: ScriptContext, id: NegotiateScenario): { id: NegotiateScenario; name: string; blurb: string } {
  const c = ctx.talk?.content?.scenarios?.find((x) => x.id === id);
  return { id, name: c?.name ?? t(`home.talk.scenario.${id}.name`), blurb: c?.blurb ?? t(`home.talk.scenario.${id}.blurb`) };
}
const scenarioReplies = (ctx: ScriptContext): SetupReply[] => SCENARIO_ORDER.map((id) => ({ id: `scenario:${id}`, label: scenarioInfo(ctx, id).name }));
const scenarioList = (ctx: ScriptContext) => SCENARIO_ORDER.map((id) => { const i = scenarioInfo(ctx, id); return { term: i.name, text: i.blurb }; });
function matchScenario(text: string, ctx: ScriptContext): NegotiateScenario | undefined {
  const v = text.toLowerCase();
  const byName = SCENARIO_ORDER.find((id) => v.includes(scenarioInfo(ctx, id).name.toLowerCase()));
  if (byName) return byName;
  if (/screen|recruiter|expectation/.test(v)) return "screening";
  if (/intern|graduat|full.?time/.test(v)) return "internship";
  if (/counter|notice|resign|quit/.test(v)) return "counteroffer";
  if (/raise|promotion|lead|review/.test(v)) return "raise";
  if (/offer/.test(v)) return "offer";
  return undefined;
}
function askScenario(ctx: ScriptContext, s: SetupState): SetupState {
  return mike({ ...s, stage: "scenario" }, t("home.talk.scenario.ask"), { replies: scenarioReplies(ctx), list: scenarioList(ctx) });
}

function askTheme(_ctx: ScriptContext, s: SetupState): SetupState {
  return mike({ ...s, stage: "theme" }, t("home.talk.tough.theme"), { replies: themeReplies() });
}
function askStyle(ctx: ScriptContext, s: SetupState): SetupState {
  const last = ctx.talk?.lastStyle ?? null;
  const again = !!last && last !== "surprise";
  const text = again ? t("home.talk.negotiate.styleAgain", { style: styleName(last!) }) : t("home.talk.negotiate.styleFirst");
  return mike({ ...s, stage: "style" }, text, { replies: styleReplies(last) });
}

/* ---------- Negotiation v3 (D118): prepare first, mini-course, "your case" (prd-v3-prep §3 to §5) ---------- */

const CASE_MAX = 200;
const RESULTS_MAX = 3;
const COURSE_LEN = 5;
const REASONS = ["market", "scope", "offer"] as const;
const LEVERS: Record<"offer" | "raise", string[]> = {
  offer: ["step_up", "sign_on", "review", "remote", "title"],
  raise: ["part_now", "dated_raise", "title"],
};

/** The mini-course and the lever list come in two families: raise, and everything else. */
export const courseFamily = (sc: NegotiateScenario): "offer" | "raise" => (sc === "raise" ? "raise" : "offer");
export const leverLabel = (id: string) => tMaybe(`home.talk.prep.lever.${id}`, id);
const reasonLabel = (id: string) => (REASONS as readonly string[]).includes(id) ? t(`home.talk.prep.reason.${id}` as "home.talk.prep.reason.market") : id;
const caseOf = (d: Draft): NegotiateCase => d.case ?? { results: [], reason: "", fallbacks: [] };
const emptyCase = (c: NegotiateCase | undefined) => !c || (!c.results.length && !c.reason && !c.fallbacks.length);
const courseSteps = (ctx: ScriptContext, d: Draft): CourseStep[] => ctx.talk?.content?.course?.[courseFamily(scenarioOf(d))] ?? [];
const lastCaseOf = (ctx: ScriptContext, d: Draft): NegotiatePrep | null => {
  const c = ctx.talk?.lastCases?.[scenarioOf(d)] ?? null;
  return c && !emptyCase(c) ? c : null;
};

/** Q1 answer: up to three results, by line or, in one paragraph, by sentence; each at most 200 characters. */
export function splitResults(text: string): string[] {
  const lines = text.split(/\r?\n+/).map((x) => x.replace(/^[\s\-*•\d.)]+/, "").trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : (lines[0] ?? "").split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.slice(0, RESULTS_MAX).map((x) => x.slice(0, CASE_MAX));
}
/** A typed Q3 answer: the levers it names ("sign-on bonus and remote days"). */
function matchLevers(text: string, sc: NegotiateScenario): string[] {
  const v = text.toLowerCase();
  const rules: Record<string, RegExp> = {
    step_up: /step.?up|probation/, sign_on: /sign.?on|bonus/, review: /review/, remote: /remote|home/, title: /title|level/,
    part_now: /part|now/, dated_raise: /dated|date|later|month/,
  };
  return LEVERS[courseFamily(sc)].filter((id) => rules[id]?.test(v));
}

function prepReplies(ctx: ScriptContext, d: Draft): SetupReply[] {
  const replies: SetupReply[] = [{ id: "prep:yes", label: t("home.talk.prep.yes") }, { id: "prep:no", label: t("home.talk.prep.no") }];
  if (lastCaseOf(ctx, d)) replies.push({ id: "prep:last", label: t("home.talk.prep.useLast") });
  return replies;
}
function askPrep(ctx: ScriptContext, s: SetupState): SetupState {
  return mike({ ...s, stage: "prep" }, t("home.talk.prep.ask"), { replies: prepReplies(ctx, s.draft) });
}

const caseCard = (c: NegotiateCase) => ({ results: c.results, reason: c.reason, fallbacks: c.fallbacks.map(leverLabel) });
function answerPrep(ctx: ScriptContext, s: SetupState, answer: "yes" | "no" | "last"): SetupState {
  const d = s.draft;
  if (answer === "no") return showPlan(ctx, { ...s, draft: { ...d, prep: "no", course: false, case: undefined } }, t("home.talk.planLine"));
  if (answer === "last") {
    const c = lastCaseOf(ctx, d);
    if (!c) return showPlan(ctx, { ...s, draft: { ...d, prep: "no" } }, t("home.talk.planLine"));
    // The strip follows the course: shown now, or taken in the case reused.
    const next = { ...s, draft: { ...d, prep: "last" as const, course: Boolean(c.course), case: { results: c.results, reason: c.reason, fallbacks: c.fallbacks } } };
    return showPlan(ctx, mike(next, t("home.talk.prep.lastShown"), { caseCard: caseCard(c) }), t("home.talk.planLine"));
  }
  const steps = s.steps.includes("course") ? s.steps : [...s.steps, "course", "case1", "case2", "case3"] as Stage[];
  const next: SetupState = { ...s, steps, draft: { ...d, prep: "yes", courseIdx: 0 } };
  return courseSteps(ctx, d).length ? showCourseStep(ctx, next, 0) : askCase1(ctx, next);
}

function showCourseStep(ctx: ScriptContext, s: SetupState, i: number): SetupState {
  const step = courseSteps(ctx, s.draft)[i]!;
  return mike(
    { ...s, stage: "course", draft: { ...s.draft, course: true, courseIdx: i } },
    `**${i + 1}. ${step.title}** ${step.rule}`,
    {
      list: [{ term: t("home.talk.prep.example"), text: quoted(step.example) }],
      replies: [{ id: "course:next", label: t("home.talk.prep.next") }, { id: "course:skip", label: t("home.talk.prep.toCase") }],
    },
  );
}
function nextCourseStep(ctx: ScriptContext, s: SetupState): SetupState {
  const i = (s.draft.courseIdx ?? 0) + 1;
  return i < Math.min(COURSE_LEN, courseSteps(ctx, s.draft).length) ? showCourseStep(ctx, s, i) : askCase1(ctx, s);
}

const skipReply = (stage: string): SetupReply => ({ id: `${stage}:skip`, label: t("home.talk.prep.skip") });
function askCase1(_ctx: ScriptContext, s: SetupState): SetupState {
  const raise = courseFamily(scenarioOf(s.draft)) === "raise";
  const steps = s.steps.includes("case1") ? s.steps : [...s.steps, "case1", "case2", "case3"] as Stage[];
  return mike({ ...s, steps, stage: "case1", draft: { ...s.draft, case: caseOf(s.draft) } }, t(raise ? "home.talk.prep.q1Raise" : "home.talk.prep.q1"), { replies: [skipReply("case1")] });
}
function askCase2(_ctx: ScriptContext, s: SetupState): SetupState {
  const replies: SetupReply[] = [...REASONS.map((id) => ({ id: `case2:${id}`, label: reasonLabel(id) })), skipReply("case2")];
  return mike({ ...s, stage: "case2" }, t("home.talk.prep.q2"), { replies });
}
function levelReplies(d: Draft): SetupReply[] {
  const chosen = new Set(caseOf(d).fallbacks);
  return [
    ...LEVERS[courseFamily(scenarioOf(d))].map((id) => ({ id: `case3:${id}`, label: leverLabel(id), selected: chosen.has(id) })),
    { id: "case3:done", label: t("home.talk.prep.done") },
    skipReply("case3"),
  ];
}
function askCase3(_ctx: ScriptContext, s: SetupState): SetupState {
  return mike({ ...s, stage: "case3" }, t("home.talk.prep.q3"), { replies: levelReplies(s.draft) });
}
/** A lever chip is a toggle: the question stays open and the chip shows it is chosen. */
function toggleFallback(s: SetupState, turnId: string, id: string): SetupState {
  const c = caseOf(s.draft);
  const fallbacks = c.fallbacks.includes(id) ? c.fallbacks.filter((x) => x !== id) : [...c.fallbacks, id];
  const draft = { ...s.draft, case: { ...c, fallbacks } };
  return { ...s, draft, turns: s.turns.map((x) => (x.id === turnId ? { ...x, replies: levelReplies(draft) } : x)) };
}
function finishCase3(ctx: ScriptContext, s: SetupState, skipped: boolean): SetupState {
  const c = caseOf(s.draft);
  const draft = skipped ? { ...s.draft, case: { ...c, fallbacks: [] } } : s.draft;
  const labels = skipped ? [t("home.talk.prep.skip")] : draft.case!.fallbacks.length ? [draft.case!.fallbacks.map(leverLabel).join(", ")] : [t("home.talk.prep.done")];
  return finishCase(ctx, push(answerLast({ ...s, draft }), { speaker: "user", text: labels[0] }));
}
/** Mike ends the questions with the "Your case" card (an empty case is fine: straight to the plan). */
function finishCase(ctx: ScriptContext, s: SetupState): SetupState {
  const c = caseOf(s.draft);
  if (emptyCase(c)) return showPlan(ctx, s, t("home.talk.planLine"));
  return showPlan(ctx, mike(s, t("home.talk.prep.summary"), { caseCard: caseCard(c) }), t("home.talk.planLine"));
}

/** Remembered values (US-63 AC6): this job's last numbers, else the last ones used (without a range: it belongs to a post). */
function memoryFor(ctx: ScriptContext, jobId: string | null | undefined): NumbersMemory | null {
  const m = ctx.talk?.numbers;
  if (!m) return null;
  if (jobId && m.byJob[jobId]) return m.byJob[jobId]!;
  return m.last ? { ...m.last, low: undefined, high: undefined } : null;
}

function askNumbers(ctx: ScriptContext, s: SetupState): SetupState {
  const d = s.draft;
  const sc = scenarioOf(d);
  const values = { ...valuesFromMemory(memoryFor(ctx, d.jobId), currenciesOf(ctx), d.range), role: d.role ?? "" };
  return mike({ ...s, stage: "numbers" }, t(`home.talk.negotiate.numbersFor.${sc}` as "home.talk.negotiate.numbersFor.offer"), {
    numbers: { values, fromPost: !!d.range, roleField: !d.role, currencies: currenciesOf(ctx), scenario: sc },
  });
}

/** A saved job was chosen for the negotiation: Mike reads its post for the range (the container answers `resolveRange`). */
function chooseJobForRange(s: SetupState, job: JobItem): SetupState {
  const next = push(
    { ...s, stage: "pending", draft: { ...s.draft, jobId: job.id, role: job.role.trim() || undefined } },
    { speaker: "mike", state: "pending", pendingLabel: t("chat.setup.readingJob") },
  );
  return { ...next, pending: { turnId: next.turns[next.turns.length - 1]!.id, kind: "range", jobId: job.id } };
}

export type RangeResult = { ok: true; low: number | null; high: number | null; currency: string | null } | { ok: false };

/** The salary range of the post arrived (or the post has none): Mike says which, then asks for the numbers. */
export function resolveRange(ctx: ScriptContext, s: SetupState, result: RangeResult): SetupState {
  const p = s.pending;
  if (!p || p.kind !== "range") return s;
  let next: SetupState = { ...s, turns: s.turns.filter((x) => x.id !== p.turnId), pending: undefined };
  const job = allJobs(ctx, next).find((j) => j.id === p.jobId);
  const has = result.ok && result.low != null && result.high != null;
  if (has) next.draft = { ...next.draft, range: { low: result.low!, high: result.high!, currency: result.currency } };
  const head = { company: job?.company ?? "", role: job?.role.trim() || (next.draft.role ?? "") };
  next = mike(
    next,
    has
      ? t("home.talk.negotiate.jobRange", { ...head, low: formatAmount(result.low!), high: formatAmount(result.high!), currency: result.currency ?? "" })
      : t("home.talk.negotiate.jobNoRange", head),
  );
  return askNumbers(ctx, next);
}

const offerText = (hasOffer: boolean) => t(hasOffer ? "home.talk.negotiate.hasOffer" : "home.talk.negotiate.noOffer");

/** What the user "said" when the numbers card was sent: one line per scenario. */
function numbersAnswer(sc: NegotiateScenario, p: NonNullable<ReturnType<typeof validateNumbers>["parsed"]>): string {
  const cur = p.currency;
  const fa = formatAmount;
  if (sc === "raise") {
    return t("home.talk.negotiate.answerRaise", { current: fa(p.currentPay ?? 0), ask: fa(p.ask ?? 0), currency: cur });
  }
  if (sc === "counteroffer") {
    return t("home.talk.negotiate.answerCounter", { current: fa(p.currentPay ?? 0), offer: fa(p.newOffer ?? 0), currency: cur, reason: t(`home.talk.leaveReason.${p.reason ?? "other"}`).toLowerCase() });
  }
  const offer = sc === "offer" ? offerText(p.hasOffer) : "";
  const text = p.low !== undefined && p.high !== undefined
    ? t("home.talk.negotiate.answer", { low: fa(p.low), high: fa(p.high), currency: cur, target: fa(p.target), offer })
    : t("home.talk.negotiate.answerNoRange", { target: fa(p.target), currency: cur, offer });
  // "… · " with no offer part reads as noise: drop the dangling separator.
  return text.replace(/ · $/, "");
}

/** The numbers card was sent (turn id: from Mike's message) or saved (null: the plan's "Change your numbers" dialog). */
export function submitNumbers(ctx: ScriptContext, s: SetupState, turnId: string | null, values: NumbersValues): SetupState {
  if (s.track === "interview" && turnId === null) {
    // The interview's "End with a salary talk": the screening fields from the plan's dialog.
    const job = s.draft.jobId ? allJobs(ctx, s).find((j) => j.id === s.draft.jobId) : undefined;
    const check = validateNumbers(values, { roleRequired: !job, scenario: "screening" });
    if (!check.ok) return s;
    return { ...s, draft: { ...s.draft, money: true, moneyNumbers: values } };
  }
  const roleRequired = turnId === null ? true : !s.draft.role || (s.turns.find((x) => x.id === turnId)?.numbers?.roleField ?? false);
  const sc = scenarioOf(s.draft);
  const check = validateNumbers(values, { roleRequired, scenario: sc });
  if (!check.ok || !check.parsed) return s;
  const parsed = check.parsed;
  const role = roleRequired ? parsed.role.slice(0, ROLE_MAX) : s.draft.role ?? "";
  const start = toNegotiateStart({ ...parsed, role }, s.draft.style ?? "friendly", sc);
  const stored = numbersFromStart(start, currenciesOf(ctx));
  const r = s.draft.range;
  const stillPost = !!r && parsed.low === r.low && parsed.high === r.high;
  const draft: Draft = { ...s.draft, role, numbers: stored, range: stillPost ? r : undefined };
  if (turnId === null) return { ...s, draft };
  let next: SetupState = { ...s, draft, turns: s.turns.map((x) => (x.id === turnId ? { ...x, numbers: undefined } : x)) };
  next = push(next, { speaker: "user", text: numbersAnswer(sc, parsed) });
  return askStyle(ctx, next);
}

/** "Hide tactics" / "Show them" on a plan card of a tough-talk mode. */
export const setTacticsHidden = (s: SetupState, hidden: boolean): SetupState => ({ ...s, draft: { ...s.draft, tacticsHidden: hidden } });

/** Cards in the order of the call (tough-talk.md §3). */
export function tacticOrder(mode: "tough" | "negotiate", opts: { theme?: ToughTheme; hasOffer?: boolean; scenario?: NegotiateScenario }): string[] {
  if (mode === "negotiate") {
    switch (opts.scenario) {
      case "screening": return ["S1", "S2", "N2", "N3", "N1", "N4", "N5"];
      case "internship": return ["I1", "N5", "N9", "N10", "N4", "N6", "N8"];
      case "counteroffer": return ["C1", "C2", "N8", "N4", "N5", "N3", "N10"];
      case "raise": return ["R1", "R2", "N5", "N9", "N10", "N4", "N6", ...(opts.hasOffer ? ["N7"] : [])];
      default: return ["N2", "N1", "N3", "O1", "O2", "N4", "N5", "N6", "N9", "N10", ...(opts.hasOffer ? ["N7"] : []), "N8"];
    }
  }
  return opts.theme === "money" || opts.theme === "mix" ? ["N3", "T1", "T2"] : ["T1", "T2", "N3"];
}
function tacticsFor(ctx: ScriptContext, mode: "tough" | "negotiate", opts: { theme?: ToughTheme; hasOffer?: boolean; scenario?: NegotiateScenario }): TacticCardData[] {
  const cards = ctx.talk?.content?.cards ?? [];
  return tacticOrder(mode, opts).flatMap((id) => cards.find((c) => c.id === id && c.modes.includes(mode)) ?? []);
}
export const toughQuestions = (ctx: ScriptContext, theme: ToughTheme | undefined): number => {
  const total = ctx.talk?.content?.tough_total ?? TOUGH_TOTAL;
  const count = ctx.talk?.content?.themes.find((x) => x.id === theme)?.count;
  return count ? Math.min(total, count) : total;
};

/** "Skip questions": Mike fills the rest from the last session or the defaults and shows the plan. */
export function skip(ctx: ScriptContext, s: SetupState): SetupState {
  if (s.pending) return s;
  const d = { ...s.draft };
  if (s.track === "tough") {
    d.theme ??= "mix";
  } else if (s.track === "negotiate") {
    d.style ??= ctx.talk?.lastStyle ?? "friendly";
    d.scenario ??= DEFAULT_SCENARIO;
    // "Skip questions" skips the rest of the prep too: what was answered stays, the rest is left out.
    if (d.prep === undefined && s.stage === "prep") d.prep = "no";
    if (!d.numbers) {
      // Remembered numbers fill in when they are complete; otherwise the numbers card is the one thing left to ask.
      const m = memoryFor(ctx, d.jobId);
      const values = { ...valuesFromMemory(m, currenciesOf(ctx), d.range), role: d.role ?? m?.role ?? "" };
      const check = validateNumbers(values, { roleRequired: true, scenario: scenarioOf(d) });
      if (!check.ok || !check.parsed) {
        if (s.stage === "numbers") return s;
        const base: SetupState = { ...answerLast(s), draft: { ...d, role: d.role ?? undefined }, skipped: true };
        return askNumbers(ctx, base);
      }
      d.role = check.parsed.role;
      d.numbers = numbersFromStart(toNegotiateStart(check.parsed, d.style, scenarioOf(d)), currenciesOf(ctx));
    }
  } else if (s.track === "english") {
    d.level ??= ctx.level ?? "B1";
    d.topic ??= t("english.topics.free");
    d.usePhrases ??= false;
  } else {
    if (d.jobId === undefined) d.jobId = ctx.last?.jobId ?? null;
    d.round ??= ctx.last?.round ?? "behavioural";
  }
  return showPlan(ctx, { ...answerLast(s), draft: d, skipped: true });
}

/** A Change menu in the plan card. */
export function change(ctx: ScriptContext, s: SetupState, row: PlanRow, value: string): SetupState {
  const d = { ...s.draft };
  if (row === "job") d.jobId = value === "general" ? null : value;
  if (row === "round") d.round = value as RoundType;
  if (row === "strictness") d.strictness = Number(value) as Strictness;
  if (row === "level") d.level = value as Level;
  if (row === "topic") d.topic = t(`english.topics.${value as EnglishTopic}`);
  if (row === "focus") d.focus = value as "all" | WeakSpotLayer;
  if (row === "style") d.style = value as NegotiateStyle;
  if (row === "theme") d.theme = value as ToughTheme;
  if (row === "offer" && d.numbers) d.numbers = { ...d.numbers, hasOffer: value === "on" };
  if (row === "scenario" && isScenario(value) && value !== scenarioOf(d)) {
    // The numbers belong to the scenario: keep them only when they are still complete for the new one.
    d.scenario = value;
    if (d.numbers && !validateNumbers(d.numbers, { roleRequired: false, scenario: value }).ok) d.numbers = undefined;
  }
  if (row === "money") d.money = value === "on";
  if (row === "case") {
    // "Your case" → Change: the three questions again. The plan card leaves the log until the new case is in.
    const steps = s.steps.includes("case1") ? s.steps : [...s.steps.filter((x) => x !== "plan"), "case1", "case2", "case3"] as Stage[];
    const turns = s.turns.map((x) => (x.plan ? { ...x, plan: false } : x));
    return askCase1(ctx, { ...s, steps, turns, draft: { ...d, prep: "yes", case: { results: [], reason: "", fallbacks: [] } } });
  }
  if (row === "role" && s.track === "negotiate") {
    // A saved job: its title and the numbers stay; "Type a role": the numbers dialog shows the Role field.
    if (value === "type") { d.jobId = null; d.range = undefined; }
    else {
      const job = allJobs(ctx, s).find((j) => j.id === value);
      if (job) {
        d.jobId = job.id;
        d.role = job.role.trim() || d.role;
        d.range = undefined;
        if (d.numbers && job.role.trim()) d.numbers = { ...d.numbers, role: job.role.trim() };
      }
    }
  }
  return { ...s, draft: d };
}
export const removeNote = (s: SetupState): SetupState => ({ ...s, draft: { ...s.draft, note: undefined } });
/** A job changed state on the server (questions ready, failed): the plan follows. */
export const updateJob = (s: SetupState, job: JobItem): SetupState => ({ ...s, jobs: [job, ...s.jobs.filter((j) => j.id !== job.id)] });

/* ---------- the plan ---------- */

function talkPlan(ctx: ScriptContext, s: SetupState): PlanModel {
  const d = s.draft;
  const mode = d.kind === "tough" ? "tough" : "negotiate";
  const job = d.jobId ? allJobs(ctx, s).find((j) => j.id === d.jobId) ?? null : null;
  const known = currenciesOf(ctx);
  const base: PlanModel = {
    kind: mode,
    job: job ? { id: job.id, company: job.company, role: job.role } : null,
    jobStatus: "ready",
    round: "behavioural",
    strictness: d.strictness,
    questions: 0,
    minutes: 0,
    basis: "general",
    note: d.note,
    hasCv: ctx.hasCv,
    tacticsHidden: d.tacticsHidden ?? ctx.talk?.tacticsHidden[mode] ?? false,
    talk: {
      styles: STYLES.map((id) => ({ id, label: styleName(id), difficulty: difficultyLabel(id) })),
      themes: THEMES.map((id) => ({ id, label: themeName(id) })),
      currencies: known,
      fromPost: !!d.range,
      roleEditable: !job,
      scenarios: SCENARIO_ORDER.map((id) => scenarioInfo(ctx, id)),
      numbers: d.numbers ?? { ...valuesFromMemory(memoryFor(ctx, d.jobId), known, d.range), role: d.role ?? "" },
    },
  };
  if (mode === "tough") {
    const theme = d.theme ?? "mix";
    const questions = toughQuestions(ctx, theme);
    return {
      ...base, questions, minutes: questions * TOUGH_MIN_PER_QUESTION,
      tough: { theme, themeName: themeName(theme) },
      tactics: tacticsFor(ctx, "tough", { theme }),
    };
  }
  const sc = scenarioOf(d);
  const check = d.numbers ? validateNumbers(d.numbers, { roleRequired: false, scenario: sc }) : null;
  const start = check?.parsed ? toNegotiateStart({ ...check.parsed, role: d.role ?? "" }, d.style ?? "friendly", sc) : undefined;
  const c = d.prep === "yes" || d.prep === "last" ? caseOf(d) : undefined;
  if (start && c) start.prep = { course: Boolean(d.course), results: c.results, reason: c.reason, fallbacks: c.fallbacks };
  return {
    ...base, questions: NEGOTIATE_TURNS,
    case: c && !emptyCase(c) ? { ...c, fallbacks: c.fallbacks.map(leverLabel) } : undefined, minutes: NEGOTIATE_MINUTES,
    scenario: sc,
    negotiate: start ? { ...start, company: job?.company } : undefined,
    tactics: tacticsFor(ctx, "negotiate", { hasOffer: !!start?.has_real_offer, scenario: sc }),
  };
}

/** Interview plan: the "End with a salary talk" row (screening fields; the role is the job's). */
function moneyModel(ctx: ScriptContext, s: SetupState, job: JobItem | null): PlanModel["money"] {
  const d = s.draft;
  const known = currenciesOf(ctx);
  const role = job?.role.trim() || d.moneyNumbers?.role || "";
  const values: NumbersValues = { ...(d.moneyNumbers ?? valuesFromMemory(memoryFor(ctx, d.jobId), known, undefined)), role };
  const check = validateNumbers(values, { roleRequired: !job, scenario: "screening" });
  const start = d.money && check.parsed
    ? { role: check.parsed.role, target: check.parsed.target, currency: check.parsed.currency, ...(check.parsed.low !== undefined && check.parsed.high !== undefined ? { job_low: check.parsed.low, job_high: check.parsed.high } : {}) }
    : undefined;
  return { on: !!d.money && !!start, ready: check.ok, values, roleEditable: !job, currencies: known, start };
}

export function planFor(ctx: ScriptContext, s: SetupState): PlanModel {
  if (s.draft.kind === "tough" || s.draft.kind === "negotiate") return talkPlan(ctx, s);
  const d = s.draft;
  const job = d.jobId ? allJobs(ctx, s).find((j) => j.id === d.jobId) ?? null : null;
  const questions = d.kind === "drill" ? DRILL_QUESTIONS : ctx.questions;
  const basis: PlanModel["basis"] = job ? (ctx.hasCv ? "cv+job" : "job") : ctx.hasCv ? "cv" : "general";
  const first = ctx.weak[0];
  const weak = d.weak ?? ctx.weak;
  const focusItems = d.focus && d.focus !== "all" ? weak.filter((w) => w.layer === d.focus) : weak;
  return {
    kind: d.kind,
    job: job ? { id: job.id, company: job.company, role: job.role } : null,
    jobStatus: !job ? "ready" : job.state === "preparing" ? "preparing" : job.state === "error" ? "error" : "ready",
    questionsReady: job?.questions,
    round: d.round ?? "behavioural",
    strictness: d.strictness,
    questions,
    minutes: minutesFor(questions),
    basis,
    note: d.note,
    watch: d.kind === "interview" && first?.phrase && first.tip ? `${upperFirst(first.phrase)}. ${first.tip}` : undefined,
    hasCv: ctx.hasCv,
    focus: d.kind === "drill"
      ? {
        spots: focusItems.map((w) => w.short ?? w.title).join(", "),
        tags: focusItems.flatMap((w) => (w.tag ? [{ layer: w.layer, tag: w.tag }] : [])),
        id: d.focus ?? "all",
        label: d.focus && d.focus !== "all"
          ? `${layerLabel(d.focus)}: ${focusItems.map((w) => w.short ?? w.title).join(", ")}`
          : t("chat.plan.allFocus", { n: weak.length, list: weak.map((w) => w.short ?? w.title).join(", ") }),
      }
      : undefined,
    focusOptions: d.kind === "drill" ? focusOptions(weak) : undefined,
    level: d.level,
    topic: d.topic,
    phrases: d.usePhrases ? ctx.phrases.map((p) => p.to) : undefined,
    money: d.kind === "interview" && ctx.moneyTalk !== false ? moneyModel(ctx, s, job) : undefined,
  };
}

function focusOptions(weak: WeakItem[]): { id: "all" | WeakSpotLayer; label: string }[] {
  const counts = (["content", "language", "delivery"] as const)
    .map((layer) => ({ layer, n: weak.filter((w) => w.layer === layer).length }))
    .filter((x) => x.n > 0);
  return [{ id: "all", label: t("chat.setup.drillAll", { n: weak.length }) }, ...counts.map((c) => ({ id: c.layer, label: `${layerLabel(c.layer)} ${c.n}` }))];
}

/** What the view shows for this state. */
export function setupModel(ctx: ScriptContext, s: SetupState): SetupModel {
  const inPlan = s.stage === "plan";
  const idx = s.steps.indexOf(s.stage === "pending" ? (s.track === "negotiate" ? "role" : "job") : s.stage);
  return {
    track: s.track,
    placeholder: s.stage === "role" ? t("home.talk.negotiate.rolePlaceholder") : undefined,
    turns: s.turns,
    step: !inPlan && s.steps.length && idx >= 0 ? { n: idx + 1, of: s.steps.length } : undefined,
    canSkip: !inPlan && s.steps.length > 0 && !s.pending,
    stage: inPlan ? "plan" : s.stage === "job" || s.stage === "pending" ? "job" : "reply",
    plan: inPlan ? planFor(ctx, s) : undefined,
  };
}
