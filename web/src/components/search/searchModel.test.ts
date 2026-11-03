import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../lib/types";
import { activeAfter, canSearch, highlightParts, isSearchShortcut, moveActive, queryWords, resultPath, searchKey } from "./searchModel";

const hit = (id: string, match: SearchResult["match"]): SearchResult => ({ id, title: "T", subtitle: "", mode: "interview", archived: false, started_at: "", match });
const key = (k: string, extra: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean }> = {}) =>
  ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...extra });

describe("search keyboard (D105)", () => {
  it("↓ and ↑ move the highlight and wrap round", () => {
    expect(moveActive(0, "ArrowDown", 3)).toBe(1);
    expect(moveActive(2, "ArrowDown", 3)).toBe(0);
    expect(moveActive(0, "ArrowUp", 3)).toBe(2);
    expect(moveActive(-1, "ArrowDown", 3)).toBe(0);
    expect(moveActive(-1, "ArrowUp", 3)).toBe(2);
    expect(moveActive(5, "ArrowDown", 3)).toBe(0);
    expect(moveActive(0, "ArrowDown", 0)).toBe(-1);
  });

  it("arrows move and Enter opens only when there are hits; the rest stays the input's", () => {
    expect(searchKey({ key: "ArrowDown" }, 2)).toEqual({ do: "move", key: "ArrowDown" });
    expect(searchKey({ key: "ArrowUp" }, 2)).toEqual({ do: "move", key: "ArrowUp" });
    expect(searchKey({ key: "Enter" }, 2)).toEqual({ do: "open" });
    expect(searchKey({ key: "Enter" }, 0)).toBeNull();
    expect(searchKey({ key: "ArrowDown" }, 0)).toBeNull();
    expect(searchKey({ key: "a" }, 2)).toBeNull();
    expect(searchKey({ key: "Home" }, 2)).toBeNull();            // the caret's, not the list's
    expect(searchKey({ key: "Enter", isComposing: true }, 2)).toBeNull();   // an IME choosing a word
    expect(searchKey({ key: "Enter", shiftKey: true }, 2)).toBeNull();
    expect(searchKey({ key: "ArrowDown", altKey: true }, 2)).toBeNull();
  });

  it("new hits keep the pointer on the same practice, else the first; none → none", () => {
    const a = hit("a", { field: "title", snippet: "" });
    const b = hit("b", { field: "title", snippet: "" });
    const c = hit("c", { field: "title", snippet: "" });
    expect(activeAfter([a, b], 1, [c, b])).toBe(1);
    expect(activeAfter([a, b], 1, [a, c])).toBe(0);
    expect(activeAfter([], -1, [a, b])).toBe(0);
    expect(activeAfter([a], 0, [])).toBe(-1);
  });

  it("⌘K on a Mac, Ctrl+K elsewhere; nothing else", () => {
    expect(isSearchShortcut(key("k", { metaKey: true }), true)).toBe(true);
    expect(isSearchShortcut(key("K", { metaKey: true }), true)).toBe(true);
    expect(isSearchShortcut(key("k", { ctrlKey: true }), true)).toBe(false);     // Ctrl+K is "cut to end of line" on a Mac
    expect(isSearchShortcut(key("k", { ctrlKey: true }), false)).toBe(true);
    expect(isSearchShortcut(key("k", { metaKey: true }), false)).toBe(false);
    expect(isSearchShortcut(key("k"), true)).toBe(false);
    expect(isSearchShortcut(key("j", { metaKey: true }), true)).toBe(false);
    expect(isSearchShortcut(key("k", { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isSearchShortcut(key("k", { metaKey: true, repeat: true }), true)).toBe(false);
  });
});

describe("what a hit opens", () => {
  it("a hit in a question or an answer opens that question; a hit in the title or the job opens the debrief", () => {
    expect(resultPath(hit("s-1", { field: "answer", snippet: "", q: 3 }))).toBe("/sessions/s-1?q=3");
    expect(resultPath(hit("s-1", { field: "question", snippet: "", q: 1 }))).toBe("/sessions/s-1?q=1");
    expect(resultPath(hit("s-1", { field: "answer", snippet: "" }))).toBe("/sessions/s-1");        // English practice: no question tabs
    expect(resultPath(hit("s-1", { field: "title", snippet: "", q: 2 }))).toBe("/sessions/s-1");
    expect(resultPath(hit("s-1", { field: "job", snippet: "" }))).toBe("/sessions/s-1");
    expect(resultPath(hit("a b/c", { field: "title", snippet: "" }))).toBe("/sessions/a%20b%2Fc");
  });
});

describe("query words and highlighting", () => {
  it("a query is words, lower case, without repeats; under 2 characters it is not sent", () => {
    expect(queryWords("  Kestrel  PAY kestrel ")).toEqual(["kestrel", "pay"]);
    expect(canSearch("a")).toBe(false);
    expect(canSearch(" a ")).toBe(false);
    expect(canSearch("ab")).toBe(true);
  });

  it("marks every word of the query, in any case, as a part of a word", () => {
    expect(highlightParts("Kestrel Pay · Product Manager", "pay manager")).toEqual([
      { text: "Kestrel ", hit: false }, { text: "Pay", hit: true }, { text: " · Product ", hit: false }, { text: "Manager", hit: true },
    ]);
    expect(highlightParts("…the budgeting went well…", "BUDGET")).toEqual([
      { text: "…the ", hit: false }, { text: "budget", hit: true }, { text: "ing went well…", hit: false },
    ]);
  });

  it("the longest word wins where words overlap, and nothing marked means one plain part", () => {
    expect(highlightParts("checkout", "check checkout").map((p) => p.text)).toEqual(["checkout"]);
    expect(highlightParts("checkout", "check checkout")[0]?.hit).toBe(true);
    expect(highlightParts("nothing here", "zzz")).toEqual([{ text: "nothing here", hit: false }]);
    expect(highlightParts("anything", "")).toEqual([{ text: "anything", hit: false }]);
    expect(highlightParts("", "x")).toEqual([]);
  });

  it("characters that mean something in a pattern are plain text", () => {
    expect(highlightParts("a.b (c) [d]", "(c) .b").filter((p) => p.hit).map((p) => p.text)).toEqual([".b", "(c)"]);
    expect(() => highlightParts("x", "[*+?\\")).not.toThrow();
  });
});
