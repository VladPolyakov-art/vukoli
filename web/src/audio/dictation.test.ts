import { describe, expect, it } from "vitest";
import { dictationMode } from "./dictation";

const local = { available: true, backend: "parakeet" };
const none = { available: false, backend: "none" };

describe("dictationMode (D90)", () => {
  it("uses this computer's STT by default, even when the browser could recognise", () => {
    expect(dictationMode(local, true)).toBe("local");
    expect(dictationMode(undefined, false)).toBe("local");      // not loaded yet: the server is asked
  });
  it("falls back to the browser only when the local one isn't set up", () => {
    expect(dictationMode(none, true)).toBe("browser");
  });
  it("offers no mic when nothing can recognise", () => {
    expect(dictationMode(none, false)).toBeNull();
  });
});
