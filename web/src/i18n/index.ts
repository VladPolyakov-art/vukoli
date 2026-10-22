/* One locale file for every UI string (US-27). Keys are typed from en.json, so a missing key fails typecheck.
 * Usage: t("session.progress", { n: 2, total: 5 }) — "{name}" placeholders are replaced as plain text (no HTML). */
import en from "./en.json";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof en>;
export type Vars = Record<string, string | number>;

const cache = new Map<string, string>();

function lookup(key: string): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let node: unknown = en;
  for (const part of key.split(".")) {
    node = node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
  }
  const value = typeof node === "string" ? node : key;
  cache.set(key, value);
  return value;
}

export function t(key: MessageKey, vars?: Vars): string {
  const template = lookup(key);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Pick "one" or "other" form: keys ending in `_one` / `_other`. */
export function tp(base: string, count: number, vars?: Vars): string {
  const key = `${base}_${count === 1 ? "one" : "other"}` as MessageKey;
  return t(key, { n: count, ...vars });
}

/** Look up a key that comes from data (an error code, a tag) with a fallback when the locale has no entry. */
export function tMaybe(key: string, fallback: string, vars?: Vars): string {
  const template = lookup(key);
  if (template === key) return fallback;
  return vars ? t(key as MessageKey, vars) : template;
}
