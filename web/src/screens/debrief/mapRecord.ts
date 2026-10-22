/* Live data → Debrief view model. Pure (no I/O), unit-tested in mapRecord.test.ts.
 * What the saved session does not carry (verdict step, per-question start time, corrections count) is left out of the
 * model; the view shows only what is there (see "live data gaps" in docs/frontend.md). */
import { percent, windowName } from "../../components/engine/PlanLimit";
import { diffMarks, paceVerdict } from "../../components/Feedback";
import { t, tMaybe, tp } from "../../i18n";
import { formatClock, formatDateTime, formatDuration } from "../../lib/format";
import type { FeedbackRecord, LanguageItem, LayerName, LowConfWord, SessionRecord } from "../../lib/types";
import { languageCounts, type StrongerState, type Thread } from "../../session/reducer";
import type {
  ContentBlock, ConversationTurn, Correction, DebriefModel, DeliveryBlock, EnglishModel, LanguageBlock, MetaItem, QuestionModel, Segments,
  StrongerModel, WeakSpotModel,
} from "./types";

/** A verdict needs at least this many answered questions (US-17 AC1). */
export const MIN_ANSWERS = 3;

/** Group saved feedback the same way the live panel does: one thread per main question (English: per turn). */
export function threadsFromRecord(record: SessionRecord): Thread[] {
  const map = new Map<string, Thread>();
  const order: string[] = [];
  const qIndex = (id: string) => record.questions.findIndex((q) => q.id === id);
  for (const fb of record.feedback) {
    const key = record.mode === "english" ? `t:${fb.id}` : fb.question_id || "general";
    let th = map.get(key);
    if (!th) {
      const q = record.questions.find((x) => x.id === key);
      th = { key, number: 0, question: q?.text ?? fb.question, records: [], pendingIds: [], unavailable: [] };
      map.set(key, th);
      order.push(key);
    }
    th.records.push(fb);
  }
  const threads = order.map((k) => map.get(k)!);
  threads.forEach((th, i) => {
    const idx = record.mode === "english" ? -1 : qIndex(th.key);
    th.number = idx >= 0 ? idx + 1 : i + 1;
  });
  return threads;
}

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/** The answer as segments: words the speech engine was unsure about carry the `unsure` mark. */
export function answerSegments(text: string, low?: LowConfWord[]): Segments {
  const unsure = new Set((low ?? []).map((l) => bare(l.w)).filter(Boolean));
  if (!unsure.size) return [text];
  const out: Segments = [];
  let buf = "";
  for (const part of text.split(/(\s+)/)) {
    if (part && !/^\s+$/.test(part) && unsure.has(bare(part))) {
      if (buf) out.push(buf);
      buf = "";
      out.push({ kind: "unsure", text: part });
    } else buf += part;
  }
  if (buf) out.push(buf);
  return out;
}

/** "Revenue grew to [your number]." → plain text and fix-marked placeholders. */
export function rewriteSegments(text: string): { parts: Segments; placeholders: boolean } {
  const parts: Segments = [];
  let placeholders = false;
  let last = 0;
  for (const m of text.matchAll(/\[[^\]]+\]/g)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ kind: "fix", text: m[0] });
    placeholders = true;
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return { parts, placeholders };
}

function stronger(record: FeedbackRecord | undefined, local: StrongerState | undefined): StrongerModel | undefined {
  if (!record || !record.complete) return undefined;
  const src = local ?? (record.stronger ? { status: "ready" as const, ...record.stronger } : undefined);
  if (!src) return { status: "idle" };
  if (src.status === "loading") return { status: "loading" };
  if (src.status === "unavailable") return { status: "unavailable" };
  const { parts, placeholders } = rewriteSegments(src.rewrite ?? "");
  return { status: "ready", text: parts, placeholders: placeholders || Boolean(src.placeholders?.length) };
}

