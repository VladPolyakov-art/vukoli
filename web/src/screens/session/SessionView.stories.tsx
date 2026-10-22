import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { OverlayRoot } from "../../ds/OverlayRoot";
import { fixtureProps, type FixtureOptions } from "./fixtures";
import { SessionPreview } from "./SessionPreview";
import type { SessionViewProps } from "./types";

/* Screens/Session: one story per state of ds/screens/session.md §4 (S1 to S14), with the v2 island (§V2) and the
 * V2.1 running transcript + Presence glow (D49). Each is a
 * frame of a real width scaled to fit, with its own OverlayRoot (the sheet and the dialog open inside it), the same
 * set-up as the review page.
 * The `frame` control switches 1440 / 900 / 768 / 375. */
type Frame = "desktop" | "mid" | "tablet" | "mobile";
interface Args extends Omit<FixtureOptions, "scene"> { frame: Frame }
const SIZE: Record<Frame, [number, number]> = { desktop: [1440, 900], mid: [900, 700], tablet: [768, 1024], mobile: [375, 812] };

const meta: Meta<Args> = {
  title: "Screens/Session",
  parameters: { layout: "wide" },
  args: { frame: "desktop", layerOrder: "content-first", withChecks: true },
  argTypes: {
    frame: { control: "inline-radio", options: ["desktop", "mid", "tablet", "mobile"] },
    layerOrder: { control: "inline-radio", options: ["content-first", "delivery-first"] },
  },
};
export default meta;
type Story = StoryObj<Args>;

function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
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
    <div ref={outer} style={{ width: "100%", maxWidth: width, height: height * scale, overflow: "hidden", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden", background: "var(--color-canvas)" }}>
        <OverlayRoot>{children}</OverlayRoot>
      </div>
    </div>
  );
}

function scene(name: string, sceneId: FixtureOptions["scene"], extra: Partial<Story> = {}, view: Partial<SessionViewProps> = {}): Story {
  return {
    name,
    ...extra,
    render: ({ frame, layerOrder, withChecks }) => {
      const [w, h] = SIZE[frame];
      return (
        <Scaled key={`${frame}:${sceneId}:${layerOrder}:${withChecks}`} width={w} height={h}>
          <SessionPreview {...fixtureProps({ scene: sceneId, layerOrder, withChecks })} {...view} />
        </Scaled>
      );
    },
  };
}

/* A scene with a patch on top of its fixture props, for the live-only states (D94): the interrupted card for another
 * engine, Resume in flight or failed, both banners together. */
function patched(name: string, sceneId: FixtureOptions["scene"], patch: (p: SessionViewProps) => SessionViewProps): Story {
  return {
    name,
    render: ({ frame, layerOrder, withChecks }) => {
      const [w, h] = SIZE[frame];
      return (
        <Scaled key={`${frame}:${sceneId}:${layerOrder}:${withChecks}:${name}`} width={w} height={h}>
          <SessionPreview {...patch(fixtureProps({ scene: sceneId, layerOrder, withChecks }))} />
        </Scaled>
      );
    },
  };
}
const withInterrupted = (p: SessionViewProps, interrupted: NonNullable<SessionViewProps["data"]["interrupted"]>): SessionViewProps =>
  ({ ...p, data: { ...p.data, interrupted } });

export const S1QuestionOne = scene("S1 · Question 1, tips, Mike speaking", "q1-start");
export const S2FollowUp = scene("S2 · Mike asks the follow-up", "follow-up");
export const S3Listening = scene("S3 · You are speaking (quiet mode)", "listening");
export const S3bListeningHintGone = scene("S3b · Listening, the hint folded away (D91)", "listening", {}, { hintMs: 1 });
export const S14d2SuggesterListening = scene("S14d2 · Suggester on while you speak (D91)", "suggester", {}, { phase: "listening", hintMs: 1 });
export const S4Thinking = scene("S4 · Thinking", "thinking");
export const S5aFeedbackContentFirst = scene("S5a · Feedback, content first, with a check", "feedback");
export const S5bFeedbackDeliveryFirst = scene("S5b · Feedback, delivery first", "feedback", { args: { layerOrder: "delivery-first" } });
export const S5cThatsNotWhatISaid = scene("S5c · That's not what I said", "that-not-said");
export const S5dEditWhatISaid = scene("S5d · Edit what I said", "edit");
export const S5eEditFailed = scene("S5e · Edit what I said, the check failed", "edit-failed");
export const S5fRechecking = scene("S5f · Checking the edited answer again", "rechecking");
export const S6TextMode = scene("S6 · Text mode", "text", { args: { withChecks: false } });
export const S7Drill = scene("S7 · Drill, Question 1 of 3", "drill");
export const S8English = scene("S8 · English, Turn 4", "english");
export const S9Connecting = scene("S9 · Connecting", "connecting");
export const S10aInterruptedEngine = scene("S10a · Interrupted: engine", "interrupted-engine");
export const S10bInterruptedVoice = scene("S10b · Interrupted: voice", "interrupted-voice");
export const S10cInterruptedOtherEngine = patched("S10c · Interrupted: Claude, ready to resume", "interrupted-engine", (p) => withInterrupted(p, { engine: "claude_cli", input: "voice", canResume: true }));
export const S10dResuming = patched("S10d · Interrupted: resuming", "interrupted-voice", (p) => withInterrupted(p, { input: "voice", canResume: true, resuming: true }));
export const S10eResumeFailed = patched("S10e · Interrupted: resume failed", "interrupted-voice", (p) => withInterrupted(p, { input: "voice", canResume: true, failed: "" }));
export const S10fInterruptedGemini = patched("S10f · Interrupted: Gemini Live, text only", "interrupted-voice", (p) => withInterrupted(p, { engine: "gemini_live", input: "voice", canResume: false }));
export const S11MicHelp = scene("S11 · Mic help dialog", "mic-help");
export const S12aStorageBanner = scene("S12a · Storage not writable", "storage");
export const S12bBrowserBanner = scene("S12b · Browser can't recognise speech", "browser");
export const S11bMicHelpNoMic = scene("S11b · Mic help: no microphone found (opens by itself)", "mic-help", {}, { micHelpReason: "none" });
export const S12cBothBanners = patched("S12c · Storage and browser banners together", "storage", (p) => ({ ...p, overlay: "none", banners: { browser: true, storage: true } }));
export const S13Overflow = scene("S13 · Overflow +30%", "overflow");
export const S14aPreparing = scene("S14a · Preparing feedback", "preparing");
export const S14bUnavailable = scene("S14b · Feedback unavailable", "unavailable");
export const S14eLayersUnavailable = scene("S14e · Content and Language unavailable, Delivery still reports", "layers-unavailable");
export const S14cMuted = scene("S14c · Muted", "muted");
export const S14c2MutedTalking = scene("S14c2 · Talking while muted: tip over the mic", "muted-talking");
export const S14dSuggester = scene("S14d · Answer suggester on", "suggester");

