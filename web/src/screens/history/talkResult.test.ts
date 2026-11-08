import { describe, expect, it } from "vitest";
import type { TalkResult } from "../../lib/types";
import { talkResult } from "./talkResult";

const neg = (o: Partial<Extract<TalkResult, { kind: "negotiate" }>>): TalkResult => ({
  kind: "negotiate", outcome: "x", currency: "EUR", opening: 92000, final_offer: 95000, gain_now: 3000,
  captured_now_pct: 30, step_up: null, no_offer: false, ...o,
});

describe("talkResult", () => {
  it("reads the tough count", () => {
    expect(talkResult({ kind: "tough", calm: 3, total: 5 })).toBe("Calm in 3 of 5");
  });
  it("falls back when tough has no counts", () => {
    expect(talkResult({ kind: "tough", calm: null, total: null })).toBeNull();
  });
  it("reads a negotiation move", () => {
    expect(talkResult(neg({}))).toBe("+3,000 EUR now · 30%");
  });
  it("prefers the step-up", () => {
    expect(talkResult(neg({ final_offer: 91000, step_up: { later: 98000, after_months: 3, in_writing: true } }))).toBe("91,000 → 98,000 at 3 months");
  });
  it("reads no offer", () => {
    expect(talkResult(neg({ no_offer: true, opening: null, final_offer: null, gain_now: null, captured_now_pct: null }))).toBe("No offer yet");
  });
  it("ignores other modes", () => {
    expect(talkResult(null)).toBeNull();
    expect(talkResult(undefined)).toBeNull();
  });
});
