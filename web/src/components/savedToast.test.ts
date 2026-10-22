import { describe, expect, it } from "vitest";
import { onSessionPage, savedToast, sessionPath } from "./AppShell";

describe("saved-session toast (UT-4)", () => {
  it("hides on its own after the default delay", () => {
    expect(savedToast(() => {}).duration).toBeUndefined();
  });

  it("knows when the user is already on that session's debrief", () => {
    expect(sessionPath("s 1")).toBe("/sessions/s%201");
    expect(onSessionPage("/sessions/s%201", "s 1")).toBe(true);
    expect(onSessionPage("/sessions/s-2", "s 1")).toBe(false);
    expect(onSessionPage("/", "s 1")).toBe(false);
  });
});
