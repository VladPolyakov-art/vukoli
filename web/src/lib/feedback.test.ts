import { describe, expect, it } from "vitest";
import { attachPreview, canSendRating, canSendSupport, copyText, isAskTurn, ratingBody, shouldAskAfterSession, supportBody } from "./feedback";

describe("when to ask how a session went (AC2)", () => {
  it("asks on the 1st finished session, then the 6th, 11th, 16th…", () => {
    const asked = Array.from({ length: 21 }, (_, i) => i + 1).filter(isAskTurn);
    expect(asked).toEqual([1, 6, 11, 16, 21]);
  });

  it("does not ask on 2 to 5, and never at 0", () => {
    for (const n of [0, 2, 3, 4, 5, 7, 10]) expect(isAskTurn(n)).toBe(false);
  });

  it("stays quiet when the switch is off or there is nowhere to send", () => {
    expect(shouldAskAfterSession(1, true)).toBe(true);
    expect(shouldAskAfterSession(1, false)).toBe(false);
    expect(shouldAskAfterSession(6, true, false)).toBe(false);
    expect(shouldAskAfterSession(3, true)).toBe(false);
  });
});

describe("the support form (AC1, AC4)", () => {
  const draft = { kind: "idea", message: "  Add a timer  ", email: " ", attach: false } as const;

  it("needs a message; the rating alone is enough for the ask", () => {
    expect(canSendSupport({ message: "   " })).toBe(false);
    expect(canSendSupport(draft)).toBe(true);
    expect(canSendRating(null)).toBe(false);
    expect(canSendRating(0)).toBe(false);
    expect(canSendRating(5)).toBe(true);
  });

  it("sends the metadata line only when the box is ticked", () => {
    expect(supportBody(draft)).toEqual({ kind: "idea", message: "Add a timer", attach_meta: false });
    expect(supportBody({ ...draft, attach: true, email: " me@example.com " }))
      .toEqual({ kind: "idea", message: "Add a timer", email: "me@example.com", attach_meta: true });
  });

  it("previews the exact line, and nothing when the box is off", () => {
    expect(attachPreview(true, "Vukoli 0.2.3 · macOS 15 · Ollama (local)")).toBe("Vukoli 0.2.3 · macOS 15 · Ollama (local)");
    expect(attachPreview(false, "Vukoli 0.2.3 · macOS 15 · Ollama (local)")).toBeNull();
    expect(attachPreview(true, "")).toBeNull();
  });

  it("copies the message, with the line only when ticked", () => {
    expect(copyText({ message: "Broken", attach: false }, "Vukoli 0.2.3")).toBe("Broken");
    expect(copyText({ message: "Broken", attach: true }, "Vukoli 0.2.3")).toBe("Broken\n\nVukoli 0.2.3");
  });
});

describe("the ask after a session", () => {
  it("sends the rating and the note, with nothing attached", () => {
    expect(ratingBody(4, "  Slower than I hoped ", "s-1")).toEqual({ kind: "session", message: "Slower than I hoped", rating: 4, attach_meta: false, session_id: "s-1" });
    expect(ratingBody(5, "")).toEqual({ kind: "session", message: "", rating: 5, attach_meta: false });
  });
});
