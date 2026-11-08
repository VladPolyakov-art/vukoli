/* What Home remembers for the tough-talk practices (US-63 AC6, US-64 AC2): the last style, and the last numbers per
 * job (else the last ones used). Browser storage only; every access is guarded (private windows, blocked storage). */
import type { NegotiateStyle } from "../../lib/types";
import type { NumbersMemory } from "./types";

const STYLE_KEY = "vukoli.negotiate.style";
const NUMBERS_KEY = "vukoli.negotiate.numbers";
const STYLES: NegotiateStyle[] = ["friendly", "firm", "tight", "surprise"];

interface Stored { last: NumbersMemory | null; byJob: Record<string, NumbersMemory> }

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: nothing is remembered */ }
}

export const talkPrefs = {
  lastStyle(): NegotiateStyle | null {
    const v = read<string>(STYLE_KEY);
    return STYLES.includes(v as NegotiateStyle) ? (v as NegotiateStyle) : null;
  },
  numbers(): Stored {
    const s = read<Stored>(NUMBERS_KEY);
    return s && typeof s === "object" ? { last: s.last ?? null, byJob: s.byJob ?? {} } : { last: null, byJob: {} };
  },
  rememberStyle(style: NegotiateStyle) { write(STYLE_KEY, style); },
  remember(style: NegotiateStyle, jobId: string | null, n: NumbersMemory) {
    write(STYLE_KEY, style);
    const s = talkPrefs.numbers();
    s.last = n;
    if (jobId) s.byJob[jobId] = n;
    write(NUMBERS_KEY, s);
  },
};
