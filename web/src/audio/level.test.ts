import { describe, expect, it } from "vitest";
import { micLevel } from "./level";

describe("micLevel", () => {
  it("is 0 for silence and bad input", () => {
    expect(micLevel(0)).toBe(0);
    expect(micLevel(-1)).toBe(0);
    expect(micLevel(Number.NaN)).toBe(0);
  });
  it("lifts quiet speech and clamps at 1", () => {
    expect(micLevel(0.01)).toBeGreaterThan(0.2);
    expect(micLevel(0.05)).toBeGreaterThan(micLevel(0.01));
    expect(micLevel(0.5)).toBe(1);
  });
});
