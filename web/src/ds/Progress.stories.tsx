import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "./Progress";

const meta: Meta<typeof Progress> = { title: "DS/Progress", component: Progress };
export default meta;
type Story = StoryObj<typeof Progress>;
export const Determinate: Story = { args: { label: "Downloading qwen3:8b", value: 0.42, valueText: "2.2 of 5.2 GB" } };
export const Indeterminate: Story = { args: { label: "Preparing the download" } };
export const Steps: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 420 }}>
      <Progress label="Empty" value={0} />
      <Progress label="A third" value={0.33} />
      <Progress label="Done" value={1} />
    </div>
  ),
};
