import { describe, expect, it } from "vitest";
import { place } from "./overlay";

const space = { width: 1000, height: 800 };
const base = { gap: 4, pad: 8, floating: { width: 200, height: 150 } };

describe("place (anchored popovers)", () => {
  it("opens below the anchor, start-aligned", () => {
    const p = place({ left: 100, top: 100, width: 40, height: 32 }, space, { ...base, placement: "bottom-start" });
    expect(p).toMatchObject({ side: "bottom", align: "start", left: 100, top: 132 });
  });
  it("flips above when there is no room below and more room above", () => {
    const p = place({ left: 100, top: 700, width: 40, height: 32 }, space, { ...base, placement: "bottom-start" });
    expect(p.side).toBe("top");
    expect(p.top).toBe(700 - 150);
  });
  it("aligns the end edge and stays inside the container padding", () => {
    const end = place({ left: 900, top: 100, width: 40, height: 32 }, space, { ...base, placement: "bottom-end" });
    expect(end.left).toBe(940 - 200);
    const clamped = place({ left: 950, top: 100, width: 40, height: 32 }, space, { ...base, placement: "bottom-start" });
    expect(clamped.left).toBe(1000 - 8 - 200);
  });
  it("matches the anchor width for a listbox", () => {
    const p = place({ left: 100, top: 100, width: 480, height: 40 }, space, { ...base, placement: "bottom-start", matchWidth: true });
    expect(p.width).toBe(480);
  });
  it("is at least the anchor width and grows to its content for a select (D78)", () => {
    const small = place({ left: 100, top: 100, width: 64, height: 40 }, space, { ...base, placement: "bottom-start", matchWidth: "min" });
    expect(small.width).toBe(200);
    const wide = place({ left: 100, top: 100, width: 480, height: 40 }, space, { ...base, placement: "bottom-start", matchWidth: "min" });
    expect(wide.width).toBe(480);
  });
  it("opens beside the anchor, bottom edges aligned, and falls back above when there is no room right (D79)", () => {
    const right = place({ left: 16, top: 700, width: 240, height: 48 }, space, { ...base, placement: "right-end" });
    expect(right).toMatchObject({ side: "right", align: "end", left: 16 + 240 + 4, top: 748 - 150 });
    const start = place({ left: 16, top: 100, width: 240, height: 48 }, space, { ...base, placement: "right-start" });
    expect(start).toMatchObject({ side: "right", top: 100 });
    const edge = place({ left: 700, top: 700, width: 240, height: 48 }, space, { ...base, placement: "right-end" });
    expect(edge.side).toBe("top");
  });
  it("becomes a full-width sheet in a narrow container, at most 60% high", () => {
    const narrow = { width: 375, height: 800 };
    const p = place({ left: 300, top: 100, width: 32, height: 32 }, narrow, {
      ...base, floating: { width: 200, height: 700 }, placement: "bottom-end", sheetWhenNarrow: true,
    });
    expect(p.left).toBe(8);
    expect(p.width).toBe(375 - 16);
    expect(p.maxHeight).toBe(800 * 0.6);
  });
});
