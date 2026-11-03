import { describe, expect, it } from "vitest";
import type { WeakSpot } from "../../lib/types";
import { lowerFirstWord, weakFromSession } from "./sessionFocus";

const rec = (weak_spots: WeakSpot[]) => ({ debrief: { verdict: "", strength: "", next_step: "", source: "model", weak_spots } });

describe("weakFromSession (C1)", () => {
  it("takes one weak spot per layer, the first of each, in the debrief's order", () => {
    const got = weakFromSession(rec([
      { layer: "content", tag: "no_result", text: "" },
      { layer: "content", tag: "we_not_i", text: "" },
      { layer: "language", tag: "preposition", text: "" },
    ]));
    expect(got.map((w) => [w.layer, w.id, w.short])).toEqual([
      ["content", "content-no_result", "end with the result"],
      ["language", "language-preposition", "prepositions"],
    ]);
  });

  it("names an unknown tag from the server's text, then from the tag", () => {
    const got = weakFromSession(rec([{ layer: "delivery", tag: "new_tag", text: "Breathe" }, { layer: "language", tag: "other_tag", text: "" }]));
    expect(got.map((w) => w.title)).toEqual(["Breathe", "other tag"]);
  });

  it("keeps the tag, and keeps \"I\" a capital in the short name", () => {
    const got = weakFromSession(rec([{ layer: "content", tag: "we_not_i", text: "" }]));
    expect(got.map((w) => [w.tag, w.short, w.phrase])).toEqual([["we_not_i", 'say "I", not "we"', 'say "I", not "we"']]);
  });

  it("lowers only a plain capitalised first word", () => {
    expect(lowerFirstWord("No result in your answers")).toBe("no result in your answers");
    expect(lowerFirstWord('Say "I", not "we"')).toBe('say "I", not "we"');
    expect(lowerFirstWord("I have led for finished projects")).toBe("I have led for finished projects");
    expect(lowerFirstWord("CV claims without a number")).toBe("CV claims without a number");
    expect(lowerFirstWord("“we” instead of “I”")).toBe("“we” instead of “I”");
    expect(lowerFirstWord("")).toBe("");
  });

  it("returns nothing for a missing record or a debrief without weak spots", () => {
    expect(weakFromSession(null)).toEqual([]);
    expect(weakFromSession({ debrief: null })).toEqual([]);
    expect(weakFromSession(rec([]))).toEqual([]);
  });
});
