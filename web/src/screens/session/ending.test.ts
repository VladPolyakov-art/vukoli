import { describe, expect, it } from "vitest";
import { endingLine } from "./ending";

describe("the line between End and the debrief (D96)", () => {
  it("saving, until the server reports the first answer", () => {
    expect(endingLine({ phase: "saving", feedbackProgress: null })).toBe("Saving your session…");
  });
  it("preparing feedback with the answers done of the total", () => {
    expect(endingLine({ phase: "saving", feedbackProgress: { done: 0, total: 5 } })).toBe("Preparing feedback · 0 of 5 answers");
    expect(endingLine({ phase: "saving", feedbackProgress: { done: 2, total: 5 } })).toBe("Preparing feedback · 2 of 5 answers");
    expect(endingLine({ phase: "saving", feedbackProgress: { done: 0, total: 1 } })).toBe("Preparing feedback · 0 of 1 answer");
  });
  it("then the debrief", () => {
    expect(endingLine({ phase: "debrief_pending", feedbackProgress: { done: 5, total: 5 } })).toBe("Writing your debrief…");
    expect(endingLine({ phase: "done", feedbackProgress: { done: 5, total: 5 } })).toBe("Writing your debrief…");
  });
});
