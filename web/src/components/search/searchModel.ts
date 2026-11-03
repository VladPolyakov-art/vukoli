/* Pure logic of the search dialog (D105): which keys do what, where a result opens, how the matched words are marked.
 * No React, no network: the dialog and its tests share it. The words and the "at least 2 characters" rule are the
 * server's (server/search.py), so the page does not ask for what the server would answer with nothing. */
import type { SearchResult } from "../../lib/types";

/** A query shorter than this is not sent (the server answers [] to it anyway). */
export const MIN_QUERY = 2;
/** The pause after the last key before the question goes to the server. A behaviour timer, not motion. */
export const DEBOUNCE_MS = 150;

export const queryWords = (query: string): string[] => {
  const out: string[] = [];
  for (const w of query.toLowerCase().split(/\s+/)) if (w && !out.includes(w)) out.push(w);
  return out.slice(0, 8);
};

export const canSearch = (query: string): boolean => query.trim().length >= MIN_QUERY;

/** Where a result opens: its Debrief, on the question the hit is in (`?q=n`) when it is in a question or an answer. */
export function resultPath(r: Pick<SearchResult, "id" | "match">): string {
  const base = `/sessions/${encodeURIComponent(r.id)}`;
  const inTalk = r.match.field === "question" || r.match.field === "answer";
  return inTalk && r.match.q && r.match.q > 0 ? `${base}?q=${r.match.q}` : base;
}

/** ↑ / ↓ move the highlighted row and wrap round; with no rows there is nothing to move. */
export function moveActive(current: number, key: "ArrowUp" | "ArrowDown", count: number): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return key === "ArrowDown" ? 0 : count - 1;
  return key === "ArrowDown" ? (current + 1) % count : (current - 1 + count) % count;
}

/** What a key does in the dialog: move, open the highlighted row, or nothing (the input keeps it). */
export type SearchKey = { do: "move"; key: "ArrowUp" | "ArrowDown" } | { do: "open" } | null;
export function searchKey(e: { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean }, count: number): SearchKey {
  if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return null;     // an IME is choosing a word: Enter is its own
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && count > 0) return { do: "move", key: e.key };
  if (e.key === "Enter" && !e.shiftKey && count > 0) return { do: "open" };
  return null;
}

/** The keep-the-highlight rule when new results arrive: the first row, unless the same session is still listed. */
export function activeAfter(prev: SearchResult[], prevActive: number, next: SearchResult[]): number {
  if (!next.length) return -1;
  const id = prev[prevActive]?.id;
  const same = id ? next.findIndex((r) => r.id === id) : -1;
  return same >= 0 ? same : 0;
}

export interface Part { text: string; hit: boolean }
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The text as parts, the words of the query marked (any case, as a part of a word, the longest word first). */
export function highlightParts(text: string, query: string): Part[] {
  const words = queryWords(query).sort((a, b) => b.length - a.length);
  if (!text) return [];
  if (!words.length) return [{ text, hit: false }];
  const re = new RegExp(`(${words.map(escape).join("|")})`, "giu");
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

/** ⌘K on a Mac, Ctrl+K elsewhere (⌘ is not a modifier of a PC keyboard, and Ctrl+K is "cut to end of line" on a Mac). */
export const isMac = (platform: string = typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent): boolean => /mac|iphone|ipad/i.test(platform);

export function isSearchShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; repeat?: boolean }, mac = isMac()): boolean {
  if (e.altKey || e.shiftKey || e.repeat) return false;
  return e.key.toLowerCase() === "k" && (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey);
}
