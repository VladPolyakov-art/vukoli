import { describe, expect, it } from "vitest";
import { pendingLabel, railSessions, railTitle, withPending } from "./railItems";

describe("rail chat rows (D57)", () => {
  it("drops the shared 'Interview practice · ' prefix, keeps other titles", () => {
    expect(railTitle("Interview practice · About the job", "Untitled")).toBe("About the job");
    expect(railTitle("Interview practice", "Untitled")).toBe("General questions");
    expect(railTitle("My Lumen rehearsal", "Untitled")).toBe("My Lumen rehearsal");
    expect(railTitle("  ", "Untitled")).toBe("Untitled");
  });

  it("sorts newest first, keeps every session and shows no dates", () => {
    const base = { mode: "interview" as const, duration_s: 10, engine: "ollama", answers: 1, verdict: "" };
    const rows = railSessions([
      { ...base, id: "a", title: "Interview practice", started_at: new Date(2026, 9, 19).toISOString() },
      { ...base, id: "b", title: "English practice", mode: "english", started_at: new Date(2026, 9, 20, 9).toISOString() },
      { ...base, id: "c", title: "", started_at: new Date(2026, 9, 1).toISOString() },
    ], "Untitled");
    expect(rows.map((r) => [r.id, r.title, r.track])).toEqual([["b", "English practice", "english"], ["a", "General questions", "interview"], ["c", "Untitled", "interview"]]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["id", "title", "track"]);
  });

  it("leaves archived chats out of Recents (D80)", () => {
    const base = { mode: "interview" as const, duration_s: 10, engine: "ollama", answers: 1, verdict: "", title: "Lumen", started_at: new Date(2026, 9, 19).toISOString() };
    const rows = railSessions([{ ...base, id: "a" }, { ...base, id: "b", archived: true }, { ...base, id: "c", too_short: true, answers: 1 }], "Untitled");
    expect(rows.map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("Recents while sessions are saved after End", () => {
  const rows = [
    { id: "b", title: "Lumen", track: "interview" as const },
    { id: "a", title: "English practice", track: "english" as const },
  ];

  it("puts a session the server does not list yet at the top at once, loading, newest first", () => {
    const out = withPending(rows, [
      { id: "n1", at: 100, title: "Kestrel Pay · Senior Product Designer", track: "interview" },
      { id: "n2", at: 200, track: "english" },
    ], {}, "Untitled");
    expect(out.map((r) => [r.id, r.title, r.pending])).toEqual([
      ["n2", "Untitled", true], ["n1", "Kestrel Pay · Senior Product Designer", true], ["b", "Lumen", undefined], ["a", "English practice", undefined],
    ]);
    expect(out[0]?.track).toBe("english");
  });

  it("marks a listed session in place, keeping the server's title, with its own numbers only", () => {
    const out = withPending(rows, [{ id: "b", at: 1, title: "mine" }], { b: { done: 2, total: 5, stage: "feedback" }, a: { done: 9, total: 9, stage: "debrief" } }, "Untitled");
    expect(out.map((r) => r.id)).toEqual(["b", "a"]);
    expect(out[0]).toMatchObject({ title: "Lumen", pending: true, progress: { done: 2, total: 5 } });
    expect(out[1]?.pending).toBeUndefined();
    expect(out[1]?.progress).toBeUndefined();
  });

  it("leaves the rows alone when nothing is pending", () => {
    expect(withPending(rows, [], {}, "Untitled")).toBe(rows);
  });

  it("says what is going on for a screen reader", () => {
    expect(pendingLabel()).toBe("Saving your session…");
    expect(pendingLabel({ done: 2, total: 5, stage: "feedback" })).toBe("Preparing feedback");
    expect(pendingLabel({ done: 5, total: 5, stage: "debrief" })).toBe("Writing your debrief…");
  });
});
