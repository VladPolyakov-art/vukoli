/* D73: a session still being saved after End. The session screen hands its id over and goes Home at once (the server
 * saves and writes the debrief on its own, the socket is not needed); the shell shows a toast until the record and its
 * debrief are on disk. Kept in sessionStorage too, so a reload keeps watching; storage may be unavailable. */
export interface PendingSave { id: string; at: number }

const KEY = "ic.pendingSave";
const listeners = new Set<() => void>();
let current: PendingSave | null = read();

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
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
