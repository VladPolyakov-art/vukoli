import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HomeViewProps } from "../types";
import { StartScreen } from "./StartScreen";

/* D111: the labelled "Quick start" button next to the composer. */
const base: HomeViewProps = {
  step: "start", track: "interview", loading: false, engineReady: true, suggestions: [], composer: { text: "" },
  jobs: [], onQuickCall: () => {},
} as HomeViewProps;

const html = (over: Partial<HomeViewProps> = {}, track: "interview" | "english" = "interview") =>
  renderToStaticMarkup(createElement(StartScreen, { ...base, ...over, track, narrow: false }));

/** The opening tag of the Quick start button. */
const tag = (out: string) => out.match(/<button[^>]*data-track="quick-call"[^>]*>/)?.[0] ?? "";

describe("StartScreen: Quick start button (D111)", () => {
  it("is in the composer's toolbar, labelled, on both tracks", () => {
    for (const track of ["interview", "english"] as const) {
      const out = html({}, track);
      expect(out).toContain('data-track="quick-call"');
      expect(out).toContain("Quick start");
    }
  });

  it("is disabled while the engine is not ready, loading or starting", () => {
    for (const over of [{ engineReady: false }, { loading: true }, { starting: true }]) {
      expect(tag(html(over))).toContain("disabled");
    }
    expect(tag(html())).not.toContain("disabled");
  });

  it("is not drawn when the screen has no handler (review frames of older states)", () => {
    expect(html({ onQuickCall: undefined })).not.toContain("quick-call");
  });
});

describe("StartScreen: the end button is dictation, never a session start", () => {
  const dict = (state: "idle" | "listening" | "transcribing" = "idle") => ({ available: true, state });
  const tags = (out: string) => out.match(/data-track="(composer-[a-z-]+|quick-start)"/g) ?? [];

  it("with an empty field it is the dictation mic", () => {
    const out = html({ dictation: dict() });
    expect(tags(out)).toContain('data-track="composer-dictate"');
    expect(out).not.toContain("quick-start");
    expect(out).toContain("Dictate");
  });

  it("is the stop button while it listens", () => {
    expect(tags(html({ dictation: dict("listening") }))).toContain('data-track="composer-dictate-stop"');
  });

  it("with text or a file it is the Send arrow", () => {
    expect(tags(html({ dictation: dict(), composer: { text: "hi" } }))).toContain('data-track="composer-send"');
    expect(tags(html({ dictation: dict(), composer: { text: "", file: { name: "a.pdf", size: "1 KB" } } }))).toContain('data-track="composer-send"');
  });

  it("without a recogniser there is no mic", () => {
    const out = html({ dictation: { available: false, state: "idle" } });
    expect(out).not.toContain("composer-dictate");
  });
});
