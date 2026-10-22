import { describe, expect, it } from "vitest";
import { railSessions, railTitle } from "./railItems";

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
