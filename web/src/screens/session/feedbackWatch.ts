/* When the Session's feedback panel opens by itself, and when its toggle says "ready" (13, QA-01). Pure, so the rules
 * are tested without a browser.
 *
 * The live app never leaves its "quiet" phases (Mike asks, the user answers: by the time a finished thread's feedback
 * arrives Mike is already on the next question), so the old "open when the phase is not quiet" rule never fired. The
 * rules now follow the feedback itself:
 *  - feedback for a finished thread is "ready" once all its records are complete and none is pending;
 *  - on a wide layout the panel opens by itself when ready feedback arrives, except while the user is talking (it opens
 *    when they stop); on mid and narrow layouts a panel would cover the stage, so only a dot on the toggle says it;
 *  - the dot shows on every layout while ready feedback has not been seen with the panel open;
 *  - the user's own close wins: after it, nothing opens by itself until the user opens the panel again.
 * Feedback that is already there when the view appears (a resumed session, a story) counts as seen. */
import type { Thread } from "../../session/reducer";
import type { SessionLayout } from "./useSessionLayout";
import type { SessionPhase } from "./types";

/** Identity of the newest feedback that is ready to read, or null while there is none (nothing yet, still preparing). */
export function readyKey(thread: Thread | null | undefined): string | null {
  if (!thread || !thread.records.length || thread.pendingIds.length) return null;
  if (!thread.records.every((r) => r.complete)) return null;
  return `${thread.key}:${thread.records.length}`;
}

/** Whether ready feedback the user has not seen opens the panel by itself right now. */
export function opensItself(a: { layout: SessionLayout; phase: SessionPhase; suppressed: boolean }): boolean {
  return a.layout === "wide" && !a.suppressed && a.phase !== "listening";
}
