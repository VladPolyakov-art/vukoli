import { describe, expect, it } from "vitest";
import type { ScoreKey } from "../../lib/types";
import { SCORE_ORDER } from "./mapRecord";
import { exampleSam, interviewLong, interviewS2 } from "./fixtures";
import { verdictFromRows, verdictStep } from "./verdictStep";
import casesJson from "../../../../server/tests/verdict_step_cases.json?raw";

/* D99: one rule, two implementations (server `debrief_view.verdict_step`, this file's subject). The cases are the
 * server's: server/tests/verdict_step_cases.json. */
interface Case { name: string; scores: Partial<Record<ScoreKey, number>>; step: { value: number; gap: string[]; target: number | null } | null }
const cases = (JSON.parse(casesJson) as { cases: Case[] }).cases;
const rowsOf = (scores: Case["scores"]) => SCORE_ORDER.map((key) => ({ key, score: scores[key] ?? null }));

describe("verdictStep: the shared cases", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const got = verdictStep(rowsOf(c.scores));
    expect(got === undefined ? null : got).toEqual(c.step === null ? null : { value: c.step.value, gap: c.step.gap, target: c.step.target });
  });
  it("has the cases the rule needs", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(new Set(cases.map((c) => c.step?.value))).toEqual(new Set([0, 1, 2, undefined]));
  });
  it("no rows, no step", () => {
    expect(verdictStep(undefined)).toBeUndefined();
    expect(verdictStep([])).toBeUndefined();
  });
});

describe("the example debriefs follow the rule given their own scorecard", () => {
  it("interviewS2 and interviewLong: Getting there, gap lowest first (Lessons learned, Structure, Result, Delivery)", () => {
    for (const m of [interviewS2, interviewLong]) {
      expect(m.verdict).toMatchObject({ step: 1, headline: "Getting there", target: 4, gap: ["reflection", "structure", "result", "delivery"] });
    }
  });
  it("exampleSam: Getting there, gap Your part", () => {
    expect(exampleSam.verdict).toMatchObject({ step: 1, headline: "Getting there", target: 4, gap: ["own_part"] });
    expect(exampleSam.verdict?.line).toBe("Strong on the why, but 3 answers skip the decision you made yourself.");
  });
  it("every fixture verdict equals what the rule gives for its scorecard", () => {
    for (const m of [interviewS2, interviewLong, exampleSam]) {
      expect(m.verdict).toEqual(verdictFromRows(m.scorecard!, m.verdict!.line!, m.verdict!.strength));
    }
  });
});
