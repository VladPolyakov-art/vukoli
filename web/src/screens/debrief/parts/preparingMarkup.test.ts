import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingBody } from "./States";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("debrief while the feedback is being made (D96)", () => {
  it("shows the answers done of the total and that the page can be left", () => {
    const out = text(renderToStaticMarkup(createElement(LoadingBody, { preparing: true, progress: { done: 2, total: 5, stage: "feedback" } })));
    expect(out).toContain("Preparing feedback · 2 of 5 answers");
    expect(out).toContain("You can leave this page");
  });
  it("writes the debrief last", () => {
    const out = text(renderToStaticMarkup(createElement(LoadingBody, { preparing: true, progress: { done: 5, total: 5, stage: "debrief" } })));
    expect(out).toContain("Writing your debrief");
    expect(out).not.toContain("Preparing feedback");
  });
  it("without numbers it only says the debrief is being written, as before", () => {
    const out = text(renderToStaticMarkup(createElement(LoadingBody, { preparing: true })));
    expect(out).toContain("Writing your debrief");
    expect(out).not.toContain("You can leave this page");
  });
});
