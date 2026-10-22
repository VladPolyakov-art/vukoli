import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

const meta: Meta<typeof EmptyState> = { title: "DS/EmptyState", component: EmptyState };
export default meta;
export const History: StoryObj<typeof EmptyState> = {
  args: {
    icon: "history",
    title: "No rounds yet",
    children: "Your first practice round will show up here with its debrief.",
    actions: <Button variant="primary" icon="mic">Start a round</Button>,
  },
};
