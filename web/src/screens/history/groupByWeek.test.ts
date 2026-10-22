import { describe, expect, it } from "vitest";
import { groupByWeek, weekStart } from "./groupByWeek";
import type { HistoryRowModel } from "./types";

const row = (id: string, startedAt: string): HistoryRowModel => ({ id, title: id, track: "interview", startedAt, result: "" });
const NOW = new Date(2026, 9, 20, 12, 0); // Tue Oct 20, 2026

describe("groupByWeek", () => {
  it("starts the week on Monday", () => {
    expect(new Date(weekStart(NOW)).getDate()).toBe(19);
    expect(new Date(weekStart(new Date(2026, 9, 18))).getDate()).toBe(12); // a Sunday belongs to the week before
  });

  it("groups into this week, last week and earlier months, newest first", () => {
    const g = groupByWeek([
      row("s1", "2026-10-17T19:10:00"), row("s2", "2026-10-19T20:40:00"), row("s3", "2026-10-18T21:05:00"),
      row("old", "2026-10-09T10:00:00"), row("sep", "2026-09-30T10:00:00"), row("last-year", "2025-12-02T10:00:00"),
    ], NOW);
    expect(g.map((x) => x.label)).toEqual(["This week", "Last week", "Earlier in October", "Earlier in September", "Earlier in December 2025"]);
    expect(g[0]!.rows.map((r) => r.id)).toEqual(["s2"]);
    expect(g[1]!.rows.map((r) => r.id)).toEqual(["s3", "s1"]);
  });

  it("puts a row with a broken date under Earlier instead of dropping it", () => {
    expect(groupByWeek([row("x", "nope")], NOW).map((x) => x.label)).toEqual(["Earlier"]);
  });

  it("returns no groups for no rows", () => {
    expect(groupByWeek([], NOW)).toEqual([]);
  });
});
