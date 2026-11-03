/* D108: text the user typed into a dialog survives closing it by accident (a click on the dimmed area, Esc), for the rest
 * of the app session. Memory only: nothing is written to disk or to storage, a reload starts clean (the text can be a
 * private job description or feedback). A dialog reads its draft when it opens, writes on every change, and clears it
 * when the text has been sent or saved (or the user discards it on purpose). */
const store = new Map<string, unknown>();

export const drafts = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): void {
    store.set(key, value);
  },
  clear(key: string): void {
    store.delete(key);
  },
};
