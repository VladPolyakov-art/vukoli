import type { Meta, StoryObj } from "@storybook/react-vite";
import { TacticCard } from "./TacticCard";

/** TacticCard (tough-talk): one tactic. `tile` sits in a ScrollStrip on the plan card, `hint` fills the Suggester slot
 * in a live session, `inline` is a plain Disclosure in a debrief. Texts come from the server content endpoint. */
const meta: Meta<typeof TacticCard> = {
  title: "DS/TacticCard",
  component: TacticCard,
  args: {
    title: "Anchor with a range, not a number",
    rule: "Give a range whose bottom is a figure you would happily accept.",
    example: "Based on the scope, I am looking at 95 to 110 thousand.",
    evidence: "Anchoring study, Galinsky and Mussweiler, 2001.",
  },
};
export default meta;
type Story = StoryObj<typeof TacticCard>;

export const Tile: Story = { args: { size: "tile" } };
export const Hint: Story = {
  args: { size: "hint", evidence: undefined, onHide: () => {}, alt: { title: "Softer", example: "I would be comfortable with something around 100 thousand." } },
};
export const HintWithoutAlt: Story = { args: { size: "hint", evidence: undefined, onHide: () => {} } };
export const Inline: Story = { args: { size: "inline" } };
export const LongText: Story = {
  args: {
    size: "tile",
    title: "A very long tactic title that should wrap onto several lines without breaking the card layout at all",
    example: "Averyveryveryverylongunbrokenwordthatmustwrapinsidethecardandnotoverflowit and then more words after it.",
  },
  render: (args) => <div style={{ width: "16rem" }}><TacticCard {...args} /></div>,
};
