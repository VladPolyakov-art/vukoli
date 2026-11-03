/* US-60 (D102): which feedback dialog is open. The support form opens from the account menu and from Settings → About;
 * the "How did it go?" ask opens after End, from the session screen that is already leaving, so both live in one small
 * store the shell watches (like lib/pendingSave). `onceClosed` lets a toast wait until the dialog is gone (a toast shown
 * while a modal is open is carried inside it and lost when it closes). */
export type FeedbackDialog = { kind: "support" } | { kind: "session"; sessionId: string };

let current: FeedbackDialog | null = null;
const listeners = new Set<() => void>();
const waiting: Array<() => void> = [];
/** An ask may open any moment (the session was just ended, the server is still counting it): a toast waits for it too. */
let pending = false;
let pendingTimer = 0;

const modals = () => (typeof document === "undefined" ? 0 : document.querySelectorAll("dialog:modal").length);

/** Runs the waiting toasts. A toast shown while a modal is open goes inside that modal (ds/Toast), so after a close they
 * wait until the dialog is really gone from the top layer (the Dialog closes it in an effect, a moment after the store
 * changes); otherwise the toast would be carried into the dialog and vanish with it. */
function flush(afterClose = false) {
  if (current || pending) return;
  const run = () => { if (!current && !pending) waiting.splice(0).forEach((fn) => fn()); };
  const open = modals();
  if (!afterClose || open === 0) { run(); return; }
  let tries = 0;
  const poll = () => {
    if (modals() < open || tries++ > 50) run();
    else window.setTimeout(poll, 20);
  };
  poll();
}

function set(next: FeedbackDialog | null) {
  current = next;
  listeners.forEach((fn) => fn());
  flush(!next);
}

export const feedbackUi = {
  get: (): FeedbackDialog | null => current,
  openSupport: () => set({ kind: "support" }),
  /** The ask replaces nothing: if the support form is already open the ask is skipped by the caller. */
  openSession: (sessionId: string) => {
    // The dialog takes the place of the hold in one step: releasing first would let a waiting toast out just before it opens.
    pending = false;
    window.clearTimeout(pendingTimer);
    set({ kind: "session", sessionId });
  },
  close: () => set(null),
  /** The user just ended a session and the server is deciding whether to ask: toasts wait until `openSession` or
   * `release` (no ask, or the call failed; a few seconds at most). Without this a quick debrief shows its toast first
   * and the dialog that opens a moment later covers it until it has expired. */
  hold() {
    pending = true;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => feedbackUi.release(), 5000);
  },
  release() {
    pending = false;
    window.clearTimeout(pendingTimer);
    flush();
  },
  /** Runs `fn` now when no feedback dialog is open (or about to open), otherwise right after it closes. */
  onceClosed(fn: () => void) {
    if (!current && !pending) fn();
    else waiting.push(fn);
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
