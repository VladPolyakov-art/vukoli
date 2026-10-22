import { describe, expect, it } from "vitest";
import type { FeedbackRecord } from "../lib/types";
import { editTargets, heardEdit, recheckEdits } from "./recheck";

function rec(id: string, kind: FeedbackRecord["answer_kind"], answer: string, extra: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return { id, turn_id: 1, question: "", question_id: "q1", competency: "B", answer_kind: kind, answer, source: "voice", complete: true, layers: {}, ...extra };
}

const main = rec("fb-1", "main", "Last year we has redesigned the onboarding.");
const follow1 = rec("fb-2", "follow_up", "It cut churn by ten percent.");
const follow2 = rec("fb-3", "follow_up", "Twelve users took part.");

describe("recheckEdits", () => {
  it("targets the main answer and the thread's last follow-up", () => {
    expect(editTargets([main, follow1, follow2])).toEqual({ main, follow: follow2 });
    expect(editTargets([follow1])).toEqual({ main: follow1, follow: undefined });
    expect(editTargets([])).toEqual({ main: undefined, follow: undefined });
  });

  it("sends only the answers that really changed (spacing does not count)", () => {
    const all = [main, follow1];
    expect(recheckEdits(all, "Last year we has  redesigned the onboarding. ", "It cut churn by ten percent.")).toEqual([]);
    expect(recheckEdits(all, "Last year we redesigned the onboarding.", follow1.answer)).toEqual([
      { feedbackId: "fb-1", text: "Last year we redesigned the onboarding." },
    ]);
    expect(recheckEdits(all, main.answer, " It cut churn by 10 percent. ")).toEqual([
      { feedbackId: "fb-2", text: "It cut churn by 10 percent." },
    ]);
    expect(recheckEdits(all, "Changed main answer here.", "Changed follow-up answer.")).toHaveLength(2);
  });

  it("never sends an emptied field, and ignores a follow-up field when the thread has no follow-up", () => {
    expect(recheckEdits([main, follow1], "  ", "")).toEqual([]);
    expect(recheckEdits([main], "Changed main answer here.", "stray")).toEqual([{ feedbackId: "fb-1", text: "Changed main answer here." }]);
  });

  it("an English turn is one record", () => {
    const turn = rec("fb-9", "turn", "I work on the roadmap for our payments team.");
    expect(recheckEdits([turn], "I work on the roadmap for our payment team.")).toEqual([
      { feedbackId: "fb-9", text: "I work on the roadmap for our payment team." },
    ]);
  });
});

describe("heardEdit", () => {
  const withFlag = rec("fb-1", "main", "we has redesigned it", {
    layers: { language: { layer: "language", status: "fix", items: [{ id: "f1", original: "we has redesigned", heard_as: "we has redesigned", better: ["we redesigned"], status: "dismissed" }] } as never },
  });
  it("is the typed words against the heard fragment", () => {
    expect(heardEdit(withFlag, "f1", " we had redesigned ")).toEqual({ feedbackId: "fb-1", text: "we had redesigned", flagId: "f1" });
  });
  it("is nothing when the words are the same, empty or the correction is unknown", () => {
    expect(heardEdit(withFlag, "f1", "we  has redesigned")).toBeNull();
    expect(heardEdit(withFlag, "f1", "  ")).toBeNull();
    expect(heardEdit(withFlag, "nope", "something else")).toBeNull();
    expect(heardEdit(undefined, "f1", "x")).toBeNull();
  });
});
