/* The negotiate numbers card (tough-talk.md §2.4, US-63): the form's values as typed, and the pure validation.
 * Fields keep text; `validateNumbers` parses it with lib/amount and returns i18n keys, so the card, the plan's
 * "Change your numbers" dialog and the tests all agree. */
import { formatAmount, parseAmount, amountErrorKey } from "../../lib/amount";
import type { LeaveReason, NegotiateScenario, NegotiateStart, NegotiateStyle } from "../../lib/types";
import type { NumbersMemory } from "./types";

export type NumbersField = "role" | "low" | "high" | "target" | "code" | "currentPay" | "ask" | "newOffer" | "reason";

/** Which fields each scenario asks for (mirrors `scenarios[].fields` of the content; Negotiation v2 §7.2). */
export type ScenarioField = "role" | "target" | "range" | "offer" | "currentPay" | "newOffer" | "reason" | "ask" | "month";
export const SCENARIO_FIELDS: Record<NegotiateScenario, ScenarioField[]> = {
  screening: ["role", "target", "range"],
  offer: ["role", "target", "range", "offer"],
  internship: ["role", "target", "range", "currentPay"],
  counteroffer: ["role", "currentPay", "newOffer", "reason"],
  raise: ["role", "currentPay", "ask", "month", "offer"],
};
export const SCENARIO_ORDER: NegotiateScenario[] = ["screening", "offer", "internship", "counteroffer", "raise"];
export const DEFAULT_SCENARIO: NegotiateScenario = "offer";
export const LEAVE_REASONS: LeaveReason[] = ["money", "growth", "manager", "remote", "other"];
export const isScenario = (v: string | null | undefined): v is NegotiateScenario => !!v && (SCENARIO_ORDER as string[]).includes(v);
export interface NumbersValues {
  role: string;
  low: string;
  high: string;
  target: string;
  /** A listed currency code, or "other" (then `code`). */
  currency: string;
  code: string;
  hasOffer: boolean;
  /** Negotiation v2 fields; text like the others ("" = not given). */
  currentPay: string;
  ask: string;
  newOffer: string;
  reason: LeaveReason | "";
  /** "" or "1".."12". */
  month: string;
}

export const OTHER_CURRENCY = "other";
export const EMPTY_NUMBERS: NumbersValues = { role: "", low: "", high: "", target: "", currency: "USD", code: "", hasOffer: false, currentPay: "", ask: "", newOffer: "", reason: "", month: "" };

type ErrKey =
  | "numbers.err.notNumber" | "numbers.err.notPositive" | "numbers.err.role" | "numbers.err.target"
  | "numbers.err.rangePair" | "numbers.err.rangeOrder" | "numbers.err.targetBelow" | "numbers.err.code"
  | "numbers.err.currentPay" | "numbers.err.ask" | "numbers.err.askBelow" | "numbers.err.newOffer" | "numbers.err.newOfferBelow" | "numbers.err.reason";
export interface NumbersError { key: ErrKey; vars?: { min: string } }
export type NumbersErrors = Partial<Record<NumbersField, NumbersError>>;
export type NumbersHint = "numbers.hint.above" | "numbers.hint.wide" | null;

export interface NumbersCheck {
  errors: NumbersErrors;
  hint: NumbersHint;
  ok: boolean;
  /** Parsed, only when `ok`. */
  parsed?: {
    role: string; low?: number; high?: number; target: number; currency: string; hasOffer: boolean;
    currentPay?: number; ask?: number; newOffer?: number; reason?: LeaveReason; month?: number;
  };
}

export function currencyOf(v: NumbersValues): string {
  return v.currency === OTHER_CURRENCY ? v.code.trim().toUpperCase() : v.currency;
}

