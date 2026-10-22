import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox } from "./Checkbox";

/** Checkbox (G7). Checked = --color-checked fill (not the action colour). `chip` variant for compact multi-select. */
const meta: Meta<typeof Checkbox> = { title: "DS/Checkbox", component: Checkbox, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = { args: { label: "Ask follow-up questions" } };
export const Checked: Story = { args: { label: "Ask follow-up questions", defaultChecked: true } };
export const WithDescription: Story = {
  args: { label: "Save transcripts", description: "Kept on this computer only. Delete them any time in Storage.", defaultChecked: true },
};
export const Indeterminate: Story = { args: { label: "All stories", indeterminate: true } };
export const Disabled: Story = { args: { label: "Use cloud speech recognition", description: "Not available offline.", disabled: true } };
export const DisabledChecked: Story = { args: { label: "Save on this computer", disabled: true, defaultChecked: true } };
export const Error: Story = { args: { label: "Checkout redesign at Kestrel Pay", error: "Keep at least one story." } };
export const Overflow: Story = {
  args: { label: "Redesigned the merchant checkout consent step two weeks before launch, shipped on time without losing conversion" },
  render: (args) => <div style={{ width: "17.5rem" }}><Checkbox {...args} /></div>,
};

function Chips() {
  const [on, setOn] = useState<string[]>(["Checkout redesign"]);
  const all = ["Checkout redesign", "Design system migration", "Merchant onboarding", "Disagreement with PM"];
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <legend className="visually-hidden">Stories to practise</legend>
      {all.map((x) => (
        <Checkbox
          key={x}
          variant="chip"
          label={x}
          checked={on.includes(x)}
          onChange={(e) => setOn(e.target.checked ? [...on, x] : on.filter((y) => y !== x))}
        />
      ))}
    </fieldset>
  );
}
export const ChipVariant: Story = { render: () => <Chips /> };
