/* The Home setup chat, scripted (home.md v2 §4, owner default "the setup chat is scripted": no LLM). A pure,
 * deterministic state machine: every function takes the context + the current state and returns the next state.
 * The live HomeScreen and the review harness both run it, so every review state is reachable by replaying inputs.
 *
 * Interview: up to three questions (T1 job · T2 round · T3 anything else), each skipped when the first message already
 * answered it ("I have an HR screen with Lumen tomorrow" → straight to T3, "Step 1 of 1"), then the plan.
 * English: E1 level · E2 topic · phrases (only when there are some), then the plan.
 * Again / Drill / Example: their own short paths. Real work (reading a pasted job, opening a link, reading a file) is
 * a pending Mike message that the container resolves with `resolveJob` once the server answers. */
import { t, tp } from "../../i18n";
import type { WeakSpotLayer } from "../../ds";
import type {
  EnglishTopic, JobItem, Level, Phrase, PlanModel, PlanRow, RoundType, SetupModel, SetupReply, SetupTurn, Strictness,
  Suggestion, SuggestionId, Track, WeakItem,
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
}

type Stage = "job" | "round" | "anything" | "level" | "topic" | "phrases" | "drill" | "example" | "plan" | "pending";

interface Draft {
  kind: "interview" | "drill" | "english";
  /** undefined = not asked yet, null = general questions. */
  jobId?: string | null;
  round?: RoundType;
  strictness: Strictness;
  note?: string;
  level?: Level;
  topic?: string;
  usePhrases?: boolean;
  focus?: "all" | WeakSpotLayer;
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
  pending?: { turnId: string; kind: "job" | "link" | "file" | "cv"; text?: string; url?: string; file?: string; replies?: SetupReply[] };
  skipped?: boolean;
  seq: number;
}

export type StartInput =
  | { kind: "text"; text: string }
  | { kind: "file"; name: string; size: string }
  | { kind: "suggestion"; id: SuggestionId }
  /** "Drill these weak spots" in a debrief: straight to the plan, with that interview's job (F-13-8, F-13-14). */
  | { kind: "drill"; jobId?: string | null };

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

export function suggestionsFor(ctx: ScriptContext): Suggestion[] {
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
      { id: "english", icon: "chat", label: t("chat.suggest.english") },
    ];
  }
  const lastJob = ctx.jobs.find((j) => j.id === ctx.last?.jobId);
  return [
    { id: "again", icon: "briefcase", label: t("chat.suggest.again", { company: lastJob?.company ?? t("chat.suggest.general") }) },
    ctx.weak.length
      ? { id: "drill", icon: "content", label: t("chat.suggest.drill") }
      : { id: "another", icon: "folder", label: t("chat.suggest.another") },
    { id: "english", icon: "chat", label: t("chat.suggest.english") },
  ];
}

/* ---------- state helpers ---------- */

function empty(ctx: ScriptContext, track: Track): SetupState {
  return {
    track,
    stage: "job",
    steps: [],
    turns: [],
    draft: { kind: track === "english" ? "english" : "interview", strictness: ctx.strictness },
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
  if (input.kind === "suggestion") return suggestion(ctx, s, input.id);
  if (input.kind === "drill") {
    // Nothing to ask: the weak spots are known and the job comes with the link. The focus stays changeable in the plan.
    s.draft = { ...s.draft, kind: "drill", jobId: input.jobId ?? ctx.last?.jobId ?? null, round: "mix", focus: "all" };
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

function suggestion(ctx: ScriptContext, s: SetupState, id: SuggestionId): SetupState {
  const label = suggestionsFor(ctx).find((x) => x.id === id)?.label ?? id;
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
      const top = ctx.weak.slice(0, 2).map((w) => w.phrase ?? lowerFirst(w.title));
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
  let next = user(s, reply.label);
  switch (kind) {
    case "job": {
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

/** "Skip questions": Mike fills the rest from the last session or the defaults and shows the plan. */
export function skip(ctx: ScriptContext, s: SetupState): SetupState {
  if (s.pending) return s;
  const d = { ...s.draft };
  if (s.track === "english") {
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
  void ctx;
  return { ...s, draft: d };
}
export const removeNote = (s: SetupState): SetupState => ({ ...s, draft: { ...s.draft, note: undefined } });
/** A job changed state on the server (questions ready, failed): the plan follows. */
export const updateJob = (s: SetupState, job: JobItem): SetupState => ({ ...s, jobs: [job, ...s.jobs.filter((j) => j.id !== job.id)] });

/* ---------- the plan ---------- */

export function planFor(ctx: ScriptContext, s: SetupState): PlanModel {
  const d = s.draft;
  const job = d.jobId ? allJobs(ctx, s).find((j) => j.id === d.jobId) ?? null : null;
  const questions = d.kind === "drill" ? DRILL_QUESTIONS : ctx.questions;
  const basis: PlanModel["basis"] = job ? (ctx.hasCv ? "cv+job" : "job") : ctx.hasCv ? "cv" : "general";
  const first = ctx.weak[0];
  const focusItems = d.focus && d.focus !== "all" ? ctx.weak.filter((w) => w.layer === d.focus) : ctx.weak;
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
        id: d.focus ?? "all",
        label: d.focus && d.focus !== "all"
          ? `${layerLabel(d.focus)}: ${focusItems.map((w) => w.short ?? w.title).join(", ")}`
          : t("chat.plan.allFocus", { n: ctx.weak.length, list: ctx.weak.map((w) => w.short ?? w.title).join(", ") }),
      }
      : undefined,
    focusOptions: d.kind === "drill" ? focusOptions(ctx.weak) : undefined,
    level: d.level,
    topic: d.topic,
    phrases: d.usePhrases ? ctx.phrases.map((p) => p.to) : undefined,
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
  const idx = s.steps.indexOf(s.stage === "pending" ? "job" : s.stage);
  return {
    turns: s.turns,
    step: !inPlan && s.steps.length && idx >= 0 ? { n: idx + 1, of: s.steps.length } : undefined,
    canSkip: !inPlan && s.steps.length > 0 && !s.pending,
    stage: inPlan ? "plan" : s.stage === "job" || s.stage === "pending" ? "job" : "reply",
    plan: inPlan ? planFor(ctx, s) : undefined,
  };
}
