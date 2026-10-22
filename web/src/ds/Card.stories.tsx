import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Card, SelectableCard, SelectableCardGroup } from "./Card";

const meta: Meta<typeof Card> = { title: "DS/Card", component: Card, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Card>;

export const Raised: Story = { args: { children: "Kestrel Pay · Senior Product Designer" } };
export const Subtle: Story = { args: { tone: "subtle", children: "Feedback appears here after each question." } };
export const Flat: Story = { args: { tone: "flat", children: "Saved on this computer" } };
/** Toggle cards (`aria-pressed`): selected = 2px border + check icon, never an action colour. */
export const Selectable: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 16rem))", gap: "var(--space-3)" }}>
      <SelectableCard selected>Kestrel Pay<br />Added Oct 18</SelectableCard>
      <SelectableCard>Lumen Health<br />Added Oct 15</SelectableCard>
      <SelectableCard disabled>Fieldnote<br />Preparing questions…</SelectableCard>
    </div>
  ),
};

const LEVELS = [
  { id: "A2", text: "Everyday topics, slow pace" },
  { id: "B1", text: "Familiar topics, more corrections" },
  { id: "B2", text: "Work topics, natural pace" },
  { id: "C1", text: "Complex topics, only subtle corrections" },
];

function Levels({ columns = 4 as 1 | 2 | 3 | 4, initial = "B1" as string | null }) {
  const [level, setLevel] = useState<string | null>(initial);
  return (
    <SelectableCardGroup label="Your level" columns={columns} description="Not sure? Pick B1 if you can talk about familiar things but often search for words.">
      {LEVELS.map((l) => (
        <SelectableCard key={l.id} role="radio" padding="sm" selected={level === l.id} onSelect={() => setLevel(l.id)}>
          <span style={{ display: "block", fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>{l.id}</span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{l.text}</span>
        </SelectableCard>
      ))}
    </SelectableCardGroup>
  );
}
/** Radio group (G8): one Tab stop, arrows move and select, Home / End. */
export const RadioGroup: Story = { render: () => <Levels /> };
export const RadioGroupNothingSelected: Story = { render: () => <Levels initial={null} /> };
/** Narrow parent (343px, the 375 frame): 4 columns drop to 2. */
export const RadioGroupNarrow: Story = { render: () => <div style={{ width: "21.4375rem" }}><Levels /></div> };
/** Very narrow parent (280px): 1 column. */
export const RadioGroupVeryNarrow: Story = { render: () => <div style={{ width: "17.5rem" }}><Levels /></div> };
/** Long content wraps inside the card; the check icon keeps its corner. */
export const Overflow: Story = {
  render: () => (
    <div style={{ width: "20rem" }}>
      <SelectableCard selected>
        Kestrel Pay · Senior Product Designer, Merchant Checkout and Payments Experience (web and mobile) · Added Oct 18
      </SelectableCard>
    </div>
  ),
};
