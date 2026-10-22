import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./Spinner";

const meta: Meta<typeof Spinner> = { title: "DS/Spinner", component: Spinner };
export default meta;
type Story = StoryObj<typeof Spinner>;
export const WithLabel: Story = { args: { label: "Checking Ollama…" } };
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-4)" }}>
      <Spinner size="sm" srLabel="Loading" />
      <Spinner srLabel="Loading" />
      <Spinner size="lg" srLabel="Loading" />
    </div>
  ),
};
