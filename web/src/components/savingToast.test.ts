import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pendingSave } from "../lib/pendingSave";
import { SavingMessage } from "./AppShell";

const text = () => renderToStaticMarkup(createElement(SavingMessage)).replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("the toast for a session being prepared after End (D96)", () => {
  beforeEach(() => { pendingSave.clear("s-1"); pendingSave.clear("s-2"); });

  it("says saving until the server reports progress, then answers done of the total, then the debrief", () => {
    pendingSave.start("s-1");
    expect(text()).toBe("Saving your session… It'll be ready in a moment");
    pendingSave.setProgress("s-1", { done: 2, total: 5, stage: "feedback" });
    expect(text()).toBe("Preparing feedback · 2 of 5 answers");
    pendingSave.setProgress("s-1", { done: 5, total: 5, stage: "debrief" });
    expect(text()).toBe("Writing your debrief…");
  });
  it("ignores another session's numbers and forgets them when the save is over", () => {
    pendingSave.start("s-1");
    pendingSave.setProgress("s-2", { done: 1, total: 3, stage: "feedback" });
    expect(pendingSave.getProgress()).toBeNull();
    pendingSave.setProgress("s-1", { done: 1, total: 3, stage: "feedback" });
    pendingSave.clear("s-1");
    expect(pendingSave.getProgress()).toBeNull();
  });
  it("does not notify when the numbers did not change", () => {
    pendingSave.start("s-1");
    const seen = vi.fn();
    const off = pendingSave.subscribe(seen);
    pendingSave.setProgress("s-1", { done: 1, total: 3, stage: "feedback" });
    pendingSave.setProgress("s-1", { done: 1, total: 3, stage: "feedback" });
    off();
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
