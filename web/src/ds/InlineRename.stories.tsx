import type { Meta, StoryObj } from "@storybook/react-vite";
import { InlineRename } from "./InlineRename";

const meta: Meta = { title: "DS/InlineRename" };
export default meta;

const noop = () => {};

/** Size md: a History row. Enter saves, Esc cancels. */
export const Medium: StoryObj = {
  render: () => (
    <div style={{ width: 560, maxWidth: "100%" }}>
      <InlineRename value="Lumen Health · HR screen, first try" onSave={noop} onCancel={noop} autoFocus={false} />
    </div>
  ),
};

/** Size lg: the Debrief H1. */
export const Large: StoryObj = {
  render: () => (
    <div style={{ width: 720, maxWidth: "100%" }}>
      <InlineRename size="lg" value="Kestrel Pay · Senior Product Designer" onSave={noop} onCancel={noop} autoFocus={false} />
    </div>
  ),
};

/** Empty title: the error stays until there is text (US-21 AC2). */
export const EmptyError: StoryObj = {
  render: () => (
    <div style={{ width: 560, maxWidth: "100%" }}>
      <InlineRename value="" initialError onSave={noop} onCancel={noop} autoFocus={false} />
    </div>
  ),
};
