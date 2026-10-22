import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Correction, EnglishModel } from "../types";
import { EnglishBody } from "./English";

const ctx = { isDismissed: () => false, isLeaving: () => false, editing: null, focusEditor: false };
const ids = { summary: "sum", corrections: "cor", phrases: "phr" };
const row = (id: string, typed: boolean): Correction => ({
  id, typed, turn: { n: 2 }, heard: ["I ", { kind: "heard", text: "go" }, " there"], say: ["I ", { kind: "fix", text: "went" }, " there"], why: "Past tense.",
});
const model = (corrections: Correction[]): EnglishModel => ({ corrections, visible: 3, repeated: 0, removed: [], phrases: [] });
const render = (m: EnglishModel) => renderToStaticMarkup(createElement(EnglishBody, { english: m, ctx, ids }));

describe("English debrief Corrections (13, F-13-7, QA-14)", () => {
  it("F-13-7: with no corrections there is no Corrections heading and no empty list, just an empty-state line", () => {
    const html = render(model([]));
    expect(html).not.toMatch(/<h2[^>]*>Corrections<\/h2>/);
    expect(html).toContain("No corrections this time.");
    expect(html).toContain('aria-label="Corrections"'); // the region keeps its name for screen readers
  });
  it("with corrections the heading is there and the empty-state line is not", () => {
    const html = render(model([row("a", true)]));
    expect(html).toMatch(/<h2[^>]*>Corrections<\/h2>/);
    expect(html).not.toContain("No corrections this time.");
  });
  it("QA-14: a typed talk does not explain 'Heard as'", () => {
    const html = render(model([row("a", true), row("b", true)]));
    expect(html).toContain("In the order they happened.");
    expect(html).not.toContain("Heard as");
  });
  it("QA-14: when a row says 'Heard as' the explanation is there", () => {
    const html = render(model([row("a", true), row("b", false)]));
    expect(html).toContain("is what speech recognition heard");
  });
});
