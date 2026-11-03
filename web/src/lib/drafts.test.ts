import { beforeEach, describe, expect, it } from "vitest";
import { drafts } from "./drafts";

describe("drafts (D108: typed text survives closing a dialog)", () => {
  beforeEach(() => drafts.clear("k"));
  it("returns what was stored, per key", () => {
    expect(drafts.get("k")).toBeUndefined();
    drafts.set("k", { message: "hello" });
    expect(drafts.get("k")).toEqual({ message: "hello" });
    expect(drafts.get("other")).toBeUndefined();
  });
  it("is gone after clear (sent or saved)", () => {
    drafts.set("k", "x");
    drafts.clear("k");
    expect(drafts.get("k")).toBeUndefined();
  });
});
