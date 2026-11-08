import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollStrip } from "./ScrollStrip";
import { TacticCard } from "./TacticCard";

/** ScrollStrip: a sideways strip of cards with chevrons, a counter and an edge fade. Used for the tactics on the
 * Tough talk plan cards. */
const meta: Meta<typeof ScrollStrip> = { title: "DS/ScrollStrip", component: ScrollStrip };
export default meta;
type Story = StoryObj<typeof ScrollStrip>;

const card = (n: number) => (
  <TacticCard
    key={n}
    as="li"
    size="tile"
    title={`Tactic ${n}`}
    rule="Give a range whose bottom is a figure you would happily accept."
    example="Based on the scope, I am looking at 95 to 110 thousand."
  />
);

export const Overflow: Story = {
  render: () => <div style={{ width: "34rem" }}><ScrollStrip label="Tactics for this call">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(card)}</ScrollStrip></div>,
};
export const Fits: Story = {
  render: () => <div style={{ width: "34rem" }}><ScrollStrip label="Tactics for this call">{[1, 2].map(card)}</ScrollStrip></div>,
};
export const Narrow: Story = {
  render: () => <div style={{ width: "20rem" }}><ScrollStrip label="Tactics for this call">{[1, 2, 3, 4].map(card)}</ScrollStrip></div>,
};
