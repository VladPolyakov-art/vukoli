/* Tough talk debriefs: pure mapping from the server's debrief JSON (docs/features/tough-talk/protocol.md §5, §6) to what
 * the frames show (ds/screens/tough-talk.md §5, §6). No React, no network: unit-tested in model.test.ts.
 * Chrome words come from the locale file; text from the server (labels, quotes, card texts) is shown as it is. */
import { t, tp } from "../../../i18n";
import { formatAmount } from "../../../lib/amount";
import { formatDateTime, formatDuration, wordCount } from "../../../lib/format";
import type {
  NegotiateDebrief, NegotiateScenario, SessionRecord, TacticCardData, ToughDebrief, ToughDebriefQuestion, ToughSignal, ToughTheme,
} from "../../../lib/types";
import type { ConversationTurn, MetaItem } from "../types";

/** Card texts and theme names from `GET /api/tough-talk/content`, indexed. Absent while it loads or when it failed. */
export interface TalkContent {
  cards: Record<string, TacticCardData>;
  themes: Partial<Record<ToughTheme, string>>;
}

export const EM_DASH = "—";
export const money = (n: number, currency: string) => `${formatAmount(n)} ${currency}`;
const percent = (n: number | null | undefined) => (n === null || n === undefined ? EM_DASH : `${Math.round(n)}%`);

/* ---------- shared ---------- */

/** User turns of a saved record (the transcript has no ids for them). */
export function userTurns(record: SessionRecord): number {
  return record.transcript.filter((x) => x.role === "user").length;
}

function whenMeta(record: SessionRecord): MetaItem | null {
  const when = [formatDateTime(record.started_at), formatDuration(record.duration_s)].filter(Boolean).join(" · ");
  return when ? { icon: "clock", text: when } : null;
}
const saved = (): MetaItem => ({ icon: "check", text: t("debrief.savedHere"), href: "/settings/storage" });

/** The Q-number of each question id, to number the lines of the chat. */
export function conversationTurns(record: SessionRecord, tough?: ToughDebrief | null): ConversationTurn[] {
  const numberOf = new Map((tough?.questions ?? []).map((q) => [q.question_id, q.n]));
  let q: number | undefined;
  return record.transcript.map((x, i): ConversationTurn => {
    if (x.role === "model" && x.kind === "question") q = numberOf.get(x.question_id ?? "") ?? (q === undefined ? 1 : q + 1);
    const base = { id: `t${i}`, speaker: x.role === "user" ? "user" as const : "mike" as const, text: x.text, q };
    return x.role === "model" && x.kind === "question" ? { ...base, opens: true } : x.kind === "follow_up" ? { ...base, followUp: true } : base;
  });
}

/* ---------- negotiate ---------- */

export function negotiateTitle(record: SessionRecord, d: NegotiateDebrief | null): string {
  if (record.title) return record.title;
  if (!d) return t("debrief.negotiate.missing");
  return d.surprise
    ? t("debrief.negotiate.titleSurprise", { role: d.role, style: d.style_name })
    : t("debrief.negotiate.title", { role: d.role, style: d.style_name });
}

export function negotiateMeta(record: SessionRecord, d: NegotiateDebrief | null): MetaItem[] {
  const style = d ? (d.surprise ? t("debrief.negotiate.result.styleSurprise", { style: d.style_name }) : d.style_name) : "";
  return [
    { icon: "target", text: d?.scenario_name && style ? `${d.scenario_name} · ${style}` : style ? t("debrief.negotiate.meta", { style }) : t("debrief.negotiate.title", { role: "", style: "" }).trim() },
    ...(whenMeta(record) ? [whenMeta(record)!] : []),
    { icon: "chat", text: tp("debrief.meta.turns", record.negotiation?.user_turns ?? userTurns(record)) },
    saved(),
  ];
}

/** Negotiation v2 (protocol.md §7.4): a v1 record has no scenario; it was the offer call. */
export const scenarioOf = (d: NegotiateDebrief): NegotiateScenario => d.scenario ?? "offer";
export const isV2 = (d: NegotiateDebrief) => d.version === 2;

export type NegotiateEdge = "none" | "noOffer" | "acceptedFirst" | "noRoom" | "declined" | "screening" | "counter";

