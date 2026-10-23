/* What the screen says between End and the debrief when the user stays on it (no answer to save, or storage trouble
 * leaves them here). D96: the feedback is made after End, so the line is "Preparing feedback · 2 of 5 answers" until the
 * debrief itself is being written. Pure, tested in ending.test.ts. */
import { t, tp } from "../../i18n";
import type { SessionState } from "../../session/reducer";

export function endingLine(state: Pick<SessionState, "phase" | "feedbackProgress">): string {
  if (state.phase === "debrief_pending" || state.phase === "done") return t("session.debriefPending");
  if (state.feedbackProgress) return tp("session.afterEnd.preparing", state.feedbackProgress.total, { done: state.feedbackProgress.done });
  return t("session.saving");
}
