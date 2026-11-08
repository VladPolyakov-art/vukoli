/* The weak spots of ONE saved interview, as Home's drill plan needs them (C1). The debrief's "What to work on" lists
 * one weak spot per layer (the first of each layer, in the order the server saved them); "Drill these weak spots" in
 * that debrief works on exactly those, not on the shared memory of the last interviews. */
import { tMaybe } from "../../i18n";
import { interviewDebrief, type SessionRecord } from "../../lib/types";
import type { WeakItem } from "./types";

/** A weak spot's name inside a sentence: only a plain capitalised first word loses its capital ("No result" → "no
 *  result"). "I", "I'm", acronyms ("CV") and names keep theirs, so `Say "I", not "we"` becomes `say "I", not "we"`,
 *  never `say "i", not "we"`. Nothing after the first word is touched. */
export function lowerFirstWord(text: string): string {
  const [first = ""] = text.split(/\s/, 1);
  return /^[A-Z][a-z]+$/.test(first) ? first.toLowerCase() + text.slice(first.length) : text;
}

export function weakFromSession(record: Pick<SessionRecord, "debrief"> | null | undefined): WeakItem[] {
  const out: WeakItem[] = [];
  for (const w of interviewDebrief(record?.debrief)?.weak_spots ?? []) {
    if (!w.tag || out.some((o) => o.layer === w.layer)) continue;
    const title = tMaybe(`feedback.tag.${w.tag}`, w.text || w.tag.replace(/_/g, " "));
    const short = lowerFirstWord(title);
    out.push({ id: `${w.layer}-${w.tag}`, tag: w.tag, layer: w.layer, title, short, phrase: short, count: "" });
  }
  return out;
}
