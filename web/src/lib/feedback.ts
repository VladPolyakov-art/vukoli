/* US-60 (D102): the pure rules behind the feedback dialogs. No React, no network. */
import type { FeedbackBody, FeedbackKind } from "./types";

/** The 1st finished session, then every 5th after it (6th, 11th, 16th…). `count` includes the session that just ended. */
export function isAskTurn(count: number): boolean {
  return count === 1 || (count > 1 && (count - 1) % 5 === 0);
}

/** Ask "How did it go?" now: the switch is on, a form service exists, and it is this session's turn. */
export function shouldAskAfterSession(count: number, enabled: boolean, configured = true): boolean {
  return enabled && configured && isAskTurn(count);
}

/** What the person typed in the support form. */
export interface SupportDraft {
  kind: Exclude<FeedbackKind, "session">;
  message: string;
  email: string;
  attach: boolean;
}

/** The support form can send: a message is required. */
export const canSendSupport = (draft: Pick<SupportDraft, "message">): boolean => draft.message.trim().length > 0;

/** The "How did it go?" dialog can send: the rating alone is enough. */
export const canSendRating = (rating: number | null): boolean => rating !== null && rating >= 1 && rating <= 5;

/** The request body for the support form. Metadata goes only when the box is ticked (AC1, AC4). */
export function supportBody(draft: SupportDraft): FeedbackBody {
  const email = draft.email.trim();
  return {
    kind: draft.kind,
    message: draft.message.trim(),
    ...(email ? { email } : {}),
    attach_meta: draft.attach,
  };
}

/** The request body for "How did it go?": the rating and the note, nothing attached. */
export function ratingBody(rating: number, note: string, sessionId?: string): FeedbackBody {
  return { kind: "session", message: note.trim(), rating, attach_meta: false, ...(sessionId ? { session_id: sessionId } : {}) };
}

/** The line shown under the "attach" box: exactly what will be added, or nothing when the box is off. */
export function attachPreview(attach: boolean, appLine: string): string | null {
  return attach && appLine ? appLine : null;
}

/** Copy text (error and "not set up" states): the message, and the app line if the box is ticked. */
export function copyText(draft: Pick<SupportDraft, "message" | "attach">, appLine: string): string {
  const preview = attachPreview(draft.attach, appLine);
  return [draft.message.trim(), preview].filter(Boolean).join("\n\n");
}
