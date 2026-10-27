import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./icons";
import { WeakSpotStrip, type WeakSpot } from "./WeakSpotStrip";

/** Weak-spot strip (G18). The app uses only `context="debrief"` (screens/debrief/parts/Sections.tsx): cards on the layer
 * tint with the layer name, a title, the evidence question links and, since D98, the `said` ("What you said" / "Measured")
 * and `lands` ("How it lands") lines, then the fix, an optional `also` and an optional muted `note`. Any line left out
 * is not drawn. Items come in the configured layer order (GR8). The Home variant (`context="home"`, D47/Q2: no strip on
 * Home) has no stories; the prop stays in the component. */
const meta: Meta<typeof WeakSpotStrip> = { title: "DS/WeakSpotStrip", component: WeakSpotStrip, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof WeakSpotStrip>;

/** A labelled line inside a card: the label on its own line, the text under it (debrief `Line`). */
const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <span style={{ display: "block", color: "var(--color-text-secondary)", fontWeight: "var(--weight-semibold)" }}>{label}</span>
    {children}
  </>
);
const Quote = ({ children }: { children: string }) => <q style={{ quotes: '"\u201C" "\u201D"', color: "var(--color-text-primary)" }}>{children}</q>;
const Metric = ({ children }: { children: string }) => <span style={{ color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{children}</span>;
const Q = ({ n }: { n: number }) => <Button variant="link" size="sm" aria-label={`Go to question ${n}`}>{n}</Button>;

const CONTENT: WeakSpot = {
  id: "ws-content", layer: "content", layerLabel: "Content", title: "No measurable result in 3 of 5 answers",
  evidence: <>Questions <Q n={1} />, <Q n={2} />, <Q n={4} /></>,
  said: <Line label="What you said"><Quote>Last year I, like, rebuilt the onboarding and we got a lot of positive feedback.</Quote></Line>,
  lands: <Line label="How it lands">The interviewer can't tell if your work changed anything, so the story ends without a point.</Line>,
  fix: <Line label="How to fix">End every story with a number or a decision: “conversion stayed at 4.1%”, “we dropped the second screen”.</Line>,
  also: <><strong>Also:</strong> “we” instead of “I” in questions <Q n={2} />, <Q n={4} /> — say “I” for what you did.</>,
};
/** D98 r2 (GR9): the language spot says that words the app may have misheard are not counted. */
const LANGUAGE: WeakSpot = {
  id: "ws-language", layer: "language", layerLabel: "Language", title: "“I have led” for finished projects — 2 times",
  evidence: <>Questions <Q n={2} />, <Q n={5} /></>,
  said: <Line label="What you said"><Quote>I have led the redesign last spring</Quote></Line>,
  lands: <Line label="How it lands">Tense slips make it unclear whether this happened before or is still true.</Line>,
  fix: <Line label="How to fix">Say “I led” when you name a finished time (“last spring”, “in 2023”).</Line>,
  note: <>Words the app may have misheard are not counted. You can check them in <Button variant="link" size="sm">each question</Button>.</>,
};
/** A delivery number is measured, not said: the lead is "Measured" and there are no quotation marks. */
const DELIVERY: WeakSpot = {
  id: "ws-delivery", layer: "delivery", layerLabel: "Delivery", title: "9 fillers per answer on average",
  evidence: <>Most in question <Q n={4} /> <span>(12)</span></>,
  said: <Line label="Measured"><Metric>12 fillers in 3:40</Metric></Line>,
  lands: <Line label="How it lands">Many “um”s read as unsure, even when the content is strong.</Line>,
  fix: <Line label="How to fix">Pause silently instead of “uh” and “like”.</Line>,
};
const DEBRIEF_ARGS = { context: "debrief" as const, title: "What to work on", sub: "One per layer, from this session.", items: [CONTENT, LANGUAGE, DELIVERY] };

/** The debrief block with every D98 line: evidence, said / measured, lands, fix, also, and the language note. */
export const DebriefContentFirst: Story = { args: DEBRIEF_ARGS };
export const DebriefDeliveryFirst: Story = { args: { ...DEBRIEF_ARGS, items: [DELIVERY, LANGUAGE, CONTENT] } };
/** `said` as a quote and `lands` on one card only: the lines the card does not have are simply not drawn. */
export const DebriefSaidLands: Story = { args: { ...DEBRIEF_ARGS, sub: undefined, items: [CONTENT] } };
/** `note` (D98 r2): one muted line at the end of a card, here the Language "may have misheard" note. */
export const DebriefNote: Story = { args: { ...DEBRIEF_ARGS, sub: undefined, items: [LANGUAGE] } };
/** A session saved before D98 has no said / lands lines: evidence and fix only. */
export const DebriefNoDetail: Story = {
  args: {
    ...DEBRIEF_ARGS,
    items: [
      { ...CONTENT, said: undefined, lands: undefined, also: undefined },
      { ...LANGUAGE, said: undefined, lands: undefined, note: undefined },
      { ...DELIVERY, said: undefined, lands: undefined },
    ],
  },
};
/** Component states (the app hides the block while it loads or when it is empty). */
export const DebriefLoading: Story = { args: { ...DEBRIEF_ARGS, loading: true, loadingLabel: "Writing your feedback…" } };
export const DebriefEmpty: Story = {
  args: { ...DEBRIEF_ARGS, items: [], empty: <span style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}><Icon name="check" size="sm" />Nothing major to fix</span> },
};
/** Narrow parent (343px): one column. Long titles wrap. */
export const DebriefNarrow: Story = {
  args: {
    ...DEBRIEF_ARGS,
    items: [{ ...CONTENT, title: "No measurable result in 3 of 5 answers: the stories stop at what you did, not what changed for merchants" }, LANGUAGE, DELIVERY],
  },
  render: (args) => <div style={{ width: "21.4375rem" }}><WeakSpotStrip {...args} /></div>,
};
