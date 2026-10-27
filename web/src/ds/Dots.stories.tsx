import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dots } from "./Dots";

/** Grey 3-dot loader and the shimmering connecting pill (G12). Dots carry `.motion-loop`: they pause in quiet mode
 * (while the user speaks) and stop under reduced motion. */
const meta: Meta<typeof Dots> = { title: "DS/Dots", component: Dots, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Dots>;

/** The transcript while Mike replies (label for screen readers only). */
export const Default: Story = { args: { label: "Mike is replying" } };
/** The session island while the feedback is prepared (visible label). */
export const WithLabel: Story = { args: { label: "Preparing feedback", showLabel: true } };
/** Connecting pill (G12): Home Start and Session start, before Mike's first word. The label always shimmers in the app. */
export const ConnectingPill: Story = { args: { variant: "pill", shimmer: true, label: "Connecting to Mike…" } };
/** The session island on a narrow screen: the pill fills the dock. */
export const ConnectingPillFullWidth: Story = {
  args: { variant: "pill", shimmer: true, label: "Connecting to Mike…", fullWidth: true },
  render: (args) => <div style={{ width: "21.4375rem" }}><Dots {...args} /></div>,
};
/** Long label in a narrow parent: ellipsis, the pill keeps one line. */
export const PillOverflow: Story = {
  args: { variant: "pill", shimmer: true, label: "Loading qwen3:4b into memory, this can take a minute the first time…", fullWidth: true },
  render: (args) => <div style={{ width: "17.5rem" }}><Dots {...args} /></div>,
};
/** Quiet mode: the user is speaking, loops pause. */
export const Quiet: Story = {
  args: { label: "Preparing feedback", showLabel: true },
  render: (args) => <div data-motion-quiet="true"><Dots {...args} /></div>,
};
