import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseCard } from "./SetupChat";
import { TalkSteps } from "../../session/parts/TalkSteps";
import { talkStepsModel } from "../../session/talkSteps";

describe("negotiation v3 markup", () => {
  it("the Your case card lists results as bullets, then reason and fallbacks; empty parts are left out", () => {
    const html = renderToStaticMarkup(createElement(CaseCard, { card: { results: ["Cut drop-off by a third", "Led checkout"], reason: "Market range", fallbacks: ["Sign-on bonus"] } }));
    expect(html).toContain("Your case");
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain("Market range");
    expect(html).toContain("Sign-on bonus");
    const bare = renderToStaticMarkup(createElement(CaseCard, { card: { results: [], reason: "", fallbacks: ["Title"] } }));
    expect(bare).not.toContain("<ul");
    expect(bare).not.toContain("Why this number");
  });

  it("the steps strip marks exactly one current step", () => {
    const html = renderToStaticMarkup(createElement(TalkSteps, { model: talkStepsModel(4, "offer")! }));
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("Trade");
  });
});
