import { describe, expect, it } from "vitest";
import { fixtureProps } from "./fixtures";
import { stageFor } from "./stage";
import type { SessionPhase, SessionViewProps } from "./types";

const base = fixtureProps({ scene: "listening" });
const at = (phase: SessionPhase, o: Partial<SessionViewProps> = {}) => stageFor({ ...base, phase, ...o }).presence;

describe("Session → Presence state (D49)", () => {
  it("glows only while someone talks or Mike thinks", () => {
    expect(at("mike-speaking")).toBe("speaking");
    expect(at("listening")).toBe("listening");
    expect(at("thinking")).toBe("thinking");
  });

  it("your turn: a faint inviting glow (D50)", () => {
    expect(at("your-turn")).toBe("waiting");
    expect(at("your-turn", { input: "text" })).toBe("waiting");
  });

  it("is idle (no glow) everywhere else", () => {
    const quiet: SessionPhase[] = ["connecting", "between", "preparing", "feedback", "unavailable", "editing", "rechecking", "interrupted", "saving"];
    for (const p of quiet) expect(at(p), p).toBe("idle");
  });

  it("muted never glows, even while recording", () => {
    expect(at("listening", { muted: true })).toBe("idle");
    expect(at("your-turn", { muted: true })).toBe("idle");
  });

  it("text mode: Mike still glows when he speaks and thinks", () => {
    expect(at("mike-speaking", { input: "text" })).toBe("speaking");
    expect(at("thinking", { input: "text" })).toBe("thinking");
  });

  it("the state is always text too", () => {
    for (const p of ["mike-speaking", "listening", "thinking", "your-turn", "between"] as SessionPhase[]) {
      expect(stageFor({ ...base, phase: p }).label.length).toBeGreaterThan(0);
    }
  });
});
