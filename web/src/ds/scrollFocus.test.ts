import { describe, expect, it } from "vitest";
import { needsScrollFocus, scrollFocusAttrs } from "./scrollFocus";

const box = { scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100, hasFocusable: false };

describe("needsScrollFocus (QA-09)", () => {
  it("is false when the box does not scroll", () => {
    expect(needsScrollFocus(box)).toBe(false);
    expect(needsScrollFocus({ ...box, scrollHeight: 101 })).toBe(false); // one pixel of rounding
  });
  it("is true when it scrolls vertically or sideways and holds no control", () => {
    expect(needsScrollFocus({ ...box, scrollHeight: 400 })).toBe(true);
    expect(needsScrollFocus({ ...box, scrollWidth: 400 })).toBe(true);
  });
  it("is false when a control inside already gives the keyboard a stop", () => {
    expect(needsScrollFocus({ ...box, scrollHeight: 400, hasFocusable: true })).toBe(false);
  });
});

describe("scrollFocusAttrs", () => {
  it("adds tabindex, role and a name only when on", () => {
    expect(scrollFocusAttrs(true, "Feedback")).toEqual({ tabIndex: 0, role: "region", "aria-label": "Feedback" });
    expect(scrollFocusAttrs(false, "Feedback")).toEqual({});
  });
});
