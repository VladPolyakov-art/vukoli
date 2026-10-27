import { describe, expect, it } from "vitest";
import { SCORE_ORDER } from "./mapRecord";
import { exampleSam, interviewS2 } from "./fixtures";

/* D98: the fixtures hold the same shapes as the server and follow the rubric (§9.1): a whole score 1–5, rows in the
 * fixed order, links only to questions that exist, and no lost points on a row that was not asked or scored 5. */
describe.each([["interviewS2", interviewS2], ["exampleSam", exampleSam]])("%s scorecard", (_name, model) => {
  const rows = model.scorecard!;
  it("has the seven rows in the fixed order", () => {
    expect(rows.map((r) => r.key)).toEqual(SCORE_ORDER);
  });
  it("scores are whole numbers 1–5 or null", () => {
    for (const r of rows) expect(r.score === null || (Number.isInteger(r.score) && r.score >= 1 && r.score <= 5)).toBe(true);
  });
  it("a row not asked has no answers and no lost points; a 5 lists none", () => {
    for (const r of rows) {
      if (r.score === null) expect([r.answers, r.lost.length]).toEqual([0, 0]);
      if (r.score === 5) expect(r.lost).toEqual([]);
      else if (r.score !== null) expect(r.lost.length).toBeGreaterThan(0);
    }
  });
  it("lost points point at questions that exist", () => {
    const n = new Set(model.questions.map((q) => q.n));
    for (const r of rows) for (const q of r.lost) expect(n.has(q)).toBe(true);
  });
  it("the plan has one step per weak spot and the drill on the first", () => {
    expect(model.plan).toHaveLength(model.weakSpots.length);
    expect(model.plan!.map((p) => p.drill)).toEqual([true, false, false]);
    expect(model.plan!.map((p) => p.layer)).toEqual(model.weakSpots.map((w) => w.layer));
  });
});