export interface NegotiateResult {
  edge: NegotiateEdge;
  headline: string;
  /** "Now 91,000 → 98,000 after 3 months" / "91,000 EUR from the start" / "Last offer 91,000 EUR". */
  dealLine?: string;
  /** Only with a step-up: the offer letter has it (true) or not (false). */
  inWriting?: boolean;
  /** The check label: a raise is confirmed in writing, an offer goes in the offer letter. */
  writingLabel: string;
  /** Two figures: share of the room captured now and, with a step-up, later. "—" when there is no number. */
  now: string;
  later?: { value: string; months: number };
  yearOne?: string;
  /** A sentence under the figures: "no room", "no offer yet". */
  note?: string;
  rows: Array<{ id: string; label: string; value: string }>;
  levers: string[];
  /** Negotiation v2: how you handled this call, one row each (yes / no and the numbers), from the scenario's section. */
  facts: Array<{ id: string; label: string; value: string }>;
  /** Counteroffer: the two offers side by side (and your pay now). No verdict on staying or leaving. */
  compare?: Array<{ id: string; label: string; value: string }>;
}

export function negotiateEdge(d: NegotiateDebrief): NegotiateEdge {
  if (isV2(d) && scenarioOf(d) === "screening") return "screening";
  if (isV2(d) && scenarioOf(d) === "counteroffer") return "counter";
  if (d.no_offer) return "noOffer";
  if (d.outcome === "declined") return "declined";
  if (d.outcome === "accepted" && d.signals.some((s) => s.id === "accepted_first_offer")) return "acceptedFirst";
  if (d.summary.captured_now_pct === null && d.summary.opening !== null) return "noRoom";
  return "none";
}

function outcomeText(d: NegotiateDebrief): string {
  switch (d.outcome) {
    case "accepted": return t("debrief.negotiate.outcome.accepted");
    case "declined": return t("debrief.negotiate.outcome.declined");
    case "turn_cap": return t("debrief.negotiate.outcome.limit");
    case "ended": return t("debrief.negotiate.outcome.ended");
    case "time": return d.outcome_label || t("debrief.negotiate.outcome.ended");
    case "noted": return t("debrief.negotiate.outcome.noted");
    default: return d.outcome_label || t("debrief.negotiate.outcome.ended");
  }
}

