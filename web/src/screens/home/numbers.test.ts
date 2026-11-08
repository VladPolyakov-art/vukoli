import { describe, expect, it } from "vitest";
import { EMPTY_NUMBERS, validateNumbers, toNegotiateStart, type NumbersValues } from "./numbers";

const ok: NumbersValues = { ...EMPTY_NUMBERS, role: "Product Designer", low: "85,000", high: "98,000", target: "96k", currency: "EUR" };

describe("validateNumbers", () => {
  it("accepts a full card and parses the amounts", () => {
    const c = validateNumbers(ok);
    expect(c.ok).toBe(true);
    expect(c.parsed).toMatchObject({ role: "Product Designer", low: 85000, high: 98000, target: 96000, currency: "EUR", hasOffer: false });
    expect(c.hint).toBeNull();
  });
  it("needs only role and target; the range is optional", () => {
    const c = validateNumbers({ ...EMPTY_NUMBERS, role: "PD", target: "90000" });
    expect(c.ok).toBe(true);
    expect(c.parsed?.low).toBeUndefined();
  });
  it("flags an empty role and target", () => {
    const c = validateNumbers(EMPTY_NUMBERS);
    expect(c.errors.role?.key).toBe("numbers.err.role");
    expect(c.errors.target?.key).toBe("numbers.err.target");
  });
  it("skips the role when another step gave it", () => {
    expect(validateNumbers({ ...EMPTY_NUMBERS, target: "9" }, { roleRequired: false }).ok).toBe(true);
  });
  it("flags text and zero", () => {
    expect(validateNumbers({ ...ok, target: "lots" }).errors.target?.key).toBe("numbers.err.notNumber");
    expect(validateNumbers({ ...ok, target: "0" }).errors.target?.key).toBe("numbers.err.notPositive");
  });
  it("wants both ends of the range or neither", () => {
    expect(validateNumbers({ ...ok, high: "" }).errors.high?.key).toBe("numbers.err.rangePair");
    expect(validateNumbers({ ...ok, low: "" }).errors.low?.key).toBe("numbers.err.rangePair");
  });
  it("flags a reversed range and a target below it", () => {
    expect(validateNumbers({ ...ok, low: "98000", high: "85000" }).errors.high?.key).toBe("numbers.err.rangeOrder");
    const c = validateNumbers({ ...ok, target: "80000" });
    expect(c.errors.target).toEqual({ key: "numbers.err.targetBelow", vars: { min: "85,000" } });
  });
  it("needs a 3-letter code for Other", () => {
    expect(validateNumbers({ ...ok, currency: "other", code: "SE" }).errors.code?.key).toBe("numbers.err.code");
    const c = validateNumbers({ ...ok, currency: "other", code: "sek" });
    expect(c.ok).toBe(true);
    expect(c.parsed?.currency).toBe("SEK");
  });
  it("hints (not errors) for a target above the range and for a far-apart range", () => {
    expect(validateNumbers({ ...ok, target: "120000" })).toMatchObject({ ok: true, hint: "numbers.hint.above" });
    expect(validateNumbers({ ...ok, low: "20000", high: "90000", target: "50000" })).toMatchObject({ ok: true, hint: "numbers.hint.wide" });
  });
  it("builds the start block without a range when none was given", () => {
    const p = validateNumbers({ ...EMPTY_NUMBERS, role: "PD", target: "90000" }).parsed!;
    expect(toNegotiateStart(p, "firm")).toEqual({ role: "PD", target: 90000, currency: "USD", style: "firm", has_real_offer: false });
  });
});
