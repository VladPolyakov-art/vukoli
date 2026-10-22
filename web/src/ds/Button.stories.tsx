import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, IconButton } from "./Button";

const meta: Meta<typeof Button> = { title: "DS/Button", component: Button, args: { children: "Start interview" } };
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: "primary", icon: "mic" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Type instead", icon: "keyboard" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };
export const Link: Story = { args: { variant: "link", children: "Step-by-step help", iconRight: "external" } };
export const Danger: Story = { args: { variant: "danger", children: "Delete", icon: "trash" } };
export const Loading: Story = { args: { variant: "primary", loading: true, children: "Checking…" } };
export const Disabled: Story = { args: { variant: "primary", disabled: true } };
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
      <Button size="sm">Small</Button>
      <Button>Medium</Button>
      <Button size="lg" variant="primary">Large</Button>
    </div>
  ),
};
export const IconButtons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <IconButton icon="copy" label="Copy" />
      <IconButton icon="micOff" label="Mute" outlined pressed />
      <IconButton icon="x" label="Close" size="sm" />
    </div>
  ),
};
/* 13, QA-01: `dot` marks something new behind the button (the Session's feedback toggle when feedback is ready). */
export const IconButtonWithDot: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      <IconButton icon="panel" label="Show feedback (F), new feedback is ready" dot />
      <IconButton icon="panel" label="Show feedback (F)" />
      <IconButton icon="panel" label="Hide feedback (F)" pressed />
      <IconButton icon="panel" label="Show feedback (F), new feedback is ready" size="sm" dot />
    </div>
  ),
};
