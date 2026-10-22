import { describe, expect, it } from "vitest";
import { fakeVoiceLevel } from "./fakeLevel";
import { nextIndex } from "./roving";

describe("nextIndex (radio group keys)", () => {
  it("wraps arrows in both directions", () => {
    expect(nextIndex("ArrowRight", 3, 4)).toBe(0);
    expect(nextIndex("ArrowDown", 1, 4)).toBe(2);
    expect(nextIndex("ArrowLeft", 0, 4)).toBe(3);
    expect(nextIndex("ArrowUp", 2, 4)).toBe(1);
  });
  it("jumps to the ends with Home / End", () => {
    expect(nextIndex("Home", 2, 4)).toBe(0);
    expect(nextIndex("End", 0, 4)).toBe(3);
  });
  it("ignores other keys and empty groups", () => {
    expect(nextIndex("Enter", 1, 4)).toBe(-1);
    expect(nextIndex("ArrowRight", 0, 0)).toBe(-1);
  });
});

describe("fakeVoiceLevel (story driver)", () => {
  it("stays within 0..1 and is deterministic", () => {
    for (let t = 0; t < 20000; t += 137) {
      const v = fakeVoiceLevel(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fakeVoiceLevel(t)).toBe(v);
    }
  });
});
