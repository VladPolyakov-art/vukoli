import { describe, expect, it } from "vitest";
import { browserCanOfferInstall, initialInstallGate, nextInstallGate } from "./installGate";
import { SETUP_STEPS, setupSteps } from "./types";

describe("setup steps (D104)", () => {
  it("shows four steps with Install first, or the three of before", () => {
    expect(setupSteps(true)).toEqual(["install", "engine", "check", "about"]);
    expect(setupSteps(false)).toEqual(["engine", "check", "about"]);
    expect(SETUP_STEPS[0]).toBe("install");
  });
});

describe("install gate", () => {
  it("shows the Install step at once when the browser already holds the install event", () => {
    expect(initialInstallGate(true, true)).toBe("show");
  });

  it("skips at once in a browser that never fires the event (no waiting for nothing)", () => {
    expect(initialInstallGate(false, false)).toBe("skip");
    expect(browserCanOfferInstall({})).toBe(false);
    expect(browserCanOfferInstall({ onbeforeinstallprompt: null })).toBe(true);
  });

  it("waits for a late event, then shows the step if it comes in time", () => {
    const g = initialInstallGate(false, true);
    expect(g).toBe("waiting");
    expect(nextInstallGate(g, { type: "canInstall" })).toBe("show");
  });

  it("starts at the engine when the wait runs out", () => {
    expect(nextInstallGate("waiting", { type: "timeout" })).toBe("skip");
  });

  it("does not insert the step mid-wizard when the event arrives after the wait", () => {
    const late = nextInstallGate("waiting", { type: "timeout" });
    expect(nextInstallGate(late, { type: "canInstall" })).toBe("skip");
  });

  it("keeps the step once shown, even if the event is used up (canInstall goes false) or the wait fires", () => {
    expect(nextInstallGate("show", { type: "timeout" })).toBe("show");
  });
});
