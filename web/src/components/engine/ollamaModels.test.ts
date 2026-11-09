import { describe, expect, it } from "vitest";
import type { OllamaModel, OllamaPull } from "../../lib/types";
import { buildOptions, modelToPull, settle } from "./ollamaModels";

const installed: OllamaModel[] = [{ name: "qwen3:4b-instruct", size: 2_500_000_000, thinking_only: false }];
const pull = (over: Partial<OllamaPull> = {}): OllamaPull => ({
  model: "qwen3:8b", state: "idle", phase: "", error: "", completed: 0, total: 0, recommended: "qwen3:8b",
  options: [{ model: "qwen3:4b-instruct", size_gb: 2.5 }, { model: "qwen3:8b", size_gb: 5.2 }], ...over,
});
const pending = { slot: "model" as const, value: "qwen3:8b", model: "qwen3:8b" };

describe("buildOptions", () => {
  it("lists models that are not downloaded, with size and a mark", () => {
    const labels = buildOptions(installed, pull(), "qwen3:8b").map((o) => o.label);
    expect(labels).toContain("qwen3:8b · 5.2 GB · not downloaded · recommended");
    expect(labels).not.toContain("qwen3:4b-instruct · 2.5 GB · not downloaded");
  });
  it("says in Automatic when the recommended model is missing", () => {
    expect(buildOptions(installed, pull(), "qwen3:8b")[0]?.label).toBe("Automatic (qwen3:8b, not downloaded)");
    expect(buildOptions(installed, pull(), "qwen3:4b-instruct")[0]?.label).toBe("Automatic (qwen3:4b-instruct)");
  });
  it("still works before the download info has loaded", () => {
    expect(buildOptions(installed, null, "qwen3:4b-instruct")).toHaveLength(2);
  });
});

describe("modelToPull", () => {
  it("returns nothing for an installed model and the recommended one for Automatic when missing", () => {
    expect(modelToPull("qwen3:4b-instruct", installed, "qwen3:8b")).toBe("");
    expect(modelToPull("qwen3:8b", installed, "qwen3:8b")).toBe("qwen3:8b");
    expect(modelToPull("", installed, "qwen3:8b")).toBe("qwen3:8b");
    expect(modelToPull("", installed, "qwen3:4b-instruct")).toBe("");
  });
});

describe("settle", () => {
  it("waits while pulling, saves when done, reports errors, drops the rest", () => {
    expect(settle(pull({ state: "pulling" }), pending)).toBe("wait");
    expect(settle(pull({ state: "done" }), pending)).toBe("save");
    expect(settle(pull({ state: "error", error: "disk full" }), pending)).toBe("fail");
    expect(settle(pull({ state: "cancelled" }), pending)).toBe("drop");
    expect(settle(pull({ state: "done" }), null)).toBe("drop");
    expect(settle(pull({ state: "done", model: "other" }), pending)).toBe("drop");
  });
});
