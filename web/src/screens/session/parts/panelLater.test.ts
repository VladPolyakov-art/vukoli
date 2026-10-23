import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SessionData } from "../types";
import { PanelBody } from "./PanelBody";

const data = { title: "t", progress: "", elapsed: 0, question: "", transcript: [], answered: true, thread: null, earlier: [], nextNumber: null, pauseSec: 2 } as SessionData;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const panel = (mode: "p0" | "p1", variant: "interview" | "english" = "interview") =>
  renderToStaticMarkup(createElement(PanelBody, { mode, variant, input: "voice", data, layerOrder: "content-first", withChecks: true }));

describe("feedback panel during the call (D96)", () => {
  it("says feedback comes after the call and why, before and after the first answer", () => {
    for (const mode of ["p0", "p1"] as const) {
      const out = text(panel(mode));
      expect(out).toContain("Feedback comes after the call");
      expect(out).toContain("Mike stays fast");
    }
  });
  it("has no spinner, shimmer, skeleton or status role: nothing is being made per answer", () => {
    const html = panel("p1");
    expect(html).not.toMatch(/shimmer|skeleton|spinner|role="status"|aria-busy/i);
  });
  it("speaks of corrections for a turn in English practice", () => {
    expect(text(panel("p0", "english"))).toContain("corrections for every turn");
  });
});
