import { describe, expect, it } from "vitest";
import { pageTitle } from "./documentTitle";

describe("pageTitle (QA-11)", () => {
  it("is the app name alone for Home", () => {
    expect(pageTitle()).toBe("Vukoli");
    expect(pageTitle("  ")).toBe("Vukoli");
  });
  it("is '<page> · Vukoli' for every other screen", () => {
    expect(pageTitle("Archive")).toBe("Archive · Vukoli");
    expect(pageTitle("Trash")).toBe("Trash · Vukoli");
    expect(pageTitle("Settings")).toBe("Settings · Vukoli");
    expect(pageTitle("Page not found")).toBe("Page not found · Vukoli");
    expect(pageTitle("Kestrel Pay · Product Manager")).toBe("Kestrel Pay · Product Manager · Vukoli");
  });
});
