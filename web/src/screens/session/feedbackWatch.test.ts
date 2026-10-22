import { describe, expect, it } from "vitest";
import type { FeedbackRecord } from "../../lib/types";
import type { Thread } from "../../session/reducer";
import { opensItself, readyKey } from "./feedbackWatch";

const record = (id: string, complete = true) => ({ id, complete }) as unknown as FeedbackRecord;
const thread = (over: Partial<Thread> = {}): Thread => ({
  key: "q1", number: 1, question: "Q", records: [record("a")], pendingIds: [], unavailable: [], ...over,
});

describe("readyKey (QA-01)", () => {
  it("is the thread and its record count once every record is complete", () => {
    expect(readyKey(thread())).toBe("q1:1");
    expect(readyKey(thread({ records: [record("a"), record("b")] }))).toBe("q1:2");
  });
  it("is null before there is anything, while a record is pending or incomplete", () => {
    expect(readyKey(null)).toBeNull();
    expect(readyKey(thread({ records: [] }))).toBeNull();
    expect(readyKey(thread({ pendingIds: ["b"] }))).toBeNull();
    expect(readyKey(thread({ records: [record("a", false)] }))).toBeNull();
  });
  it("changes when the next thread's feedback arrives, not when a recheck rewrites the same records", () => {
    expect(readyKey(thread({ key: "q2", number: 2 }))).not.toBe(readyKey(thread()));
    expect(readyKey(thread({ records: [record("a")] }))).toBe(readyKey(thread({ records: [record("a")] })));
  });
});

describe("opensItself (QA-01)", () => {
  it("opens on wide, never on mid or narrow (the panel would cover the stage)", () => {
    expect(opensItself({ layout: "wide", phase: "your-turn", suppressed: false })).toBe(true);
    expect(opensItself({ layout: "mid", phase: "your-turn", suppressed: false })).toBe(false);
    expect(opensItself({ layout: "narrow", phase: "your-turn", suppressed: false })).toBe(false);
  });
  it("waits while the user is talking", () => {
    expect(opensItself({ layout: "wide", phase: "listening", suppressed: false })).toBe(false);
    for (const phase of ["thinking", "mike-speaking", "your-turn"] as const) {
      expect(opensItself({ layout: "wide", phase, suppressed: false })).toBe(true);
    }
  });
  it("the user's own close wins", () => {
    expect(opensItself({ layout: "wide", phase: "your-turn", suppressed: true })).toBe(false);
  });
});
