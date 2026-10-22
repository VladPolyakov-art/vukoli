import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyField } from "./CopyField";

const meta: Meta<typeof CopyField> = { title: "DS/CopyField", component: CopyField };
export default meta;
export const Command: StoryObj<typeof CopyField> = {
  args: { value: "ollama pull qwen3:4b-instruct", copyLabel: "Copy command", copiedLabel: "Copied", label: "Command" },
};
/** QA-09: a long path scrolls sideways; the box takes keyboard focus (Tab) so the arrow keys reach the end. */
export const LongPath: StoryObj<typeof CopyField> = {
  args: {
    value: "/Users/alex.morgan/Library/Application Support/Vukoli/data/sessions/2026-10-21-kestrel-pay-product-manager-round-one",
    copyLabel: "Copy",
    copiedLabel: "Copied",
    label: "Data folder",
  },
  decorators: [(Story) => <div style={{ width: "21.4375rem" }}><Story /></div>],
};
