import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanModel } from "../types";
import { PlanCard } from "./PlanCard";

const plan: PlanModel = {
  kind: "interview",
  job: { id: "v1", company: "Kestrel Pay", role: "Product Manager" },
  jobStatus: "ready",
  questionsReady: 6,
  round: "behavioural",
  strictness: 2,
  questions: 5,
  minutes: 15,
  basis: "cv+job",
  hasCv: true,
};

const html = renderToStaticMarkup(createElement(PlanCard, { plan, jobs: [], engineReady: true }));
const dl = html.slice(html.indexOf("<dl"), html.indexOf("</dl>") + 5);

/** Children tag names of the first element with `tag`, by walking the markup (no DOM in the node test env). */
function childrenOf(markup: string, tag: string): string[][] {
  const VOID = new Set(["br", "hr", "img", "input", "path", "circle", "rect", "line", "polyline"]);
  const stack: string[] = [];
  const found: string[][] = [];
  for (const m of markup.matchAll(/<(\/?)([a-z0-9]+)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , self] = m;
    if (VOID.has(name!) || self) continue;
    if (closing) { stack.pop(); continue; }
    const parentIdx = stack.length - 1;
    if (parentIdx >= 0 && stack[parentIdx] === tag) found[found.length - 1]!.push(name!);
    stack.push(name!);
    if (name === tag) found.push([]);
  }
  return found;
}

describe("PlanCard list markup (QA-08)", () => {
  it("dl > div > dt + dd: the list holds only divs, each div only a dt then a dd", () => {
    expect(new Set(childrenOf(dl, "dl")[0])).toEqual(new Set(["div"]));
    const rows = childrenOf(dl, "div").filter((c) => c.includes("dt"));
    expect(rows.length).toBeGreaterThan(3);
    for (const kids of rows) expect(kids).toEqual(["dt", "dd"]);
  });
  it("the Change action sits inside the dd of its row", () => {
    const rows = dl.split(/<div class="[^"]*_row_[^"]*">/).slice(1);
    const jobRow = rows.find((r) => r.includes("Kestrel Pay"))!;
    expect(jobRow.indexOf("Change")).toBeGreaterThan(jobRow.indexOf("<dd"));
    expect(jobRow.indexOf("Change")).toBeLessThan(jobRow.indexOf("</dd>"));
    for (const row of rows) expect(row).toMatch(/<\/dd><\/div>(<\/dl>)?$|<\/dd>$/);
  });
});