export function validateNumbers(v: NumbersValues, opts: { roleRequired?: boolean; scenario?: NegotiateScenario } = {}): NumbersCheck {
  const scenario = opts.scenario ?? DEFAULT_SCENARIO;
  const fields = SCENARIO_FIELDS[scenario];
  const has = (f: ScenarioField) => fields.includes(f);
  const errors: NumbersErrors = {};
  const amount = (raw: string, field: NumbersField) => {
    const r = parseAmount(raw);
    if (!r.ok) { errors[field] = { key: amountErrorKey(r.error) }; return undefined; }
    return r.value;
  };
  if ((opts.roleRequired ?? true) && has("role") && !v.role.trim()) errors.role = { key: "numbers.err.role" };
  let low: number | undefined, high: number | undefined;
  const hasLow = has("range") && v.low.trim() !== "", hasHigh = has("range") && v.high.trim() !== "";
  if (has("range")) {
    low = hasLow ? amount(v.low, "low") : undefined;
    high = hasHigh ? amount(v.high, "high") : undefined;
    if (hasLow !== hasHigh) errors[hasLow ? "high" : "low"] = { key: "numbers.err.rangePair" };
    else if (low !== undefined && high !== undefined && high < low) errors.high = { key: "numbers.err.rangeOrder" };
  }
  let target: number | undefined;
  if (has("target")) {
    if (!v.target.trim()) errors.target = { key: "numbers.err.target" };
    else target = amount(v.target, "target");
    if (target !== undefined && low !== undefined && high !== undefined && !errors.high && target < low) {
      errors.target = { key: "numbers.err.targetBelow", vars: { min: formatAmount(low) } };
    }
  }
  // Current pay: required for the counteroffer and the raise; an optional intern pay.
  let currentPay: number | undefined;
  if (has("currentPay")) {
    if (!v.currentPay.trim()) { if (scenario !== "internship") errors.currentPay = { key: "numbers.err.currentPay" }; }
    else currentPay = amount(v.currentPay, "currentPay");
  }
  let ask: number | undefined;
  if (has("ask")) {
    if (!v.ask.trim()) errors.ask = { key: "numbers.err.ask" };
    else ask = amount(v.ask, "ask");
    if (ask !== undefined && currentPay !== undefined && ask <= currentPay) errors.ask = { key: "numbers.err.askBelow", vars: { min: formatAmount(currentPay) } };
  }
  let newOffer: number | undefined;
  if (has("newOffer")) {
    if (!v.newOffer.trim()) errors.newOffer = { key: "numbers.err.newOffer" };
    else newOffer = amount(v.newOffer, "newOffer");
    if (newOffer !== undefined && currentPay !== undefined && newOffer <= currentPay) errors.newOffer = { key: "numbers.err.newOfferBelow", vars: { min: formatAmount(currentPay) } };
  }
  if (has("reason") && !v.reason) errors.reason = { key: "numbers.err.reason" };
  if (v.currency === OTHER_CURRENCY && !/^[A-Za-z]{3}$/.test(v.code.trim())) errors.code = { key: "numbers.err.code" };

  let hint: NumbersHint = null;
  if (!Object.keys(errors).length && target !== undefined) {
    if (high !== undefined && target > high) hint = "numbers.hint.above";
    else if (low !== undefined && high !== undefined && high > 3 * low) hint = "numbers.hint.wide";
  }
  const ok = Object.keys(errors).length === 0;
  const month = has("month") && v.month ? Number(v.month) : undefined;
  return {
    errors, hint, ok,
    parsed: ok
      ? {
        role: v.role.trim(), low: hasLow ? low : undefined, high: hasHigh ? high : undefined, target: target ?? 0, currency: currencyOf(v),
        hasOffer: has("offer") ? v.hasOffer : false,
        currentPay, ask, newOffer, reason: has("reason") && v.reason ? v.reason : undefined, month,
      }
      : undefined,
  };
}

/** Whether the card can be sent: valid (the disabled Button's rule). */
export function numbersReady(v: NumbersValues, roleRequired: boolean, scenario?: NegotiateScenario): boolean {
  return validateNumbers(v, { roleRequired, scenario }).ok;
}

export function toNegotiateStart(p: NonNullable<NumbersCheck["parsed"]>, style: NegotiateStyle, scenario: NegotiateScenario = DEFAULT_SCENARIO): NegotiateStart {
  const out: NegotiateStart = { scenario, role: p.role, target: p.target, currency: p.currency, style, has_real_offer: p.hasOffer };
  if (p.low !== undefined && p.high !== undefined) { out.job_low = p.low; out.job_high = p.high; }
  if (p.currentPay !== undefined) out.current_pay = p.currentPay;
  if (p.ask !== undefined) out.ask = p.ask;
  if (p.newOffer !== undefined) out.new_offer = p.newOffer;
  if (p.reason) out.leave_reason = p.reason;
  if (p.month !== undefined) out.review_month = p.month;
  // The counteroffer and the raise have no target of their own; the server ignores / derives it.
  if (scenario === "counteroffer") out.target = p.newOffer ?? 0;
  if (scenario === "raise") out.target = p.ask ?? 0;
  return out;
}

export function numbersFromStart(
  n: Pick<NegotiateStart, "role" | "job_low" | "job_high" | "target" | "currency" | "has_real_offer"> & Partial<NegotiateStart>,
  known: string[],
): NumbersValues {
  const listed = known.includes(n.currency);
  const amt = (x: number | undefined) => (x !== undefined ? formatAmount(x) : "");
  const scenario = n.scenario ?? DEFAULT_SCENARIO;
  return {
    role: n.role,
    low: n.job_low !== undefined ? formatAmount(n.job_low) : "",
    high: n.job_high !== undefined ? formatAmount(n.job_high) : "",
    target: SCENARIO_FIELDS[scenario].includes("target") ? formatAmount(n.target) : "",
    currency: listed ? n.currency : OTHER_CURRENCY,
    code: listed ? "" : n.currency,
    hasOffer: n.has_real_offer,
    currentPay: amt(n.current_pay), ask: amt(n.ask), newOffer: amt(n.new_offer),
    reason: n.leave_reason ?? "", month: n.review_month ? String(n.review_month) : "",
  };
}

/** Remembered values (AC6) as a form: the post's range wins over the remembered one when `range` is given. */
export function valuesFromMemory(m: NumbersMemory | null, known: string[], range?: { low: number; high: number; currency: string | null }): NumbersValues {
  const base = { ...EMPTY_NUMBERS };
  if (m) {
    const listed = known.includes(m.currency);
    Object.assign(base, {
      target: formatAmount(m.target),
      currency: listed ? m.currency : OTHER_CURRENCY,
      code: listed ? "" : m.currency,
      hasOffer: m.hasOffer,
    });
    if (m.low !== undefined && m.high !== undefined) { base.low = formatAmount(m.low); base.high = formatAmount(m.high); }
  }
  if (range) {
    base.low = formatAmount(range.low); base.high = formatAmount(range.high);
    if (range.currency) {
      const listed = known.includes(range.currency);
      base.currency = listed ? range.currency : OTHER_CURRENCY;
      base.code = listed ? "" : range.currency;
    }
  }
  return base;
}