/* First-time tips name where feedback opens: right (wide), slides in from the right (mid), slides up (phone). */
export const S1TipsMid = scene("Mid · First-time tips (text)", "q1-start", { args: { frame: "mid" } }, { input: "text" });
export const S1TipsNarrow = scene("Narrow · First-time tips (text)", "q1-start", { args: { frame: "mobile" } }, { input: "text" });
export const S1TipsWideText = scene("S1 · First-time tips (text)", "q1-start", {}, { input: "text" });
/* 13 (F-13-9): English has turns, not questions: the tip says "after each turn" in all three layouts. */
export const S8TipsEnglishWide = scene("English · First-time tips, wide (text)", "q1-start", {}, { input: "text", variant: "english" });
export const S8TipsEnglishMid = scene("English · First-time tips, mid (text)", "q1-start", { args: { frame: "mid" } }, { input: "text", variant: "english" });
export const S8TipsEnglishNarrow = scene("English · First-time tips, narrow (text)", "q1-start", { args: { frame: "mobile" } }, { input: "text", variant: "english" });

/* The same feedback on a phone and in the mid layout: bottom sheet and right drawer. */
export const NarrowFeedback = scene("Narrow · Feedback sheet", "feedback", { args: { frame: "mobile" } });
export const MidFeedback = scene("Mid · Feedback drawer", "feedback", { args: { frame: "mid" } });

/* v2 island (session.md §V2.9). */
export const S1IslandMoreOpen = scene("S1 · Island, More menu open", "q1-start", {}, { initialOverlay: "more" });
export const S5PanelHidden = scene("S5 · Feedback ready, panel hidden", "feedback", {}, { panelOpen: false });
/* 13 (QA-01): feedback is ready and the panel is closed: a dot on the toggle (always so on mid and narrow). */
export const S5FeedbackReadyDot = scene("S5 · Feedback ready, dot on the toggle", "feedback", {}, { panelOpen: false, feedbackUnread: true });
export const MidFeedbackReadyDot = scene("Mid · Feedback ready, dot on the toggle", "feedback", { args: { frame: "mid" } }, { panelOpen: false, feedbackUnread: true });
export const NarrowFeedbackReadyDot = scene("Narrow · Feedback ready, dot on the toggle", "feedback", { args: { frame: "mobile" } }, { panelOpen: false, feedbackUnread: true });
export const S6TextIsland = scene("S6 · Text mode island (box)", "text", { args: { withChecks: false } });
export const Shortcuts = scene("Keyboard shortcuts dialog", "feedback", {}, { initialOverlay: "shortcuts" });
/* 13 (QA-10): the text-mode island on a phone: status and End on row 1, the tools on row 2. */
export const S6TextIslandPhone = scene("Narrow · Text mode island, two rows", "text", { args: { frame: "mobile", withChecks: false } });
export const NarrowIsland = scene("Narrow · Island, two rows", "listening", { args: { frame: "mobile" } }, { panelOpen: false });

/* v2.1 (D49): running transcript + Presence glow. */
export const S2YourTurnWaiting = scene("S2 · Your turn (voice), faint glow", "follow-up", {}, { phase: "your-turn" });
export const S2Reading = scene("S2 · Reading above: Jump to latest", "feedback", {}, { initialFollow: "reading", panelOpen: false });
export const ReducedSpeaking = scene("Reduced motion · Speaking", "q1-start", {}, { reducedMotion: true });
export const ReducedListening = scene("Reduced motion · Listening", "listening", {}, { reducedMotion: true });
export const ReducedThinking = scene("Reduced motion · Thinking", "thinking", {}, { reducedMotion: true });
