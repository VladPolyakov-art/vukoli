import type { Meta, StoryObj } from "@storybook/react-vite";
import { InlineRename } from "./InlineRename";

const meta: Meta = { title: "DS/InlineRename" };
export default meta;

const noop = () => {};

/** Size md: a chat row in the sidebar (Rename in the "…" menu). The field takes the row, `label="Chat name"`, `max` 80.
 * The Archive rows rename the same way (see ListRow → Renaming). Enter saves, Esc cancels. */
export const Medium: StoryObj = {
  render: () => (
    <div style={{ width: 208, padding: "var(--space-2)", background: "var(--color-sidebar)", borderRadius: "var(--radius-lg)" }}>
      <InlineRename value="Kestrel Pay · Senior Product Designer" label="Chat name" max={80} onSave={noop} onCancel={noop} autoFocus={false} />
    </div>
  ),
};

/** Size lg: the Debrief title (its H1), default label "Session title". */
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
