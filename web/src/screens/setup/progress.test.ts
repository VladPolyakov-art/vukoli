import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prefs } from "../../lib/prefs";
import { startingInstallGate } from "./installGate";
import { clearProgress, parseProgress, readProgress, saveAnswer, saveStep } from "./progress";
import { setupSteps } from "./types";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

describe("setup progress (resume in another window)", () => {
  beforeEach(() => { vi.stubGlobal("window", { localStorage: memoryStorage() }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("has no progress on a first load", () => {
    expect(readProgress()).toBeNull();
  });

  it("after Install the next window resumes at the engine with Install shown as done", () => {
    saveStep("engine", true);                              // written by the Install step before the browser's dialog
    const resumed = readProgress();
    expect(resumed).toEqual({ step: "engine", withInstall: true });
    expect(setupSteps(resumed!.withInstall)).toEqual(["install", "engine", "check", "about"]);
    expect(setupSteps(resumed!.withInstall).indexOf(resumed!.step)).toBe(1);
  });

  it("keeps the answers already given when the step changes", () => {
    saveStep("engine", false);
    saveAnswer({ pick: "ollama" });
    saveStep("about", false);
    saveAnswer({ name: "Al", job: "Product Manager", answer: "text" });
    expect(readProgress()).toEqual({ step: "about", withInstall: false, pick: "ollama", name: "Al", job: "Product Manager", answer: "text" });
  });

  it("a saved name that was sent to the server is dropped from the draft", () => {
    saveStep("about", false);
    saveAnswer({ name: "Al" });
    saveAnswer({ name: undefined });
    expect(readProgress()).toEqual({ step: "about", withInstall: false });
  });

  it("answers are not stored without a step (stories and review frames stay clean)", () => {
    saveAnswer({ pick: "ollama" });
    expect(readProgress()).toBeNull();
  });

  it("is cleared when setup completes and when it is cleared by hand", () => {
    saveStep("about", true);
    prefs.setSetupDone(true);
    expect(readProgress()).toBeNull();
    saveStep("check", false);
    clearProgress();
    expect(readProgress()).toBeNull();
  });

  it("ignores junk: bad JSON, an unknown step, the install step", () => {
    expect(parseProgress("{nope")).toBeNull();
    expect(parseProgress(JSON.stringify({ step: "party" }))).toBeNull();
    expect(parseProgress(JSON.stringify({ step: "install", withInstall: true }))).toBeNull();
    expect(parseProgress(JSON.stringify({ step: "check", answer: "shout", pick: 3 }))).toEqual({ step: "check", withInstall: false });
  });

  it("a resumed run skips the install gate at once: no 1.5 s wait, no Install step, even if the event is there", () => {
    expect(startingInstallGate(true, true, true)).toBe("skip");
    expect(startingInstallGate(false, true, true)).toBe("skip");
    // a fresh run is decided as before
    expect(startingInstallGate(true, true, false)).toBe("show");
    expect(startingInstallGate(false, true, false)).toBe("waiting");
    expect(startingInstallGate(false, false, false)).toBe("skip");
  });
});
