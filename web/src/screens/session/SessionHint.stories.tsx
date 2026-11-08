import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { OverlayRoot } from "../../ds/OverlayRoot";
import { fixtureProps } from "./fixtures";
import { SessionView } from "./SessionView";
import { talkStepsModel } from "./talkSteps";
import type { SessionHint, SessionViewProps } from "./types";

/* Screens/Session hint: the Tough talk Hint button in the island, the hint card under the transcript and the first-time
 * tips of the two modes (ds/screens/tough-talk.md §4). Negotiate counts turns (no "Next question"); Tough counts questions. */
type Frame = "desktop" | "mobile";
interface Args { frame: Frame }
const SIZE: Record<Frame, [number, number]> = { desktop: [1440, 900], mobile: [375, 812] };
const meta: Meta<Args> = { title: "Screens/Session hint", parameters: { layout: "wide" }, args: { frame: "desktop" }, argTypes: { frame: { control: "inline-radio", options: ["desktop", "mobile"] } } };
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

const closed: SessionHint = { available: true, open: false, used: 0 };
const NEGOTIATE_CARD: SessionHint["card"] = {
  id: "N6", title: "Bridge the gap with a step-up",
  text: "When the base is stuck, ask for a raise at a date, with goals named, written into the offer letter.",
  example: "Could we agree a step to 98,000 after six months, with the goals written into the offer?",
};
const TOUGH_CARD: SessionHint["card"] = {
  id: "T1", title: "Short, calm, back to the job", text: "Answer in two sentences, then steer to the work.",
  shape: "The reason in one sentence, then what you want next.", example: "I left because the role changed. What I want now is more product ownership.",
};

function story(name: string, patch: (p: SessionViewProps) => SessionViewProps): Story {
  return {
    name,
    render: ({ frame }) => {
      const [w, h] = SIZE[frame];
      return <Scaled key={`${frame}:${name}`} width={w} height={h}><SessionView {...patch(fixtureProps({ scene: "text" }))} /></Scaled>;
    },
  };
}
const negotiate = (p: SessionViewProps, hint: SessionHint, phase: SessionViewProps["phase"] = "your-turn"): SessionViewProps => ({
  ...p, variant: "negotiate", input: "text", phase,
  data: { ...p.data, title: "Negotiation · Product Designer · Friendly", sub: undefined, progress: "Turn 4", step: undefined, nextNumber: null, hint },
});
const tough = (p: SessionViewProps, hint: SessionHint, phase: SessionViewProps["phase"] = "your-turn"): SessionViewProps => ({
  ...p, variant: "tough", input: "text", phase, data: { ...p.data, title: "Tough questions · Why you left", hint },
});

/** Negotiate N9: the card open on the user's turn, a Try saying line, the Hint button pressed. */
export const NegotiateHintShown = story("Negotiate · hint shown", (p) => negotiate(p, { available: true, open: true, used: 1, card: NEGOTIATE_CARD }));
/** The Hint button while Mike speaks: it works (a hint can be asked at any time Mike is not thinking). */
export const NegotiateHintButton = story("Negotiate · hint button", (p) => negotiate(p, closed, "mike-speaking"));
/** While the user speaks the button is disabled; the tooltip says why. */
export const NegotiateHintWaits = story("Negotiate · hint waits while you speak", (p) => negotiate(p, closed, "listening"));
/** Negotiation v3 (P7): the steps strip above the island, when the course was taken. */
export const NegotiateStepsObjection = story("Negotiate · steps strip, step 3 Objection", (p) => ({ ...negotiate(p, closed, "mike-speaking"), data: { ...negotiate(p, closed, "mike-speaking").data, talkSteps: talkStepsModel(3, "offer")! } }));
export const NegotiateStepsRaise = story("Negotiate · steps strip, raise, step 1", (p) => ({ ...negotiate(p, closed, "your-turn"), data: { ...negotiate(p, closed, "your-turn").data, talkSteps: talkStepsModel(1, "raise")! } }));
export const NegotiateFirstTime = story("Negotiate · first-time tips", (p) => ({ ...negotiate(p, closed, "mike-speaking"), firstTime: true }));

/** Tough: the card shows the answer-shape line as its rule. */
export const ToughHintShown = story("Tough · hint shown", (p) => tough(p, { available: true, open: true, used: 1, card: TOUGH_CARD }));
export const ToughHintButton = story("Tough · hint button", (p) => tough(p, closed));
export const ToughFirstTime = story("Tough · first-time tips", (p) => ({ ...tough(p, closed, "mike-speaking"), firstTime: true }));
