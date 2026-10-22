/* Home's own per-browser choices. The round type has four values here (US-12 AC1); lib/prefs only knows three, so this
 * reads and writes the same key with the wider type. Storage can throw (private windows): every access is wrapped. */
import type { RoundType } from "./types";

const KEY = "ic.roundType";

const ROUNDS: RoundType[] = ["hr", "behavioural", "technical", "mix"];

export const homePrefs = {
  round(): RoundType {
    try {
      const v = window.localStorage.getItem(KEY);
      return ROUNDS.find((r) => r === v) ?? "mix";
    } catch {
      return "mix";
    }
  },
  setRound(v: RoundType) {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  },
};

/** "Oct 18" (the year only matters in History). */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
