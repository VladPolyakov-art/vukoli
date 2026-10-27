import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

/** Checkbox (G7). Checked = --color-checked fill (not the action colour). The app uses one: the telemetry opt-in in Setup. */
const meta: Meta<typeof Checkbox> = { title: "DS/Checkbox", component: Checkbox, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Checkbox>;

const LABEL = "Share anonymous usage counts to help improve the app";

export const Unchecked: Story = { args: { label: LABEL } };
export const Checked: Story = { args: { label: LABEL, defaultChecked: true } };
/** The real use (Setup → Voice check): label + description. */
export const WithDescription: Story = {
  args: {
    label: LABEL,
    description: "Counts, timings, engine names and error codes. Never what you said or wrote. Today nothing leaves this computer.",
  },
  render: (args) => <div style={{ maxWidth: "36rem" }}><Checkbox {...args} /></div>,
};
