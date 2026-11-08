import { describe, expect, it } from "vitest";
import { hintGate } from "./hint";
import type { SessionHint, SessionPhase } from "./types";

const hint = (over: Partial<SessionHint> = {}): SessionHint => ({ available: true, open: false, used: 0, ...over });
const gate = (phase: SessionPhase, h: SessionHint | null = hint(), extra: { closing?: boolean; interrupted?: boolean } = {}) =>
  hintGate({ phase, interrupted: extra.interrupted ?? false, data: { hint: h ?? undefined, closing: extra.closing } });

describe("hintGate", () => {
  it("has no button without a hint block (other modes)", () => {
    expect(gate("your-turn", null)).toEqual({ enabled: false });
  });
  it("works while Mike speaks and on the user's turn", () => {
    expect(gate("mike-speaking").enabled).toBe(true);
    expect(gate("your-turn").enabled).toBe(true);
  });
  it("waits while the user speaks, with the reason", () => {
    expect(gate("listening")).toEqual({ enabled: false, reason: "Hints wait until you stop speaking" });
  });
  it("waits while Mike thinks", () => {
    expect(gate("thinking")).toEqual({ enabled: false, reason: "A hint is ready after Mike replies" });
  });
  it("is off while connecting or when the server has none", () => {
    expect(gate("connecting").reason).toBe("Hints are ready once Mike starts");
    expect(gate("your-turn", hint({ available: false })).reason).toBe("Hints are ready once Mike starts");
  });
  it("is off after the closing line and when interrupted", () => {
    expect(gate("between", hint(), { closing: true }).reason).toBe("Practice finished");
    expect(gate("interrupted", hint(), { interrupted: true }).enabled).toBe(false);
  });
});