function correction(item: LanguageItem, voiced: boolean, turn?: Correction["turn"]): Correction {
  const heard = item.heard_as || item.original;
  const say = item.better[0] ?? "";
  const diff = diffMarks(heard, say);
  const kind = item.status === "unconfirmed" ? "unsure" : "heard";
  const seg = (parts: { text: string; mark: boolean }[], k: "fix" | "heard" | "unsure"): Segments =>
    parts.map((p) => (p.mark ? { kind: k, text: p.text } : p.text)).flatMap((p, i) => (i ? [" ", p] : [p]));
  return {
    id: item.id,
    turn,
    typed: !voiced,
    heard: seg(diff.heard, kind),
    say: seg(diff.say, "fix"),
    why: item.status === "unconfirmed" ? t("feedback.language.mayBeMisheard") : item.reason,
    dismissed: item.status === "dismissed",
  };
}

const layerOf = <L extends LayerName>(records: FeedbackRecord[], layer: L) =>
  records.map((r) => r.layers[layer]).filter((l): l is NonNullable<FeedbackRecord["layers"][L]> => Boolean(l) && l?.status !== "unavailable");

function contentBlock(records: FeedbackRecord[]): ContentBlock | undefined {
  const layers = layerOf(records, "content");
  if (!layers.length) return undefined;
  const items: ContentBlock["items"] = [];
  const seen = new Set<string>();
  const push = (text?: string) => {
    if (text && !seen.has(text)) { seen.add(text); items.push({ text }); }
  };
  for (const l of layers) {
    if (l.status === "fix") push(l.fix);
    for (const tip of l.tips ?? []) push(tip);
  }
  return { items };
}

function languageBlock(records: FeedbackRecord[]): LanguageBlock | undefined {
  const voiced = records.some((r) => r.source === "voice");
  const items = records.flatMap((r) => r.layers.language?.status === "unavailable" ? [] : (r.layers.language?.items ?? []).map((i) => ({ i, r })));
  if (!records.some((r) => r.layers.language && r.layers.language.status !== "unavailable")) return undefined;
  return {
    corrections: items.map(({ i, r }) => correction(i, r.source === "voice")),
    removed: [],
    note: voiced && items.length > 0,
  };
}

function deliveryBlock(record: FeedbackRecord | undefined): DeliveryBlock | undefined {
  const l = record?.layers.delivery;
  if (!l || l.status === "unavailable") return undefined;
  const m = l.metrics ?? {};
  const textMode = m.mode === "text";
  return {
    fillers: textMode ? undefined : m.fillers,
    length: !textMode && m.seconds != null ? formatClock(m.seconds) : undefined,
    words: m.words,
    pace: !textMode && m.wpm ? { wpm: m.wpm, verdict: paceVerdict(m.wpm) } : undefined,
    engineNote: !textMode && Boolean(m.fillers_note),
    textMode,
  };
}

function weakSpots(record: SessionRecord): WeakSpotModel[] {
  const out: WeakSpotModel[] = [];
  const ref = (ids?: string[]) => (ids ?? []).map((e) => /^q(\d+)$/i.exec(e)).filter((m): m is RegExpExecArray => Boolean(m)).map((m) => Number(m[1]));
  for (const w of record.debrief?.weak_spots ?? []) {
    const title = w.text || tMaybe(`feedback.tag.${w.tag}`, w.tag.replace(/_/g, " "));
    const ids = ref(w.evidence);
    const first = out.find((o) => o.layer === w.layer);
    if (first) {
      if (w.layer === "content" && !first.also) first.also = { text: title, ids };
      continue;
    }
    out.push({
      id: `${w.layer}-${w.tag}`,
      layer: w.layer,
      title,
      evidence: ids.length ? { kind: "questions", ids } : undefined,
    });
  }
  return out;
}

export interface MapOptions {
  /** `settings.obsidian_dir` is set. */
  obsidian: boolean;
  /** Stronger answers asked for in this visit (feedback id → state). */
  stronger: Record<string, StrongerState>;
  /** The debrief may still be written (right after a session). */
  waiting: boolean;
}

function followUpText(record: SessionRecord, key: string): string | undefined {
  return record.transcript.find((x) => x.role === "model" && x.kind === "follow_up" && x.question_id === key)?.text;
}

