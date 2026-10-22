import { describe, expect, it } from "vitest";
import { follow, FOLLOW_START, isAtBottom, showJump, type FollowState } from "./transcriptScroll";

describe("transcript follow", () => {
  it("follows new content while at the bottom", () => {
    const r = follow(FOLLOW_START, { type: "content" });
    expect(r.scroll).toBe(true);
    expect(r.state).toEqual(FOLLOW_START);
    expect(showJump(r.state)).toBe(false);
  });

  it("stops following when the user scrolls up, and marks new content unread", () => {
    let s: FollowState = follow(FOLLOW_START, { type: "scroll", atBottom: false }).state;
    expect(s.stuck).toBe(false);
    expect(showJump(s)).toBe(true);
    const r = follow(s, { type: "content" });
    expect(r.scroll).toBe(false);
    s = r.state;
    expect(s.unread).toBe(true);
  });

  it("ignores its own (programmatic) scrolls", () => {
    const r = follow(FOLLOW_START, { type: "scroll", atBottom: false, programmatic: true });
    expect(r.state.stuck).toBe(true);
  });

  it("re-sticks when the user scrolls back to the bottom", () => {
    const up = follow(follow(FOLLOW_START, { type: "scroll", atBottom: false }).state, { type: "content" }).state;
    const back = follow(up, { type: "scroll", atBottom: true }).state;
    expect(back).toEqual({ stuck: true, unread: false });
  });

  it("jump to latest scrolls and follows again", () => {
    const up = follow(FOLLOW_START, { type: "scroll", atBottom: false }).state;
    const r = follow(up, { type: "jump" });
    expect(r.scroll).toBe(true);
    expect(r.state).toEqual({ stuck: true, unread: false });
    expect(showJump(r.state)).toBe(false);
  });

  it("isAtBottom allows a line of slack", () => {
    expect(isAtBottom(560, 1000, 400)).toBe(true);
    expect(isAtBottom(552, 1000, 400)).toBe(true);
    expect(isAtBottom(500, 1000, 400)).toBe(false);
    expect(isAtBottom(0, 300, 400)).toBe(true);
  });
});
