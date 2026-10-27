import { beforeEach, describe, expect, it, vi } from "vitest";
import { pendingSave } from "./pendingSave";

const reset = () => pendingSave.getAll().forEach((x) => pendingSave.clear(x.id));

describe("sessions being saved after End (D73)", () => {
  beforeEach(reset);

  it("keeps each session on its own: a new practice inherits nothing of an older one", () => {
    pendingSave.start("s-1", { title: "Kestrel Pay", track: "interview" });
    pendingSave.setProgress("s-1", { done: 2, total: 5, stage: "feedback" });
    pendingSave.start("s-2", { track: "english" });
    expect(pendingSave.getAll().map((x) => x.id)).toEqual(["s-1", "s-2"]);
    expect(pendingSave.getProgress()["s-2"]).toBeUndefined();
    expect(pendingSave.getProgress()["s-1"]).toEqual({ done: 2, total: 5, stage: "feedback" });
    pendingSave.clear("s-1");
    expect(pendingSave.getAll().map((x) => x.id)).toEqual(["s-2"]);
    expect(pendingSave.getProgress()["s-1"]).toBeUndefined();
  });

  it("starting the same session twice keeps one entry and its first time", () => {
    pendingSave.start("s-1");
    const at = pendingSave.getAll()[0]?.at;
    pendingSave.start("s-1", { title: "Again" });
    expect(pendingSave.getAll()).toHaveLength(1);
    expect(pendingSave.getAll()[0]?.at).toBe(at);
  });

  it("ignores numbers for a session it does not watch", () => {
    pendingSave.start("s-1");
    pendingSave.setProgress("s-2", { done: 1, total: 3, stage: "feedback" });
    expect(pendingSave.getProgress()).toEqual({});
  });

  it("does not notify when the numbers did not change, and hands out the same objects until something does", () => {
    pendingSave.start("s-1");
    const all = pendingSave.getAll();
    const seen = vi.fn();
    const off = pendingSave.subscribe(seen);
    pendingSave.setProgress("s-1", { done: 1, total: 3, stage: "feedback" });
    const map = pendingSave.getProgress();
    pendingSave.setProgress("s-1", { done: 1, total: 3, stage: "feedback" });
    off();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(pendingSave.getProgress()).toBe(map);
    expect(pendingSave.getAll()).toBe(all);
  });

  it("clearing the last one empties the list", () => {
    pendingSave.start("s-1");
    pendingSave.clear("s-1");
    expect(pendingSave.getAll()).toEqual([]);
    expect(pendingSave.getProgress()).toEqual({});
  });
});
