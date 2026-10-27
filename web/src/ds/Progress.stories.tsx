import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress, type ProgressProps } from "./Progress";

/* The one use: the Ollama model download (Settings → AI engine, Setup). The caller prints the same numbers
 * under the bar and passes them as `valueText` for screen readers. */
const meta: Meta<typeof Progress> = { title: "DS/Progress", component: Progress };
export default meta;
type Story = StoryObj<typeof Progress>;

const frame = (args: ProgressProps, line: string) => (
  <div style={{ display: "grid", gap: "var(--space-2)", maxWidth: 420 }}>
    <Progress {...args} />
    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{line}</p>
  </div>
);

export const Determinate: Story = {
  args: { label: "Model download", value: 0.42, valueText: "2.2 GB of 5.2 GB · 42%" },
  render: (args) => frame(args, "2.2 GB of 5.2 GB · 42%"),
};
/** Before the size is known: "Preparing the download…". */
export const Indeterminate: Story = {
  args: { label: "Model download", valueText: "Preparing the download…" },
  render: (args) => frame(args, "Preparing the download…"),
};
/** After the last byte: a full bar while the file is checked. */
export const Verifying: Story = {
  args: { label: "Model download", value: 1, valueText: "Checking the download…" },
  render: (args) => frame(args, "Checking the download…"),
};
