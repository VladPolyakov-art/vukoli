/* D73: a session still being saved after End. The session screen hands its id over and goes Home at once (the server
 * saves and writes the debrief on its own, the socket is not needed); the shell shows a toast until the record and its
 * debrief are on disk. Kept in sessionStorage too, so a reload keeps watching; storage may be unavailable. */
export interface PendingSave { id: string; at: number }
/** D96: where the server's work after the call stands (answers done of the total; the debrief comes last). The shell
 * polls the record and hands it over here, so the toast can say "Preparing feedback · 2 of 5 answers". */
export interface SaveProgress { done: number; total: number; stage: "feedback" | "debrief" }

const KEY = "ic.pendingSave";
const listeners = new Set<() => void>();
let current: PendingSave | null = read();
let progress: SaveProgress | null = null;

function read(): PendingSave | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as PendingSave) : null;
    return value && typeof value.id === "string" && typeof value.at === "number" ? value : null;
  } catch {
    return null;
  }
}

function write(value: PendingSave | null) {
  current = value;
  progress = null;
  try {
    if (value) window.sessionStorage.setItem(KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* in-memory only */
  }
  listeners.forEach((fn) => fn());
}

export const pendingSave = {
  get: (): PendingSave | null => current,
  start: (id: string) => write({ id, at: Date.now() }),
  clear: (id: string) => { if (current?.id === id) write(null); },
  getProgress: (): SaveProgress | null => progress,
  /** Same numbers again keep the same object, so subscribers do not render for nothing. */
  setProgress(id: string, next: SaveProgress | null) {
    if (current?.id !== id) return;
    if (next && progress && next.done === progress.done && next.total === progress.total && next.stage === progress.stage) return;
    if (!next && !progress) return;
    progress = next;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
