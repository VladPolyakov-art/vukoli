import { describe, expect, it } from "vitest";
import { formatAmount, formatAmountText, parseAmount } from "./amount";

describe("parseAmount", () => {
  it("reads plain, grouped and suffixed amounts", () => {
    expect(parseAmount("95000")).toEqual({ ok: true, value: 95000 });
    expect(parseAmount("95,000")).toEqual({ ok: true, value: 95000 });
    expect(parseAmount(" 95 000 ")).toEqual({ ok: true, value: 95000 });
    expect(parseAmount("95k")).toEqual({ ok: true, value: 95000 });
    expect(parseAmount("1.2M")).toEqual({ ok: true, value: 1200000 });
  });
  it("rejects words and non-positive numbers", () => {
    expect(parseAmount("lots")).toEqual({ ok: false, error: "notNumber" });
    expect(parseAmount("")).toEqual({ ok: false, error: "notNumber" });
    expect(parseAmount("0")).toEqual({ ok: false, error: "notPositive" });
    expect(parseAmount("-5")).toEqual({ ok: false, error: "notPositive" });
  });
});

describe("format", () => {
  it("adds separators", () => {
    expect(formatAmount(1250000)).toBe("1,250,000");
    expect(formatAmountText("96k")).toBe("96,000");
    expect(formatAmountText("abc")).toBe("abc");
  });
});
