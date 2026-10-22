/* Scenes for stories and the review page: the Debrief inside the full shell (MemoryRouter + AppShellView), every state
 * from props, nothing reaches the network. Fixtures: docs/ia.md §6 (Alex Morgan). */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppShellView, type RecentState, type ShellEngine } from "../../components/AppShell";
import { OverlayRoot } from "../../ds/OverlayRoot";
import type { LayerOrder } from "../../lib/types";
import { DEFAULT_OPEN, englishS3, exampleSam, interviewLong, interviewPartial, interviewS2 } from "./fixtures";
import { DebriefView } from "./DebriefView";
import { STATIC_ACTIONS } from "./static";
import type { DebriefModel, DebriefState, DebriefUi, DebriefVariant } from "./types";

/** A frame of a real width, scaled down to fit, with its own OverlayRoot (menus and tooltips open inside it). */
export function ScaledStage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div
      ref={outer}
      style={{ width: "100%", maxWidth: width, height: height * scale, overflow: "hidden", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
        <OverlayRoot>{children}</OverlayRoot>
      </div>
    </div>
  );
}

export const SHELL_RECENT: RecentState = {
  status: "ready",
  items: [
    { id: "s2", title: "Kestrel Pay · Senior Product Designer", track: "interview" },
    { id: "s3", title: "English · Talk about your work", track: "english" },
    { id: "s1", title: "Lumen Health · Product Designer, Design Systems", track: "interview" },
  ],
};
export const SHELL_ENGINE: ShellEngine = { name: "Ollama · qwen3:4b", status: "ready" };

export interface DebriefSceneSpec {
  variant: DebriefVariant;
  state?: DebriefState;
  model?: DebriefModel;
  layerOrder?: LayerOrder;
  ui?: DebriefUi;
  storageError?: boolean;
  /** An action failed: the error callout under the header. */
  notice?: string;
  route?: string;
}

/** Q2 after a recheck: the answer carries the "Edited by you" badge. */
const interviewEdited: DebriefModel = {
  ...interviewS2,
  questions: interviewS2.questions.map((q) => (q.n === 2 ? { ...q, edited: true } : q)),
};

/** A clean English session: nothing repeated, so no phrases to review and no "uses these 0 phrases" line. */
const englishNoPhrases = {
  ...englishS3,
  english: englishS3.english && { ...englishS3.english, phrases: [], repeated: 0, practiseMinutes: undefined },
};

/** F-13-7: a talk with nothing to correct: no empty "Corrections" heading, one line says so. */
const englishNoCorrections = {
  ...englishS3,
  english: englishS3.english && { ...englishS3.english, corrections: [], removed: [], phrases: [], repeated: 0, practiseMinutes: undefined },
};

/** QA-14: a typed talk (rows say "You typed"), so the Corrections subtitle does not explain "Heard as". */
const englishTyped = {
  ...englishS3,
  english: englishS3.english && {
    ...englishS3.english,
    corrections: englishS3.english.corrections.map((c) => ({ ...c, typed: true })),
  },
};

const base = { variant: "interview", state: "ready" } as const;

export const DEBRIEF_SCENES = {
  /** §3.1–3.5: Q2 open, its stronger answer open. */
  interviewFull: { ...base, model: interviewS2, ui: { open: DEFAULT_OPEN.s2, strongerOpen: [2] } },
  /** D80: the folded verdict bar, opened (summary, scale, what to fix first, next step). */
  interviewVerdictOpen: { ...base, model: interviewS2, ui: { open: DEFAULT_OPEN.s2, verdictOpen: true } },
  interviewDeliveryFirst: { ...base, model: interviewS2, layerOrder: "delivery-first", ui: { open: DEFAULT_OPEN.s2, strongerOpen: [2] } },
  interviewRename: { ...base, model: interviewS2, ui: { open: DEFAULT_OPEN.s2, renaming: true } },
  interviewRecheck: { ...base, model: interviewS2, ui: { open: DEFAULT_OPEN.s2, editing: { question: 2, correction: "q2-led" } } },
  interviewRechecking: { ...base, model: interviewS2, ui: { open: DEFAULT_OPEN.s2, rechecking: 2 } },
  /** Q2 checked again from the corrected text: the badge says the answer is the user's version. */
  interviewEdited: { ...base, model: interviewEdited, ui: { open: DEFAULT_OPEN.s2 } },
  /** The check failed: the old feedback stays and a callout says so. */
  interviewRecheckFailed: { ...base, model: interviewS2, ui: { open: DEFAULT_OPEN.s2 }, notice: "Couldn't check that answer again. It was not changed. The model took too long to answer." },
  english: { variant: "english", state: "ready", model: englishS3, route: "/sessions/s3" },
  /** US-24: no phrases to review, so "Practise again" stands alone. */
  englishNoPhrases: { variant: "english", state: "ready", model: englishNoPhrases, route: "/sessions/s3" },
  /** F-13-7: nothing to correct, so the Corrections block is one line instead of an empty heading and list. */
  englishNoCorrections: { variant: "english", state: "ready", model: englishNoCorrections, route: "/sessions/s3" },
  /** QA-14: typed talk, the subtitle says nothing about "Heard as". */
  englishTyped: { variant: "english", state: "ready", model: englishTyped, route: "/sessions/s3" },
  exampleContentFirst: { variant: "example", state: "ready", model: exampleSam, ui: { open: DEFAULT_OPEN.example }, route: "/sessions/example" },
  exampleDeliveryFirst: { variant: "example", state: "ready", model: exampleSam, layerOrder: "delivery-first", ui: { open: DEFAULT_OPEN.example }, route: "/sessions/example" },
  partial: { ...base, model: interviewPartial, ui: { open: DEFAULT_OPEN["s-partial"] }, route: "/sessions/s-partial" },
  loading: { ...base, state: "loading" },
  preparing: { ...base, state: "preparing" },
  storageNotWritable: { ...base, model: interviewS2, storageError: true, ui: { open: DEFAULT_OPEN.s2 } },
  notFound: { ...base, state: "notFound", route: "/sessions/gone" },
  error: { ...base, state: "error" },
  longText: { ...base, model: interviewLong, ui: { open: DEFAULT_OPEN["s-long"] }, route: "/sessions/s-long" },
} satisfies Record<string, DebriefSceneSpec>;
export type DebriefSceneId = keyof typeof DEBRIEF_SCENES;

/** The screen inside the shell, no frame around it (the review page and the stories bring their own). */
export function DebriefScene({ id }: { id: DebriefSceneId }) {
  const spec: DebriefSceneSpec = DEBRIEF_SCENES[id];
  const route = spec.route ?? "/sessions/s2";
  return (
    <MemoryRouter initialEntries={[route]}>
      <AppShellView current={null} currentSessionId={route.split("/").pop()} recent={SHELL_RECENT} engine={SHELL_ENGINE}>
        <DebriefView
          {...STATIC_ACTIONS}
          variant={spec.variant}
          state={spec.state ?? "ready"}
          model={spec.model}
          layerOrder={spec.layerOrder ?? "content-first"}
          ui={spec.ui}
          storageError={spec.storageError}
          notice={spec.notice}
        />
      </AppShellView>
    </MemoryRouter>
  );
}