function questionModel(record: SessionRecord, th: Thread, opts: MapOptions): QuestionModel {
  const records = th.records;
  const main = records.find((r) => r.answer_kind === "main") ?? records[0];
  const follow = records.filter((r) => r.answer_kind === "follow_up");
  const lang = languageBlock(records);
  const content = contentBlock(records);
  const delivery = deliveryBlock(main);
  const unavailable = !content && !lang && !delivery && records.every((r) => r.complete);
  const counts = languageCounts(records);
  const fixes = (content?.items.length ?? 0);
  const typedAnswer = main ? main.source !== "voice" : false;
  const dismissed = lang?.corrections.filter((c) => c.dismissed).length ?? 0;
  return {
    n: th.number,
    question: th.question,
    summary: {
      content: content ? (fixes ? tp("feedback.count.fix", fixes) : t("debrief.sum.contentNothing")) : undefined,
      language: lang ? (counts.counted ? tp("debrief.sum.phrasings", counts.counted) : t("debrief.sum.languageNothing")) : undefined,
      delivery: delivery && delivery.fillers != null ? tp("debrief.sum.fillers", delivery.fillers) : undefined,
    },
    duration: main?.layers.delivery?.metrics?.seconds != null && !typedAnswer ? formatClock(main.layers.delivery.metrics.seconds) : undefined,
    followUps: follow.length,
    misheard: dismissed || undefined,
    edited: main?.edited || undefined,
    unavailable,
    followUp: followUpText(record, th.key),
    answer: main ? answerSegments(main.answer, main.heard_as_words) : [],
    followUpAnswer: follow.length ? follow.map((r) => r.answer).join(" ") : undefined,
    layers: { content, language: lang, delivery },
    stronger: record.mode === "english" ? undefined : stronger(main, main ? opts.stronger[main.id] : undefined),
  };
}

function metaFor(record: SessionRecord, questions: number, followUps: number, turns: number): MetaItem[] {
  const meta: MetaItem[] = [];
  if (record.mode === "interview") {
    const round = record.round_type ? tMaybe(`session.round.${record.round_type}`, record.round_type) : "";
    const strict = record.strictness ? ["gentle", "standard", "tough"][record.strictness - 1] : "";
    const label = [round, strict ? tMaybe(`session.strict.${strict}`, strict) : ""].filter(Boolean).join(" · ");
    if (label) meta.push({ icon: "briefcase", text: label });
  } else {
    meta.push({ icon: "language", text: t("history.mode.english") });
  }
  const when = [formatDateTime(record.started_at), formatDuration(record.duration_s)].filter(Boolean).join(" · ");
  if (when) meta.push({ icon: "clock", text: when });
  meta.push({
    icon: "chat",
    text: record.mode === "english"
      ? tp("debrief.meta.turns", turns)
      : `${tp("debrief.meta.questions", questions)}, ${tp("debrief.meta.followUps", followUps)}`,
  });
  const usage = usageText(record);
  if (usage) meta.push({ icon: "cpu", text: usage });
  meta.push({ icon: "check", text: t("debrief.savedHere"), href: "/settings/storage" });
  return meta;
}

/** D88: "12 requests to the AI · under 1% of the monthly limit" (the percent only where the plan reports one). */
export function usageText(record: SessionRecord): string {
  const u = record.usage;
  if (!u || !u.requests) return "";
  const parts = [tp("debrief.meta.requests", u.requests)];
  const spent = (u.windows ?? []).map((w) => ({ id: w.id, used: Math.max(0, w.after - w.before) }));
  if (spent.length) {
    const most = spent.reduce((a, b) => (b.used > a.used ? b : a));
    parts.push(t("debrief.meta.spent", { used: most.used < 1 ? t("engines.limits.underOne") : percent(most.used), window: windowName(most.id) }));
  }
  return parts.join(" · ");
}

