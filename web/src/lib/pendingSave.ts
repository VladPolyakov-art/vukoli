/* D73 / D96-after: sessions still being saved after End. The session screen hands its id over and goes Home at once
 * (the server saves and writes the debrief on its own, the socket is not needed). The shell shows each of them as a row
 * at the top of Recents with a loading state (no "Saving…" toast) until the record and its debrief are on disk, then
 * one "ready" toast. Several can run at once: starting a new practice never inherits anything of an older one.
 * Kept in sessionStorage too, so a reload keeps watching; storage may be unavailable. */
export interface PendingSave {
  id: string;
  at: number;
  /** What the row says until the server's own title arrives (Recents lists the saved record under its real name). */
  title?: string;
  track?: "interview" | "english";
}
/** D96: where the server's work after the call stands (answers done of the total; the debrief comes last). The shell
 * polls the record and hands it over here, so the row can say "2 of 5". */
export interface SaveProgress { done: number; total: number; stage: "feedback" | "debrief" }

const KEY = "ic.pendingSave";
/** More than this many at once is not a real case; the oldest simply stop being watched. */
const MAX = 5;
const listeners = new Set<() => void>();
let list: readonly PendingSave[] = read();
let progress: Readonly<Record<string, SaveProgress>> = {};

function valid(value: unknown): value is PendingSave {
  const v = value as PendingSave | null;
  return !!v && typeof v.id === "string" && typeof v.at === "number";
}

function read(): readonly PendingSave[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // An older build kept one object; accept it as a list of one.
    const items = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    return items.filter(valid).slice(-MAX);
  } catch {
    return [];
  }
}

function without(map: Readonly<Record<string, SaveProgress>>, id: string): Readonly<Record<string, SaveProgress>> {
  return Object.fromEntries(Object.entries(map).filter(([key]) => key !== id));
}

function write(next: readonly PendingSave[]) {
  list = next;
  try {
    if (next.length) window.sessionStorage.setItem(KEY, JSON.stringify(next));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* in-memory only */
  }
  listeners.forEach((fn) => fn());
}

export const pendingSave = {
  /** Oldest first; the same array until something changes (for useSyncExternalStore). */
  getAll: (): readonly PendingSave[] => list,
  /** Starts watching a session. Starting the same id again keeps its first time. */
  start(id: string, meta: Pick<PendingSave, "title" | "track"> = {}) {
    if (list.some((x) => x.id === id)) return;
    write([...list, { id, at: Date.now(), ...meta }].slice(-MAX));
  },
  clear(id: string) {
    if (!list.some((x) => x.id === id)) return;
    if (id in progress) progress = without(progress, id);
    write(list.filter((x) => x.id !== id));
  },
  /** Every session's numbers by id; the same object until something changes. */
  getProgress: (): Readonly<Record<string, SaveProgress>> => progress,
  /** Same numbers again keep the same object, so subscribers do not render for nothing. */
  setProgress(id: string, next: SaveProgress | null) {
    if (!list.some((x) => x.id === id)) return;
    const prev = progress[id];
    if (next && prev && next.done === prev.done && next.total === prev.total && next.stage === prev.stage) return;
    if (!next && !prev) return;
    progress = next ? { ...progress, [id]: next } : without(progress, id);
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
