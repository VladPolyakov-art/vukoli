/* Money fields (tough-talk map §2.4, §9 gap 6): the Input has no number mask, so a field keeps what the person typed and
 * calls `parseAmount` on blur, then shows `formatAmount` (thousands separators). Accepts "95000", "95,000", "95 000",
 * "95k", "1.2m" (en-US). A helper, not a component. */

export type AmountError = "notNumber" | "notPositive";
export type AmountResult = { ok: true; value: number } | { ok: false; error: AmountError };

export function parseAmount(raw: string): AmountResult {
  const text = raw.trim().toLowerCase().replace(/[\s,_]/g, "");
  const m = /^(-?\d+(?:\.\d+)?)([km])?$/.exec(text);
  if (!m) return { ok: false, error: "notNumber" };
  const mult = m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1;
  const value = Math.round(Number(m[1]) * mult);
  if (!Number.isFinite(value)) return { ok: false, error: "notNumber" };
  if (value <= 0) return { ok: false, error: "notPositive" };
  return { ok: true, value };
}

/** 95000 -> "95,000". */
export function formatAmount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** On blur: a valid amount comes back formatted, anything else is returned as typed (the error shows beside it). */
export function formatAmountText(raw: string): string {
  const r = parseAmount(raw);
  return r.ok ? formatAmount(r.value) : raw;
}

/** i18n key of the inline error for a parse failure. */
export function amountErrorKey(error: AmountError): "numbers.err.notNumber" | "numbers.err.notPositive" {
  return error === "notNumber" ? "numbers.err.notNumber" : "numbers.err.notPositive";
}
