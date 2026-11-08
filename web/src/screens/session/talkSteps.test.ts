import { describe, expect, it } from "vitest";
import { talkStepsModel } from "./talkSteps";

describe("talkStepsModel", () => {
  it("is hidden when no step arrived or the step is out of range", () => {
    expect(talkStepsModel(null, "offer")).toBeNull();
    expect(talkStepsModel(undefined, "offer")).toBeNull();
    expect(talkStepsModel(0, "offer")).toBeNull();
    expect(talkStepsModel(6, "offer")).toBeNull();
  });

  it("offer family labels, with done / current / todo states", () => {
    const m = talkStepsModel(3, "offer")!;
    expect(m.steps.map((x) => x.label)).toEqual(["Number", "Reason", "Objection", "Trade", "Writing"]);
    expect(m.steps.map((x) => x.state)).toEqual(["done", "done", "current", "todo", "todo"]);
    expect(m.summary).toBe("Step 3 of 5: Objection");
  });

  it("raise family has its own labels; other scenarios use the offer labels", () => {
    expect(talkStepsModel(1, "raise")!.steps.map((x) => x.label)).toEqual(["Results", "Number", "Not now → date", "Trade", "Writing"]);
    for (const sc of ["screening", "internship", "counteroffer", null] as const) expect(talkStepsModel(1, sc)!.steps[0]!.label).toBe("Number");
  });
});
