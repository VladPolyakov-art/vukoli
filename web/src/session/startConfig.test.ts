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
