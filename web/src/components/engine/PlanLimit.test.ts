import { describe, expect, it } from "vitest";
import type { EngineLimits } from "../../lib/types";
import { limitLine, resetWhen } from "./PlanLimit";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const percent = (used: number, extra: Partial<Extract<EngineLimits, { kind: "percent" }>> = {}): EngineLimits => ({
  engine: "codex_cli", kind: "percent", plan: "free", as_of: "2026-10-21T11:59:00Z",
  windows: [{ id: "month", used_percent: used, resets_at: "2026-11-20T09:00:00Z", stale: false }],
  estimate: { sessions: 98, at_least: true, window: "month" }, ...extra,
});

describe("limitLine (D88)", () => {
  it("shows the percent used, the reset and the sessions left", () => {
    expect(limitLine(percent(2), NOW)).toEqual({
      tone: "plain", text: "Free plan · 2% of your monthly limit used · resets Nov 20 · 98+ sessions left" });
  });

  it("warns when less than a fifth is left, and when it is used up", () => {
    expect(limitLine(percent(85, { estimate: { sessions: 3, at_least: false, window: "month" } }), NOW)).toEqual({
      tone: "warning", text: "Free plan · Only 15% of your monthly limit left · resets Nov 20 · about 3 sessions left" });
    expect(limitLine(percent(100), NOW)?.text).toBe("Free plan · Your monthly limit is used up · resets Nov 20. Pick another engine meanwhile.");
  });

  it("takes the tightest window that hasn't reset; says so when all have", () => {
    const claude: EngineLimits = {
      engine: "claude_cli", kind: "percent", plan: "", as_of: "2026-10-21T11:00:00Z", estimate: null, windows: [
        { id: "five_hour", used_percent: 90, resets_at: "2026-10-21T11:30:00Z", stale: true },
        { id: "seven_day", used_percent: 40, resets_at: "2026-10-25T00:00:00Z", stale: false },
      ],
    };
    expect(limitLine(claude, NOW)?.text).toBe("40% of your weekly limit used · resets Oct 25");
    const allReset = { ...claude, windows: claude.windows.map((w) => ({ ...w, stale: true })) };
    expect(limitLine(allReset, NOW)?.text).toMatch(/has reset since your last session/);
  });

  it("is honest where Google publishes no number", () => {
    expect(limitLine({ engine: "antigravity_cli", kind: "count", period: "week", requests: 1 }, NOW)?.text)
      .toBe("Google doesn't publish the exact limit. This week Vukoli sent 1 request.");
    const day = limitLine({ engine: "gemini_live", kind: "count", period: "day", requests: 12, resets_at: "2026-10-22T07:00:00Z" }, NOW);
    expect(day?.text).toMatch(/^Google doesn't publish the exact limit\. Today Vukoli sent 12 requests · resets \d{1,2}:00/);
  });

  it("says nothing without a limit; Claude waits for its first request", () => {
    expect(limitLine({ engine: "ollama", kind: "none" }, NOW)).toBeNull();
    expect(limitLine(null, NOW)).toBeNull();
    expect(limitLine({ engine: "claude_cli", kind: "pending" }, NOW)?.text).toMatch(/after your first session/);
  });

  it("gives a time for a reset within a day, otherwise a date", () => {
    expect(resetWhen("2026-10-21T15:40:00Z", NOW)).toMatch(/\d{1,2}:40/);
    expect(resetWhen("2026-11-20T09:00:00Z", NOW)).toBe("Nov 20");
    expect(resetWhen(null, NOW)).toBe("");
  });
});
