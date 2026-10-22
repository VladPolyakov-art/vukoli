import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VerdictModel } from "../types";
import { Verdict, VerdictBar } from "./Sections";

const verdict: VerdictModel = { headline: "Getting there", step: 1, line: "Clear answers." };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("verdict screen-reader text (13, QA-20)", () => {
  it("the hidden step text reads as part of the headline: no stray leading period", () => {
    const html = renderToStaticMarkup(createElement(Verdict, { verdict, id: "v" }));
    expect(html).toContain('<span class="visually-hidden">, step 2 of 3</span>');
    expect(text(html)).not.toMatch(/ \. /);
    expect(text(html)).not.toContain("Verdict: Getting there");
  });
  it("the folded bar says it once: label, headline, step", () => {
    const html = renderToStaticMarkup(createElement(VerdictBar, { verdict, id: "v", children: null }));
    expect(html).toContain('<span class="visually-hidden">, step 2 of 3</span>');
    expect(text(html)).not.toMatch(/ \. /);
  });
});
