import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "./Callout";
import { Button } from "./Button";

const meta: Meta<typeof Callout> = { title: "DS/Callout", component: Callout };
export default meta;
type Story = StoryObj<typeof Callout>;

export const Info: Story = { args: { title: "Data stays on this computer", children: "Ollama runs locally. Nothing is sent to the internet." } };
export const Warning: Story = {
  args: {
    tone: "warning",
    title: "Ollama is installed but not running",
    children: "Open the Ollama app, or run the command below in Terminal.",
    actions: <Button size="sm" icon="refresh">Check again</Button>,
  },
};
export const Error: Story = { args: { tone: "error", title: "Mike lost the connection", children: "Your answers so far are saved." } };
export const Success: Story = { args: { tone: "success", title: "It works", children: "Mike replied in 1.2 s." } };
