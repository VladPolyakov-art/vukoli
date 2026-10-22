/* "Edit what I said" (US-18 AC3), the pure part: which answers of a thread the editor shows, and which of them the
 * user really changed (only those are sent to be checked again). No I/O; unit-tested in recheck.test.ts. */
import type { FeedbackRecord } from "../lib/types";

export interface RecheckEdit { feedbackId: string; text: string; flagId?: string }

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** The answer the editor starts from and the follow-up answer it can also change (the thread's last follow-up). */
export function editTargets(records: FeedbackRecord[]): { main?: FeedbackRecord; follow?: FeedbackRecord } {
  const main = records.find((r) => r.answer_kind !== "follow_up") ?? records[0];
  const follow = [...records].reverse().find((r) => r.answer_kind === "follow_up" && r !== main);
  return { main, follow };
}

/** Only changed answers: an untouched field costs no model request. */
export function recheckEdits(records: FeedbackRecord[], answer: string, followUp?: string): RecheckEdit[] {
  const { main, follow } = editTargets(records);
  const edits: RecheckEdit[] = [];
  if (main && squash(answer) && squash(answer) !== squash(main.answer)) edits.push({ feedbackId: main.id, text: answer.trim() });
  if (follow && followUp !== undefined && squash(followUp) && squash(followUp) !== squash(follow.answer)) {
    edits.push({ feedbackId: follow.id, text: followUp.trim() });
  }
  return edits;
}

/** "No, I said…" on one correction: what the user typed against the fragment the recogniser heard; null = nothing to
 * check (empty, or the same words). */
export function heardEdit(record: FeedbackRecord | undefined, flagId: string, said: string): RecheckEdit | null {
  const item = record?.layers.language?.items?.find((i) => i.id === flagId);
  const heard = squash(item?.heard_as || item?.original || "");
  if (!record || !item || !squash(said) || squash(said) === heard) return null;
  return { feedbackId: record.id, text: said.trim(), flagId };
}