export function negotiateResult(d: NegotiateDebrief): NegotiateResult {
  const { summary: s, currency } = d;
  const edge = negotiateEdge(d);
  const last = s.final_offer;
  const v2 = isV2(d);
  const sc = scenarioOf(d);
  const sec = d.section;
  let headline: string;
  if (edge === "screening" || edge === "counter") headline = d.verdict;
  else if (v2 && sc === "raise" && sec?.raise_now) {
    headline = t("debrief.negotiate.raise.now", { from: formatAmount(sec.current ?? 0), to: formatAmount((sec.current ?? 0) + sec.raise_now.amount), pct: sec.raise_now.pct_of_current, currency });
  } else if (v2 && sc === "raise" && sec?.dated) {
    headline = t("debrief.negotiate.raise.dated", { amount: formatAmount(sec.dated.amount), months: sec.dated.after_months, currency });
  } else if (v2 && sc === "raise" && (sec?.other_levers?.length ?? 0) > 0) headline = t("debrief.negotiate.raise.nonMoney");
  else if (v2 && sc === "raise") headline = d.verdict || t("debrief.negotiate.raise.none");
  else if (edge === "noOffer") headline = t("debrief.negotiate.edge.noOfferTitle");
  else if (edge === "declined") headline = t("debrief.negotiate.edge.declined");
  else if (edge === "acceptedFirst" && last !== null) headline = t("debrief.negotiate.edge.acceptedFirst", { amount: formatAmount(last), currency });
  else if (s.opening !== null && last !== null && last !== s.opening) {
    headline = t("debrief.negotiate.result.moved", { from: formatAmount(s.opening), to: formatAmount(last), currency });
  } else headline = last !== null ? t("debrief.negotiate.edge.lastOffer", { amount: formatAmount(last), currency }) : t("debrief.negotiate.edge.noOfferTitle");

  let dealLine: string | undefined;
  let inWriting: boolean | undefined;
  if (v2 && sc === "raise") {
    // A raise has no "from the start" line: the headline says what moved now; a dated raise adds one line.
    if (sec?.dated) {
      dealLine = t("debrief.negotiate.raise.datedLine", { amount: formatAmount(sec.dated.amount), months: sec.dated.after_months, currency });
      inWriting = sec.dated.in_writing;
    }
  } else if (d.deal) {
    dealLine = t("debrief.negotiate.result.deal", { now: formatAmount(d.deal.now), later: formatAmount(d.deal.later), months: d.deal.after_months });
    inWriting = d.deal.in_writing;
  } else if (edge === "declined" && last !== null) dealLine = t("debrief.negotiate.edge.lastOffer", { amount: formatAmount(last), currency });
  else if (edge === "none" && last !== null) dealLine = t("debrief.negotiate.result.dealFlat", { now: formatAmount(last), currency });

  const rows: NegotiateResult["rows"] = [];
  if (s.opening !== null && !(sc === "raise" && v2)) rows.push({ id: "first", label: t("debrief.negotiate.result.firstOffer"), value: money(s.opening, currency) });
  if (sc === "raise" && v2) rows.push({ id: "current", label: t("debrief.negotiate.raise.currentPay"), value: money(sec?.current ?? s.job_low ?? 0, currency) });
  rows.push({ id: "target", label: sc === "raise" && v2 ? t("debrief.negotiate.raise.ask") : t("debrief.negotiate.result.target"), value: money(s.target, currency) });
  if (v2 && sc === "raise" && sec?.current !== undefined && sec.asked !== undefined) {
    rows.push({ id: "range", label: t("debrief.negotiate.raise.room"), value: `${formatAmount(sec.current)}–${formatAmount(sec.asked)} ${currency}` });
  } else if (d.hidden_range) {
    rows.push({
      id: "range",
      label: s.range_source === "your_target" ? t("debrief.negotiate.result.rangeBuilt") : t("debrief.negotiate.result.range"),
      value: `${formatAmount(d.hidden_range.floor)}–${formatAmount(d.hidden_range.ceiling)} ${currency}`,
    });
  }
  rows.push({ id: "outcome", label: t("debrief.negotiate.result.outcome"), value: outcomeText(d) });
  rows.push({
    id: "style",
    label: t("debrief.negotiate.result.style"),
    value: d.surprise ? t("debrief.negotiate.result.styleSurprise", { style: d.style_name }) : d.style_name,
  });

  const dated = v2 && sc === "raise" ? sec?.dated : null;
  return {
    edge,
    headline,
    dealLine,
    inWriting,
    writingLabel: v2 && sc === "raise" ? t("debrief.negotiate.raise.inWriting") : t("debrief.negotiate.result.inWriting"),
    now: percent(edge === "noOffer" ? null : v2 && sc === "raise" ? sec?.captured_now_pct ?? s.captured_now_pct : s.captured_now_pct),
    later: dated && (sec?.captured_later_pct ?? null) !== null
      ? { value: percent(sec!.captured_later_pct), months: dated.after_months }
      : d.deal && s.captured_later_pct !== null ? { value: percent(s.captured_later_pct), months: d.deal.after_months } : undefined,
    yearOne: d.deal && s.year_one !== null ? t("debrief.negotiate.result.yearOne", { amount: formatAmount(s.year_one), currency }) : undefined,
    note: edge === "noRoom" ? t("debrief.negotiate.edge.noRoom") : edge === "counter" ? d.section?.note : undefined,
    rows,
    levers: d.levers_won.map((l) => `${l.label}: ${l.value}`),
    facts: v2 ? scenarioFacts(d) : [],
    compare: edge === "counter" ? counterCompare(d) : undefined,
  };
}

const yn = (v: boolean | undefined) => (v ? t("debrief.negotiate.moves.yes") : t("debrief.negotiate.moves.no"));
const BAND: Record<string, "below" | "inside" | "above"> = { below: "below", inside: "inside", above: "above" };

