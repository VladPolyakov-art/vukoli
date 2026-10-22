import { describe, expect, it } from "vitest";
import { clock } from "./clock";

describe("clock", () => {
  it("pads minutes under an hour", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(432)).toBe("07:12");
    expect(clock(3599)).toBe("59:59");
  });
  it("switches to h:mm:ss from an hour", () => {
    expect(clock(3600)).toBe("1:00:00");
    expect(clock(3734)).toBe("1:02:14");
  });
  it("never goes negative or fractional", () => {
    expect(clock(-5)).toBe("00:00");
    expect(clock(61.9)).toBe("01:01");
  });
});
