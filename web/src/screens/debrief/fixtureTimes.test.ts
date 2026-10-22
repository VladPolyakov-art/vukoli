import { describe, expect, it } from "vitest";
import { formatDateTime } from "../../lib/format";
import { englishS3, exampleSam } from "./fixtures";

describe("example debrief time format (13, QA-20)", () => {
  it("uses the 12-hour format real debriefs use ('Oct 14, 7:30 PM')", () => {
    expect(formatDateTime("2026-10-14T19:30:00")).toMatch(/^Oct 14, 7:30 PM$/);
    for (const m of [exampleSam, englishS3]) {
      const when = m.meta.find((x) => x.icon === "clock")!.text;
      expect(when).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} (AM|PM) · \d+ min$/);
    }
    expect(exampleSam.meta.find((x) => x.icon === "clock")!.text).toBe("Oct 14, 7:30 PM · 22 min");
  });
});
