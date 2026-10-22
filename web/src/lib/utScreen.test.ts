import { describe, expect, it } from "vitest";
import { UT_ATTR, claimUtScreen, homeUtScreen, sessionUtScreen, utScreenForPath, type UtRoot } from "./utScreen";

function fakeRoot(initial?: string): UtRoot & { value: string | null; writes: string[] } {
  const root = {
    value: initial ?? null,
    writes: [] as string[],
    getAttribute(name: string) { return name === UT_ATTR ? root.value : null; },
    setAttribute(name: string, v: string) { if (name === UT_ATTR) { root.value = v; root.writes.push(v); } },
  };
  return root;
}

describe("utScreenForPath", () => {
  it("lets Home name itself", () => {
    expect(utScreenForPath("/")).toBeNull();
  });
  it("maps every debrief to one screen, never to its id", () => {
    expect(utScreenForPath("/sessions/abc")).toBe("/debrief");
    expect(utScreenForPath("/sessions/9f3e-77/")).toBe("/debrief");
  });
  it("maps the archive, the trash and the old history links", () => {
    expect(utScreenForPath("/archive")).toBe("/archive");
    expect(utScreenForPath("/archive/trash")).toBe("/archive/trash");
    expect(utScreenForPath("/history")).toBe("/archive");
    expect(utScreenForPath("/history/trash")).toBe("/archive/trash");
  });
  it("calls everything else not found", () => {
    expect(utScreenForPath("/nope")).toBe("/not-found");
    expect(utScreenForPath("/sessions")).toBe("/not-found");
    expect(utScreenForPath("/sessions/a/b")).toBe("/not-found");
  });
});

describe("homeUtScreen / sessionUtScreen", () => {
  it("names the Home states", () => {
    expect(homeUtScreen({ active: false })).toBe("/");
    expect(homeUtScreen({ active: true })).toBe("/home/setup-chat");
    expect(homeUtScreen({ active: true, plan: null })).toBe("/home/setup-chat");
    expect(homeUtScreen({ active: true, plan: "interview" })).toBe("/home/plan");
    expect(homeUtScreen({ active: true, plan: "drill" })).toBe("/home/plan");
    expect(homeUtScreen({ active: true, plan: "english" })).toBe("/home/plan-english");
  });
  it("splits the English session from the interview session", () => {
    expect(sessionUtScreen("english")).toBe("/session/english");
    expect(sessionUtScreen("interview")).toBe("/session");
    expect(sessionUtScreen(undefined)).toBe("/session");
  });
});

describe("claimUtScreen", () => {
  it("sets the name and writes nothing when it is already that name", () => {
    const root = fakeRoot("/archive");
    claimUtScreen("/archive", root);
    expect(root.writes).toEqual([]);
    claimUtScreen("/", root);
    expect(root.value).toBe("/");
  });
  it("restores the previous name on release (Settings over Home)", () => {
    const root = fakeRoot("/");
    const release = claimUtScreen("/settings", root, true);
    expect(root.value).toBe("/settings");
    release();
    expect(root.value).toBe("/");
  });
  it("does not restore over a newer screen", () => {
    const root = fakeRoot("/");
    const release = claimUtScreen("/settings", root, true);
    root.setAttribute(UT_ATTR, "/archive");
    release();
    expect(root.value).toBe("/archive");
  });
  it("leaves the name alone on release without restore (route swaps)", () => {
    const root = fakeRoot("pending");
    const releaseOld = claimUtScreen("/", root);
    claimUtScreen("/archive", root);
    releaseOld();
    expect(root.value).toBe("/archive");
  });
});
