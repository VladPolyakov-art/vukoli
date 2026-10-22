import { describe, expect, it } from "vitest";
import { extractCompanyRole, joinTitle, splitTitle } from "./vacancyTitle";

describe("vacancyTitle", () => {
  it("splits and joins a title", () => {
    expect(splitTitle("Kestrel Pay · Senior Product Designer")).toEqual({ company: "Kestrel Pay", role: "Senior Product Designer" });
    expect(splitTitle("Fieldnote")).toEqual({ company: "Fieldnote", role: "" });
    expect(joinTitle({ company: "Kestrel Pay", role: "Senior Product Designer" })).toBe("Kestrel Pay · Senior Product Designer");
    expect(joinTitle({ company: " ", role: "Designer" })).toBe("Designer");
  });
  it("reads 'Role at Company' from the first line", () => {
    expect(extractCompanyRole("Senior Product Designer at Kestrel Pay\n\nWe build payments")).toEqual({
      role: "Senior Product Designer",
      company: "Kestrel Pay",
    });
  });
  it("reads 'Company · Role' and returns null when unsure", () => {
    expect(extractCompanyRole("Lumen Health – Product Designer")).toEqual({ company: "Lumen Health", role: "Product Designer" });
    expect(extractCompanyRole("We are hiring a designer who cares about quality")).toBeNull();
    expect(extractCompanyRole("")).toBeNull();
  });
});

describe("jobName (13, QA-04)", () => {
  it("is Company · Role whichever way the title was written", async () => {
    const { jobName } = await import("./vacancyTitle");
    expect(jobName("Product Manager at Kestrel Pay")).toBe("Kestrel Pay · Product Manager");
    expect(jobName("Kestrel Pay · Product Manager")).toBe("Kestrel Pay · Product Manager");
    expect(jobName("Kestrel Pay - Product Manager")).toBe("Kestrel Pay · Product Manager");
    expect(jobName("Lumen")).toBe("Lumen");
    expect(jobName("")).toBe("");
  });
});