/** Negotiation v2: what you did in this call, from the scenario's `section` (code-judged by the server). */
export function scenarioFacts(d: NegotiateDebrief): NegotiateResult["facts"] {
  const sec = d.section;
  if (!sec) return [];
  const f = (id: string, label: string, value: string) => ({ id, label, value });
  const c = d.currency;
  switch (scenarioOf(d)) {
    case "screening":
      return [
        f("first", t("debrief.negotiate.screening.first"), sec.first_number != null
          ? `${money(sec.first_number, c)}${sec.vs_band ? ` · ${t(`debrief.negotiate.screening.band.${BAND[sec.vs_band] ?? "inside"}` as "debrief.negotiate.screening.band.inside")}` : ""}`
          : t("debrief.negotiate.screening.noNumber")),
        f("asked", t("debrief.negotiate.screening.askedRange"), yn(sec.asked_range)),
        f("got", t("debrief.negotiate.screening.gotRange"), yn(sec.got_range)),
        f("current", t("debrief.negotiate.screening.revealed"), yn(sec.revealed_current)),
        f("scope", t("debrief.negotiate.screening.scope"), yn(sec.tied_to_scope)),
        f("package", t("debrief.negotiate.screening.package"), yn(sec.flexible_on_package)),
      ];
    case "offer":
      return [f("level", t("debrief.negotiate.facts.levelAsked"), yn(sec.level_asked))];
    case "internship":
      return [
        f("level", t("debrief.negotiate.facts.levelAsked"), yn(sec.level_asked)),
        f("won", t("debrief.negotiate.facts.levelWon"), yn(sec.level_won)),
        f("step", t("debrief.negotiate.facts.stepUp"), sec.step_up_line ? sec.step_up_line : t("debrief.negotiate.moves.no")),
        f("results", t("debrief.negotiate.facts.results"), yn(sec.results_named)),
      ];
    case "counteroffer":
      return [
        f("reason", t("debrief.negotiate.counter.reason"), sec.reason_named && sec.reason ? t(`home.talk.leaveReason.${sec.reason}` as "home.talk.leaveReason.money") : t("debrief.negotiate.moves.no")),
        f("matched", t("debrief.negotiate.counter.matched"), yn(sec.counter_matched)),
        f("writing", t("debrief.negotiate.counter.writing"), yn(sec.counter_in_writing)),
        f("time", t("debrief.negotiate.counter.time"), yn(sec.time_asked)),
        f("promise", t("debrief.negotiate.counter.promise"), yn(sec.unwritten_promise_accepted)),
        f("deadline", t("debrief.negotiate.counter.deadline"), yn(sec.deadline_accepted)),
      ];
    case "raise":
      return [
        f("results", t("debrief.negotiate.facts.results"), yn(sec.results_named)),
        ...(sec.dated ? [f("date", t("debrief.negotiate.raise.criteria"), yn(sec.dated.criteria))] : []),
        ...(sec.other_levers?.length ? [f("levers", t("debrief.negotiate.raise.levers"), sec.other_levers.join(", "))] : []),
        ...(sec.threat_without_offer ? [f("threat", t("debrief.negotiate.raise.threat"), t("debrief.negotiate.moves.yes"))] : []),
      ];
  }
}

/** Counteroffer: your pay now, the new offer, Mike's counter (first → last). */
function counterCompare(d: NegotiateDebrief): NonNullable<NegotiateResult["compare"]> {
  const { summary: s, currency } = d;
  const out: NonNullable<NegotiateResult["compare"]> = [];
  if (s.job_low !== null) out.push({ id: "now", label: t("debrief.negotiate.counter.now"), value: money(s.job_low, currency) });
  out.push({ id: "new", label: t("debrief.negotiate.counter.new"), value: money(s.target, currency) });
  if (s.opening !== null) {
    out.push({ id: "counter", label: t("debrief.negotiate.counter.mike"), value: s.final_offer !== null && s.final_offer !== s.opening ? `${formatAmount(s.opening)} → ${money(s.final_offer, currency)}` : money(s.opening, currency) });
  }
  return out;
}

export interface ObjectionRow { id: string; turn: number; mike: string; reply: string | null; answered: boolean; mayBeWrong: boolean }
/** Objections Mike raised and whether your next line answered them (judged by code: it may be wrong). */
export function objectionRows(d: NegotiateDebrief): ObjectionRow[] {
  return (d.objections ?? []).map((o, i) => ({ id: `${o.id}-${i}`, turn: o.turn, mike: o.mike_line, reply: o.user_reply, answered: o.answered, mayBeWrong: o.may_be_wrong }));
}

/** Negotiation v3 (P8): "Before the real talk". Empty/missing homework = no section. */
export interface HomeworkRow { id: string; n: number; text: string; quote: string | null }
export interface HomeworkModel { rows: HomeworkRow[]; repeat: { count: number; quote: string } | null; prepSkipped: boolean }
export function homeworkModel(d: NegotiateDebrief): HomeworkModel | null {
  const items = (d.homework ?? []).filter((x) => x && x.text);
  if (!items.length) return null;
  // The server's "repeated" item already says it (with the quote): no second note under the list.
  const listed = items.some((x) => x.id === "repeated");
  const rep = !listed && d.repeats && d.repeats.count >= 1 && d.repeats.quote ? { count: d.repeats.count, quote: d.repeats.quote } : null;
  return {
    rows: items.map((x, i) => ({ id: `${x.id}-${i}`, n: i + 1, text: x.text, quote: x.quote || null })),
    repeat: rep,
    prepSkipped: items.some((x) => x.id === "prep_skipped"),
  };
}

