import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dots } from "./Dots";

/** Grey 3-dot loader and the connecting pill (G12). Dots carry `.motion-loop`: they pause in quiet mode
 * (while the user speaks) and stop under reduced motion. */
const meta: Meta<typeof Dots> = { title: "DS/Dots", component: Dots, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Dots>;

export const Default: Story = { args: { label: "Mike is preparing an answer" } };
export const WithLabel: Story = { args: { label: "Mike is preparing an answer", showLabel: true } };
/** Connecting pill (G12): Session start, before Mike's first word. */
export const ConnectingPill: Story = { args: { variant: "pill", label: "Connecting to Mike…" } };
export const ConnectingPillShimmer: Story = { args: { variant: "pill", label: "Connecting to Mike…", shimmer: true } };
export const ConnectingPillFullWidth: Story = {
  args: { variant: "pill", label: "Connecting to Mike…", fullWidth: true },
  render: (args) => <div style={{ width: "21.4375rem" }}><Dots {...args} /></div>,
};
/** Long label in a narrow parent: ellipsis, the pill keeps one line. */
export const PillOverflow: Story = {
  args: { variant: "pill", label: "Loading qwen3:4b into memory, this can take a minute the first time…", fullWidth: true },
  render: (args) => <div style={{ width: "17.5rem" }}><Dots {...args} /></div>,
};
/** Quiet mode: the user is speaking, loops pause. */
export const Quiet: Story = {
  args: { label: "Mike is preparing an answer", showLabel: true },
  render: (args) => <div data-motion-quiet="true"><Dots {...args} /></div>,
};
