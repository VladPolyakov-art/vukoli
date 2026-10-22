import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./Skeleton";

const meta: Meta<typeof Skeleton> = { title: "DS/Skeleton", component: Skeleton };
export default meta;
type Story = StoryObj<typeof Skeleton>;

/** Text block: bars 100 / 86 / 62%, staggered 120ms. */
export const Lines: Story = { args: { variant: "lines", lines: 3 } };
/** The feedback-card ghost (session panel, debrief). */
export const CardShape: Story = { name: "Card", args: { variant: "card", lines: 3 } };
/** List rows (History, Trash, engine list). */
export const Rows: Story = { args: { variant: "row", rows: 3 } };
/** Rule 3: inside [data-motion-quiet] (the user is speaking) the sweep pauses. */
export const Quiet: Story = {
  render: () => (
    <div data-motion-quiet="true">
      <Skeleton variant="card" />
    </div>
  ),
};
