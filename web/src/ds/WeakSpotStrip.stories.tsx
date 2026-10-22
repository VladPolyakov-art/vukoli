import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./Button";
import { Chip, ChipGroup } from "./Badge";
import { Icon } from "./icons";
import { WeakSpotStrip, type WeakSpot } from "./WeakSpotStrip";

/** Weak-spot strip (G18). `home` = monochrome rows in a subtle card + Show all + Focus chips; `debrief` = cards on
 * the layer tint (the only place tints appear). Items come in the configured layer order (GR8). */
const meta: Meta<typeof WeakSpotStrip> = { title: "DS/WeakSpotStrip", component: WeakSpotStrip, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof WeakSpotStrip>;

const HOME_ITEMS: WeakSpot[] = [
  { id: "w1", layer: "content", layerLabel: "Content", title: "No result in your answers", count: "4 answers in 2 sessions" },
  { id: "w2", layer: "content", layerLabel: "Content", title: "“we” instead of “I”", count: "3 answers" },
  { id: "w3", layer: "language", layerLabel: "Language", title: "“I have led” for finished projects", count: "2 answers" },
  { id: "w4", layer: "delivery", layerLabel: "Delivery", title: "Fillers: 9 per answer on average", count: "5 answers" },
];

function Footer() {
  const [focus, setFocus] = useState("All");
  const items: [string, number][] = [["All", 4], ["Content", 2], ["Language", 1], ["Delivery", 1]];
  return (
    <>
      <ChipGroup label="Focus" role="radio">
        {items.map(([n, c]) => <Chip key={n} role="radio" count={c} selected={focus === n} onClick={() => setFocus(n)}>{n}</Chip>)}
      </ChipGroup>
      <Button variant="secondary" icon="practice">Drill my weak spots</Button>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)" }}>3 questions aimed at all 4 · ~12 min · Kestrel Pay job</span>
    </>
  );
}

const HOME_ARGS = {
  context: "home" as const,
  items: HOME_ITEMS,
  title: "What to work on",
  sub: "From your last 2 interviews",
  headerAction: <Button variant="link" size="sm" iconRight="arrowRight">Last session: Kestrel Pay · Oct 19</Button>,
  moreText: "+ 2 more: Language “I have led” · Delivery fillers",
  showAllLabel: "Show all",
  showLessLabel: "Show less",
  footer: <Footer />,
};

export const Home: Story = { args: HOME_ARGS };
export const HomeExpanded: Story = { args: { ...HOME_ARGS, defaultExpanded: true } };
export const HomeLoading: Story = { args: { ...HOME_ARGS, loading: true, loadingLabel: "Loading your weak spots…" } };
export const HomeEmpty: Story = { args: { ...HOME_ARGS, items: [], footer: undefined, empty: "Weak spots and “Drill my weak spots” appear after your first interview." } };
/** Narrow parent (343px): rows wrap, the count drops under the title. */
export const HomeNarrow: Story = { args: HOME_ARGS, render: (args) => <div style={{ width: "21.4375rem" }}><WeakSpotStrip {...args} /></div> };

const q = (ns: number[]) => (
  <>
    <span>Questions</span>
    {ns.map((n) => <Button key={n} variant="link" size="sm" aria-label={`Question ${n}`}>{n}</Button>)}
  </>
);
const CONTENT: WeakSpot = {
  id: "d1", layer: "content", layerLabel: "Content", title: "No measurable result in 3 of 5 answers", evidence: q([1, 2, 4]),
  fix: <><strong>Fix:</strong> End every story with a number or a decision: “conversion stayed at 4.1%”, “we dropped the second screen”.</>,
  also: <><strong>Also:</strong> “we” instead of “I” in questions 2, 4 — say “I” for what you did.</>,
};
const LANGUAGE: WeakSpot = {
  id: "d2", layer: "language", layerLabel: "Language", title: "“I have led” for finished projects — 2 times", evidence: q([2, 5]),
  fix: <><strong>Fix:</strong> say “I led” when you name a finished time (“last spring”, “in 2023”).</>,
};
const DELIVERY: WeakSpot = {
  id: "d3", layer: "delivery", layerLabel: "Delivery", title: "9 fillers per answer on average", evidence: <><span>Most in question</span><Button variant="link" size="sm">4</Button><span>(12)</span></>,
  fix: <><strong>Fix:</strong> pause silently instead of “uh” and “like”.</>,
};
const DEBRIEF_ARGS = { context: "debrief" as const, title: "What to work on", sub: "One per layer, from this session.", items: [CONTENT, LANGUAGE, DELIVERY] };

export const DebriefContentFirst: Story = { args: DEBRIEF_ARGS };
export const DebriefDeliveryFirst: Story = { args: { ...DEBRIEF_ARGS, items: [DELIVERY, LANGUAGE, CONTENT] } };
export const DebriefLoading: Story = { args: { ...DEBRIEF_ARGS, loading: true, loadingLabel: "Writing your feedback…" } };
export const DebriefEmpty: Story = {
  args: { ...DEBRIEF_ARGS, items: [], empty: <span style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}><Icon name="check" size="sm" />Nothing major to fix in this session.</span> },
};
/** Narrow parent (343px): one column. Long titles wrap. */
export const DebriefNarrow: Story = {
  args: {
    ...DEBRIEF_ARGS,
    items: [{ ...CONTENT, title: "No measurable result in 3 of 5 answers: the stories stop at what you did, not what changed for merchants" }, LANGUAGE, DELIVERY],
  },
  render: (args) => <div style={{ width: "21.4375rem" }}><WeakSpotStrip {...args} /></div>,
};
