/* The negotiate numbers card (tough-talk.md §2.4, US-63): the form's values as typed, and the pure validation.
 * Fields keep text; `validateNumbers` parses it with lib/amount and returns i18n keys, so the card, the plan's
 * "Change your numbers" dialog and the tests all agree. */
import { formatAmount, parseAmount, amountErrorKey } from "../../lib/amount";
import type { NegotiateStart, NegotiateStyle } from "../../lib/types";
import type { NumbersMemory } from "./types";

export type NumbersField = "role" | "low" | "high" | "target" | "code";
export interface NumbersValues {
  role: string;
  low: string;
  high: string;
  target: string;
  /** A listed currency code, or "other" (then `code`). */
  currency: string;
  code: string;
  hasOffer: boolean;
}

export const OTHER_CURRENCY = "other";
export const EMPTY_NUMBERS: NumbersValues = { role: "", low: "", high: "", target: "", currency: "USD", code: "", hasOffer: false };

type ErrKey =
  | "numbers.err.notNumber" | "numbers.err.notPositive" | "numbers.err.role" | "numbers.err.target"
  | "numbers.err.rangePair" | "numbers.err.rangeOrder" | "numbers.err.targetBelow" | "numbers.err.code";
export interface NumbersError { key: ErrKey; vars?: { min: string } }
export type NumbersErrors = Partial<Record<NumbersField, NumbersError>>;
export type NumbersHint = "numbers.hint.above" | "numbers.hint.wide" | null;

export interface NumbersCheck {
  errors: NumbersErrors;
  hint: NumbersHint;
  ok: boolean;
  /** Parsed, only when `ok`. */
  parsed?: { role: string; low?: number; high?: number; target: number; currency: string; hasOffer: boolean };
}

export function currencyOf(v: NumbersValues): string {
  return v.currency === OTHER_CURRENCY ? v.code.trim().toUpperCase() : v.currency;
}

export function validateNumbers(v: NumbersValues, opts: { roleRequired: boolean } = { roleRequired: true }): NumbersCheck {
  const errors: NumbersErrors = {};
  const amount = (raw: string, field: "low" | "high" | "target") => {
    const r = parseAmount(raw);
    if (!r.ok) { errors[field] = { key: amountErrorKey(r.error) }; return undefined; }
    return r.value;
  };
  if (opts.roleRequired && !v.role.trim()) errors.role = { key: "numbers.err.role" };
  const hasLow = v.low.trim() !== "", hasHigh = v.high.trim() !== "";
  const low = hasLow ? amount(v.low, "low") : undefined;
  const high = hasHigh ? amount(v.high, "high") : undefined;
  if (hasLow !== hasHigh) errors[hasLow ? "high" : "low"] = { key: "numbers.err.rangePair" };
  else if (low !== undefined && high !== undefined && high < low) errors.high = { key: "numbers.err.rangeOrder" };
  let target: number | undefined;
  if (!v.target.trim()) errors.target = { key: "numbers.err.target" };
  else target = amount(v.target, "target");
  if (target !== undefined && low !== undefined && high !== undefined && !errors.high && target < low) {
    errors.target = { key: "numbers.err.targetBelow", vars: { min: formatAmount(low) } };
  }
  if (v.currency === OTHER_CURRENCY && !/^[A-Za-z]{3}$/.test(v.code.trim())) errors.code = { key: "numbers.err.code" };

  let hint: NumbersHint = null;
  if (!Object.keys(errors).length && target !== undefined) {
    if (high !== undefined && target > high) hint = "numbers.hint.above";
    else if (low !== undefined && high !== undefined && high > 3 * low) hint = "numbers.hint.wide";
  }
  const ok = Object.keys(errors).length === 0;
  return {
    errors, hint, ok,
    parsed: ok && target !== undefined
      ? { role: v.role.trim(), low: hasLow ? low : undefined, high: hasHigh ? high : undefined, target, currency: currencyOf(v), hasOffer: v.hasOffer }
      : undefined,
  };
}

/** Whether the card can be sent: valid (the disabled Button's rule). */
export function numbersReady(v: NumbersValues, roleRequired: boolean): boolean {
  return validateNumbers(v, { roleRequired }).ok;
}

export function toNegotiateStart(p: NonNullable<NumbersCheck["parsed"]>, style: NegotiateStyle): NegotiateStart {
  const out: NegotiateStart = { role: p.role, target: p.target, currency: p.currency, style, has_real_offer: p.hasOffer };
  if (p.low !== undefined && p.high !== undefined) { out.job_low = p.low; out.job_high = p.high; }
  return out;
}

export function numbersFromStart(n: Pick<NegotiateStart, "role" | "job_low" | "job_high" | "target" | "currency" | "has_real_offer">, known: string[]): NumbersValues {
  const listed = known.includes(n.currency);
  return {
    role: n.role,
    low: n.job_low !== undefined ? formatAmount(n.job_low) : "",
    high: n.job_high !== undefined ? formatAmount(n.job_high) : "",
    target: formatAmount(n.target),
    currency: listed ? n.currency : OTHER_CURRENCY,
    code: listed ? "" : n.currency,
    hasOffer: n.has_real_offer,
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