/** Notes for the moves frame: the check with the hiring manager and the deadline Mike used. */
export function checkNotes(d: NegotiateDebrief): string[] {
  const out: string[] = [];
  const c = d.check;
  if (c?.used) {
    const r = c.result;
    const back = !r ? "" : r.kind === "base" && r.from != null && r.to != null
      ? t("debrief.negotiate.check.base", { from: formatAmount(r.from), to: formatAmount(r.to), currency: d.currency })
      : r.kind === "lever" ? t("debrief.negotiate.check.lever") : t("debrief.negotiate.check.none");
    out.push([t("debrief.negotiate.check.line", { n: c.turn }), back].filter(Boolean).join(" "));
  }
  if (d.deadline?.said) out.push(d.deadline.label || t("debrief.negotiate.check.deadline", { n: d.deadline.turn }));
  return out;
}

export interface MoveRow {
  id: string;
  turn: number;
  /** "88,000 → 91,000" or the step-up line. */
  amounts: string;
  cause: string;
  quote?: string;
  /** Step-up only: "Goals named: yes · In writing: asked". */
  sub?: string;
}

/** Fields the server added to the negotiate debrief (protocol.md §5): shown when present, older saved sessions have neither. */
export type NegotiateExtras = {
  held?: Array<{ turn: number; offer: number; asked: number; why: string; quote: string }>;
  named_below_opening?: { turn: number; your_number: number; opening: number; quote: string } | null;
};

export interface NegotiateMoves {
  rows: MoveRow[];
  /** "You said 70,000 before Mike made an offer. He was ready to open at 88,000." */
  below?: string;
  /** Server lines about pressure ("Mike used a 48-hour deadline; real recruiters may or may not."). */
  pressure: string[];
  /** "You mentioned another offer. Mike didn't count it…" */
  offerIgnored: boolean;
  /** Levers you didn't ask about. */
  unasked: string[];
  /** Negotiation v2: Mike's check with the hiring manager, the deadline. */
  notes: string[];
}

const CAUSE_KEY: Record<string, "reason" | "lever" | "stepUp" | "offer"> = {
  justified_counter: "reason", competing_offer: "offer", step_up: "stepUp", offered_when_final: "lever",
};
export function causeText(cause: string, label: string): string {
  const key = cause.startsWith("lever:") ? "lever" : CAUSE_KEY[cause];
  return key ? t(`debrief.negotiate.cause.${key}`) : label;
}

export function negotiateMoves(d: NegotiateDebrief & NegotiateExtras): NegotiateMoves {
  const shifts = d.shifts.map((x, i): MoveRow => {
    const stepUp = x.cause === "step_up" && d.deal;
    const writing = d.deal?.in_writing ? t("debrief.negotiate.moves.yes")
      : d.signals.some((s) => s.id === "in_writing_asked") ? t("debrief.negotiate.moves.asked") : t("debrief.negotiate.moves.no");
    return {
      id: `m${i}`,
      turn: x.turn,
      amounts: stepUp && d.deal
        ? t("debrief.negotiate.result.deal", { now: formatAmount(d.deal.now), later: formatAmount(d.deal.later), months: d.deal.after_months })
        : `${formatAmount(x.from)} → ${formatAmount(x.to)}`,
      cause: causeText(x.cause, x.cause_label),
      quote: x.quote || undefined,
      sub: stepUp && d.deal
        ? t("debrief.negotiate.moves.stepUp", { goals: d.deal.criteria_named ? t("debrief.negotiate.moves.yes") : t("debrief.negotiate.moves.no"), writing })
        : undefined,
    };
  });
  const held = (d.held ?? []).map((h, i): MoveRow => ({
    id: `h${i}`, turn: h.turn, amounts: `${formatAmount(h.offer)} → ${formatAmount(h.offer)}`, cause: t("debrief.negotiate.moves.held"),
    quote: h.quote || undefined,
  }));
  const rows = [...shifts, ...held].sort((a, b) => a.turn - b.turn);
  const nb = d.named_below_opening;
  return {
    rows,
    below: nb ? t("debrief.negotiate.moves.below", { said: money(nb.your_number, d.currency), open: money(nb.opening, d.currency) }) : undefined,
    pressure: d.pressure_notes,
    offerIgnored: Boolean(d.competing_offer_note),
    unasked: d.missed_levers.map((m) => m.label),
    notes: checkNotes(d),
  };
}

