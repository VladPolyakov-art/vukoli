/* US-30 AC1: the free-vs-premium table is identical in the README and in Settings → About and what's free (D58). */
import { describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import readme from "../../../README.md?raw";
const a = en.settings.about;

describe("README What's free table", () => {
  it("has every row of the app table", () => {
    for (const id of ["practice", "english", "prep", "bank", "debrief", "memory", "drill"] as const) {
      expect(readme).toContain(`| ${a.row[id]} | ✓ | ✓ |`);
    }
    expect(readme).toContain(`| ${a.row.setup} | ${a.cell.setup} | ✓ |`);
    expect(readme).toContain(`| ${a.row.voice} | ${a.cell.voice} | ✓ |`);
    expect(readme).toContain(`| ${a.row.trends} | — | ✓ |`);
    expect(readme).toContain(`| ${a.row.devices} | ${a.cell.devices} | ✓ |`);
  });
  it("has the same intro, header and Premium note", () => {
    expect(readme).toContain(a.freeIntro);
    expect(readme).toContain(`| ${a.feature} | ${a.free} | ${a.premium} (${a.later.toLowerCase()}) |`);
    expect(readme).toContain(a.premiumNote);
  });
});
