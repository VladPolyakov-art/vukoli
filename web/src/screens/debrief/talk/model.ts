/* Tough talk debriefs: pure mapping from the server's debrief JSON (docs/features/tough-talk/protocol.md §5, §6) to what
 * the frames show (ds/screens/tough-talk.md §5, §6). No React, no network: unit-tested in model.test.ts.
 * Chrome words come from the locale file; text from the server (labels, quotes, card texts) is shown as it is. */
import { t, tp } from "../../../i18n";
import { formatAmount } from "../../../lib/amount";
import { formatDateTime, formatDuration, wordCount } from "../../../lib/format";
import type {
  NegotiateDebrief, SessionRecord, TacticCardData, ToughDebrief, ToughDebriefQuestion, ToughSignal, ToughTheme,
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
    { icon: "target", text: style ? t("debrief.negotiate.meta", { style }) : t("debrief.negotiate.title", { role: "", style: "" }).trim() },
    ...(whenMeta(record) ? [whenMeta(record)!] : []),
    { icon: "chat", text: tp("debrief.meta.turns", record.negotiation?.user_turns ?? userTurns(record)) },
    saved(),
  ];
}

export type NegotiateEdge = "none" | "noOffer" | "acceptedFirst" | "noRoom" | "declined";

export interface NegotiateResult {
  edge: NegotiateEdge;
  headline: string;
  /** "Now 91,000 → 98,000 after 3 months" / "91,000 EUR from the start" / "Last offer 91,000 EUR". */
  dealLine?: string;
  /** Only with a step-up: the offer letter has it (true) or not (false). */
  inWriting?: boolean;
  /** Two figures: share of the room captured now and, with a step-up, later. "—" when there is no number. */
  now: string;
  later?: { value: string; months: number };
  yearOne?: string;
  /** A sentence under the figures: "no room", "no offer yet". */
  note?: string;
  rows: Array<{ id: string; label: string; value: string }>;
  levers: string[];
}

export function negotiateEdge(d: NegotiateDebrief): NegotiateEdge {
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
  }
}

export function negotiateResult(d: NegotiateDebrief): NegotiateResult {
  const { summary: s, currency } = d;
  const edge = negotiateEdge(d);
  const last = s.final_offer;
  let headline: string;
  if (edge === "noOffer") headline = t("debrief.negotiate.edge.noOfferTitle");
  else if (edge === "declined") headline = t("debrief.negotiate.edge.declined");
  else if (edge === "acceptedFirst" && last !== null) headline = t("debrief.negotiate.edge.acceptedFirst", { amount: formatAmount(last), currency });
  else if (s.opening !== null && last !== null && last !== s.opening) {
    headline = t("debrief.negotiate.result.moved", { from: formatAmount(s.opening), to: formatAmount(last), currency });
  } else headline = last !== null ? t("debrief.negotiate.edge.lastOffer", { amount: formatAmount(last), currency }) : t("debrief.negotiate.edge.noOfferTitle");

  let dealLine: string | undefined;
  let inWriting: boolean | undefined;
  if (d.deal) {
    dealLine = t("debrief.negotiate.result.deal", { now: formatAmount(d.deal.now), later: formatAmount(d.deal.later), months: d.deal.after_months });
    inWriting = d.deal.in_writing;
  } else if (edge === "declined" && last !== null) dealLine = t("debrief.negotiate.edge.lastOffer", { amount: formatAmount(last), currency });
  else if (edge === "none" && last !== null) dealLine = t("debrief.negotiate.result.dealFlat", { now: formatAmount(last), currency });

  const rows: NegotiateResult["rows"] = [];
  if (s.opening !== null) rows.push({ id: "first", label: t("debrief.negotiate.result.firstOffer"), value: money(s.opening, currency) });
  rows.push({ id: "target", label: t("debrief.negotiate.result.target"), value: money(s.target, currency) });
  if (d.hidden_range) {
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

  return {
    edge,
    headline,
    dealLine,
    inWriting,
    now: percent(edge === "noOffer" ? null : s.captured_now_pct),
    later: d.deal && s.captured_later_pct !== null ? { value: percent(s.captured_later_pct), months: d.deal.after_months } : undefined,
    yearOne: d.deal && s.year_one !== null ? t("debrief.negotiate.result.yearOne", { amount: formatAmount(s.year_one), currency }) : undefined,
    note: edge === "noRoom" ? t("debrief.negotiate.edge.noRoom") : undefined,
    rows,
    levers: d.levers_won.map((l) => `${l.label}: ${l.value}`),
  };
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
  };
}

export const movesEmpty = (m: NegotiateMoves) => !m.rows.length && !m.below && !m.pressure.length && !m.offerIgnored && !m.unasked.length;

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