function englishModel(threads: Thread[]): EnglishModel {
  const corrections: Correction[] = [];
  const count = new Map<string, number>();
  for (const th of threads) {
    for (const r of th.records) {
      for (const i of r.layers.language?.items ?? []) {
        corrections.push(correction(i, r.source === "voice", { n: th.number }));
        if (i.status !== "dismissed") {
          const k = bare(i.original);
          count.set(k, (count.get(k) ?? 0) + 1);
        }
      }
    }
  }
  const phrases = corrections
    .filter((c) => !c.dismissed && (count.get(bare(plainText(c.heard))) ?? 0) > 1)
    .filter((c, i, all) => all.findIndex((x) => bare(plainText(x.heard)) === bare(plainText(c.heard))) === i)
    .map((c) => ({ from: plainText(c.heard), to: plainText(c.say), times: count.get(bare(plainText(c.heard))) ?? 2 }));
  return { corrections, visible: 3, repeated: phrases.length, removed: [], phrases };
}

/** The saved transcript as chat lines; each line knows its question (by `question_id`) so an answer opens its breakdown. */
function conversation(record: SessionRecord): ConversationTurn[] {
  const english = record.mode === "english";
  const number = (id?: string) => {
    const i = english || !id ? -1 : record.questions.findIndex((q) => q.id === id);
    return i >= 0 ? i + 1 : undefined;
  };
  return record.transcript
    .filter((x) => x.text?.trim())
    .map((x, i) => ({
      id: `t${i}`,
      speaker: x.role === "model" ? "mike" : "user",
      text: x.text.trim(),
      q: number(x.question_id),
      opens: x.role === "model" && x.kind === "question" ? true : undefined,
      followUp: x.role === "model" && x.kind === "follow_up" ? true : undefined,
    }));
}

const plainText = (s: Segments) => s.map((p) => (typeof p === "string" ? p : p.text)).join("");

/** Questions Mike actually asked (D71: counting answers gave "8 questions" for a talk with one question and 8 replies). */
function asked(record: SessionRecord): number {
  return new Set(record.transcript.filter((x) => x.role === "model" && x.kind === "question").map((x) => x.question_id ?? x.text)).size;
}

/** Map a saved session to the view model. */
export function mapRecord(record: SessionRecord, opts: MapOptions): DebriefModel {
  const threads = threadsFromRecord(record);
  const english = record.mode === "english";
  const answered = record.stats?.answers ?? record.feedback.filter((f) => f.answer_kind !== "follow_up").length;
  const total = Math.max(record.questions.length, threads.length);
  const d = record.debrief;
  const partial = !english && (Boolean(d?.too_short) || (answered < MIN_ANSWERS && total > 0 && answered < total && !d?.verdict)) ? { answered, total } : undefined;
  const followUps = record.feedback.filter((f) => f.answer_kind === "follow_up").length;
  const spots = partial ? [] : weakSpots(record);
  const hasFeedback = record.feedback.length > 0;
  const notice: DebriefModel["verdictNotice"] = partial || english ? undefined
    : !d ? (opts.waiting ? "pending" : hasFeedback ? "missing" : undefined)
      : d.source === "template" ? "template" : undefined;
  const questionNumbers = threads.map((th) => th.number);
  const maxAsked = Math.max(0, ...questionNumbers);
  return {
    id: record.id,
    title: record.title || t("debrief.title"),
    meta: metaFor(record, english ? 0 : asked(record) || threads.length, followUps, threads.length),
    obsidian: opts.obsidian,
    saved: true,
    verdict: d?.verdict && !partial && !english ? { headline: d.verdict } : undefined,
    verdictNotice: notice,
    partial,
    weakSpots: spots,
    drill: !partial && !english && spots.length ? { points: spots.length } : undefined,
    questions: english ? [] : threads.map((th) => questionModel(record, th, opts)),
    skipped: partial && maxAsked < total ? { from: maxAsked + 1, to: total } : undefined,
    english: english ? englishModel(threads) : undefined,
    conversation: conversation(record),
  };
}

/** Find the feedback record that holds a flag (the view only knows the question number and the flag id). */
export function feedbackOfFlag(record: SessionRecord, flagId: string): FeedbackRecord | undefined {
  return record.feedback.find((f) => f.layers.language?.items?.some((i) => i.id === flagId));
}