export const movesEmpty = (m: NegotiateMoves) => !m.rows.length && !m.below && !m.pressure.length && !m.offerIgnored && !m.unasked.length && !m.notes.length;

/** "Hints you used: Ask for their range (turn 1) · Bridge the gap with a step-up (turn 6)." Empty: no line. */
export function hintsLine(used: ReadonlyArray<{ title: string; turn: number | string | null }> | undefined): string | null {
  if (!used?.length) return null;
  const list = used.map((h) => (typeof h.turn === "number" ? `${h.title} (${t("debrief.negotiate.moves.turn", { n: h.turn }).toLowerCase()})` : h.title)).join(" · ");
  return t("session.hint.usedLine", { list });
}

/* ---------- tough ---------- */

export function toughTitle(record: SessionRecord, d: ToughDebrief | null): string {
  if (record.title) return record.title;
  return d ? t("debrief.tough.title", { theme: d.theme_name }) : t("debrief.tough.missing");
}

export function pushesIn(d: ToughDebrief): number {
  return d.questions.reduce((n, q) => n + q.pushes.length, 0);
}

export function toughMeta(record: SessionRecord, d: ToughDebrief | null): MetaItem[] {
  return [
    { icon: "hand", text: t("debrief.tough.meta") },
    ...(whenMeta(record) ? [whenMeta(record)!] : []),
    { icon: "chat", text: d ? t("debrief.tough.metaCount", { n: d.questions.length, pushes: pushesIn(d) }) : tp("debrief.meta.turns", userTurns(record)) },
    saved(),
  ];
}

export interface ToughSummary {
  headline: string;
  /** The answer that hurt most; null when nothing hurt. */
  hurt: { n: number; question: string; label: string; quote: string | null } | null;
  none: string | null;
}

export function toughSummary(d: ToughDebrief): ToughSummary {
  const s = d.summary;
  const headline = s.show_counts
    ? t("debrief.tough.summary.calm", { n: s.calm, total: s.answered })
    : s.answered === 1 ? t("debrief.tough.summary.one") : t("debrief.tough.summary.few", { n: s.answered });
  const h = s.hurt_most;
  return {
    headline,
    hurt: h ? { n: h.question_no, question: h.question, label: signalText(h.signal, h.label, d.questions.find((q) => q.n === h.question_no)), quote: h.quote || null } : null,
    none: h || s.answered === 0 ? null : t("debrief.tough.summary.none"),
  };
}

/** The label of a signal: our words for the ones the map names, the server's for the rest. */
export function signalText(id: string, label: string, q?: ToughDebriefQuestion): string {
  switch (id) {
    case "shares_personal_info": return t("debrief.tough.signal.personal");
    case "blames_others": return t("debrief.tough.signal.blame");
    case "argues_instead": return t("debrief.tough.signal.argue");
    case "no_example": return t("debrief.tough.signal.noExample");
    case "rambling": return q ? t("debrief.tough.signal.ramble", { words: wordCount(q.answers.map((a) => a.text).join(" ")) }) : label;
    default: return label;
  }
}

export interface HurtItem { id: string; label: string; quote: string | null; mayBeWrong: boolean }

/** The bad signals of one question, in the server's order. A model quote is shown only when it is a quote (it is verbatim). */
export function hurtItems(q: ToughDebriefQuestion): HurtItem[] {
  return q.signals.filter((s: ToughSignal) => s.bad).map((s) => ({
    id: s.id,
    label: signalText(s.id, s.label, q),
    quote: s.quote || null,
    mayBeWrong: s.source === "model" || Boolean(s.may_be_wrong),
  }));
}

export function themeName(content: TalkContent | undefined, theme: ToughTheme, fallback?: string): string {
  return content?.themes[theme] ?? fallback ?? theme.charAt(0).toUpperCase() + theme.slice(1);
}

export function indexContent(c: { cards: TacticCardData[]; themes: Array<{ id: ToughTheme; name: string }> }): TalkContent {
  return { cards: Object.fromEntries(c.cards.map((x) => [x.id, x])), themes: Object.fromEntries(c.themes.map((x) => [x.id, x.name])) };
}
