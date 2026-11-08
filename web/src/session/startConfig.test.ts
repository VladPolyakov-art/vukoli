import { describe, expect, it } from "vitest";
import { buildSessionConfig } from "./startConfig";

const FOCUS = [{ layer: "content", tag: "we_not_i" }, { layer: "delivery", tag: "filler_high" }] as const;

describe("buildSessionConfig: a drill's focus (C1b)", () => {
  it("sends the focus with a drill", () => {
    const { start } = buildSessionConfig({ mode: "interview", answer: "text", drill: true, focus: [...FOCUS] }, null, null);
    expect(start).toMatchObject({ drill: true, focus: [...FOCUS] });
  });

  it("sends no focus without a drill, or when the plan has none (an old start works as before)", () => {
    expect(buildSessionConfig({ mode: "interview", answer: "text", focus: [...FOCUS] }, null, null).start.focus).toBeUndefined();
    expect(buildSessionConfig({ mode: "interview", answer: "text", drill: true }, null, null).start.focus).toBeUndefined();
    expect(buildSessionConfig({ mode: "interview", answer: "text", drill: true, focus: [] }, null, null).start.focus).toBeUndefined();
  });

  it("sends at most six spots", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ layer: "content" as const, tag: `t${i}` }));
    expect(buildSessionConfig({ mode: "interview", answer: "text", drill: true, focus: many }, null, null).start.focus).toHaveLength(6);
  });
});

describe("buildSessionConfig: quick start (D111)", () => {
  it("sends mode quick with the interview defaults and leaves the job and the plan to the server", () => {
    const { start } = buildSessionConfig({ mode: "quick", answer: "text" }, null, null);
    expect(start).toMatchObject({ type: "start", mode: "quick", input: "text", speak: false, round_type: "mix", strictness: 2, questions: 5 });
    expect(start.vacancy_id).toBeUndefined();
    expect(start.drill).toBeUndefined();
    expect(start.level).toBeUndefined();
  });

  it("an ordinary start still names its mode", () => {
    expect(buildSessionConfig({ mode: "interview", answer: "text" }, null, null).start.mode).toBe("interview");
    expect(buildSessionConfig({ mode: "english", answer: "text" }, null, null).start.mode).toBe("english");
  });
});

describe("buildSessionConfig: negotiate prep (D118)", () => {
  const base = { scenario: "offer", role: "Product Designer", target: 62000, currency: "EUR", style: "firm", has_real_offer: false } as const;

  it("carries negotiate.prep exactly as the plan has it", () => {
    const prep = { course: true, results: ["Cut onboarding drop-off by a third"], reason: "Market range", fallbacks: ["step_up", "sign_on"] };
    const { start } = buildSessionConfig({ mode: "negotiate", answer: "text", negotiate: { ...base, prep } }, null, null);
    expect(start.negotiate).toMatchObject({ prep });
  });

  it("sends no prep key when the person did not prepare", () => {
    const { start } = buildSessionConfig({ mode: "negotiate", answer: "text", negotiate: { ...base } }, null, null);
    expect(start.negotiate && "prep" in start.negotiate).toBe(false);
  });
});
