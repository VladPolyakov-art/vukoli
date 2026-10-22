import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CopyField } from "./CopyField";

const field = (value: string) => createElement(CopyField, { value, copyLabel: "Copy command", copiedLabel: "Copied", label: "Command" });

describe("CopyField (QA-09)", () => {
  it("the scrolling code box takes keyboard focus and has a name", () => {
    const html = renderToStaticMarkup(field("ollama pull qwen3:8b"));
    expect(html).toMatch(/<code[^>]*tabindex="0"/);
    expect(html).toMatch(/<code[^>]*role="group"/);
    expect(html).toMatch(/<code[^>]*aria-label="Command"/);
  });
  it("ids are valid (no spaces or slashes from the value) and unique even for the same value twice", () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, field("/Users/me/Vukoli data/x y"), field("/Users/me/Vukoli data/x y")));
    const ids = [...html.matchAll(/<code id="([^"]*)"/g)].map((m) => m[1]!);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(id).toMatch(/^copy-[A-Za-z0-9_-]+$/);
    expect(new Set(ids).size).toBe(2);
  });
});
