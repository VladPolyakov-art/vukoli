import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HintCard } from "./HintCard";
import type { SessionHint } from "../types";
import { initialState, sessionReducer } from "../../../session/reducer";

const card = { id: "N4", title: "Pause before you answer", text: "Two or three seconds help.", example: "Let me think." };
const hint = (over: Partial<SessionHint> = {}): SessionHint => ({ available: true, open: true, used: 1, card, ...over });
const html = (h: SessionHint, onAnother?: () => void) => renderToStaticMarkup(createElement(HintCard, { hint: h, onHide: () => {}, onAnother }));

describe("HintCard", () => {
  it("has an Another hint button next to the close button", () => {
    const out = html(hint(), () => {});
    expect(out).toContain('aria-label="Another hint"');
    expect(out).toContain('title="Another hint"');
    expect(out.indexOf("Another hint")).toBeLessThan(out.indexOf("Hide the hint"));
  });
  it("has no button without a handler", () => {
    expect(html(hint())).not.toContain("Another hint");
  });
  it("waits: the button is disabled while the card is on its way", () => {
    expect(html(hint({ wait: "pending" }), () => {})).toMatch(/aria-label="Another hint"[^>]*disabled|disabled[^>]*aria-label="Another hint"/);
  });
  it("offers Try again when the card is late", () => {
    const out = html(hint({ wait: "stalled" }), () => {});
    expect(out).toContain("Try again");
    expect(html(hint({ wait: "idle" }), () => {})).not.toContain("Try again");
  });
});

describe("hint wait state", () => {
  it("pending, then stalled, then cleared by the card", () => {
    let s = sessionReducer(initialState("text"), { type: "local/hint_requested" });
    expect(s.hintWait).toBe("pending");
    s = sessionReducer(s, { type: "local/hint_stalled" });
    expect(s.hintWait).toBe("stalled");
    s = sessionReducer(s, { type: "hint", mode: "tough", card_id: "T2", title: "x", text: "y", example: "z", n: 1 });
    expect(s.hintWait).toBe("idle");
    expect(sessionReducer(s, { type: "local/hint_stalled" }).hintWait).toBe("idle");
  });
});
