import { describe, expect, it } from "vitest";
import { CTX_ENGLISH, CTX_FIRST, CTX_RETURNING } from "./fixtures";
import { quickStartFor } from "./quickStart";

describe("quick start (D51 item 1)", () => {
  it("repeats the last interview for a returning user", () => {
    const q = quickStartFor(CTX_RETURNING, false)!;
    expect(q).toMatchObject({ jobId: CTX_RETURNING.last!.jobId, round: "behavioural", roundType: "behavioural", strictness: 2, questions: 5, answer: "voice" });
    expect(q.detail).toBe("Kestrel Pay · Behavioural · 5 questions · voice");
  });

  it("starts general questions, the unseen mix, default strictness on a first visit", () => {
    const q = quickStartFor({ ...CTX_FIRST, strictness: 3, questions: 1 }, true)!;
    expect(q).toMatchObject({ jobId: null, round: "mix", roundType: "mix", strictness: 3, questions: 1, answer: "text" });
    expect(q.detail).toBe("General questions · Unseen mix · 1 question · typing");
  });

  it("falls back to general questions when the remembered job is gone, and sends technical as the mix", () => {
    const q = quickStartFor({ ...CTX_RETURNING, last: { ...CTX_RETURNING.last!, jobId: "deleted", round: "technical" } }, false)!;
    expect(q.jobId).toBeNull();
    expect(q.round).toBe("technical");
    expect(q.roundType).toBe("mix");
    expect(q.detail.startsWith("General questions · Technical")).toBe(true);
  });

  it("is not offered on the English track", () => {
    expect(quickStartFor(CTX_ENGLISH, false)).toBeNull();
  });
});
