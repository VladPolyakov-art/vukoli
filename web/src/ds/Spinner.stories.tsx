import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./Spinner";
import { TextShimmer } from "./TextShimmer";

/* The one use: `size="sm"` without a visible label, left of a shimmering line (the job-link fetch in the job
 * editor). The ring is decorative; the line next to it says what is happening. */
const meta: Meta<typeof Spinner> = { title: "DS/Spinner", component: Spinner };
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Small: Story = {
  args: { size: "sm" },
  render: (args) => (
    <p style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", margin: 0, fontSize: "var(--text-sm)" }}>
      <Spinner {...args} />
      <TextShimmer status>Opening the page…</TextShimmer>
    </p>
  ),
};
