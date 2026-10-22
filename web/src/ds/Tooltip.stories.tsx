import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./Button";
import { Tooltip } from "./Tooltip";

const meta: Meta = { title: "DS/Tooltip" };
export default meta;

const long = "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools";

/** Open and static (gallery, review): the full text of a cut title. */
export const Open: StoryObj = {
  render: () => (
    <div style={{ width: 240 }}>
      <Tooltip content={long} open inline block>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--text-sm)" }}>{long}</span>
      </Tooltip>
    </div>
  ),
};

/** Only when truncated: hover or focus the first link (cut) — the second fits and shows nothing. */
export const OnlyWhenTruncated: StoryObj = {
  render: () => (
    <div style={{ width: 240, display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
      {[long, "Kestrel Pay · Interview"].map((title) => (
        <Tooltip key={title} content={title} onlyWhenTruncated block placement="bottom-start">
          <a href="#row" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-primary)" }} data-truncate="">{title}</a>
        </Tooltip>
      ))}
    </div>
  ),
};

/** A short label on an icon button (describes it: aria-describedby). Delay on hover, none on keyboard focus. */
export const OnIconButton: StoryObj = {
  render: () => (
    <Tooltip content="Saved on this computer only">
      <IconButton icon="lock" label="Storage" />
    </Tooltip>
  ),
};

/** `size="lg"` (D75): a message the user must notice — the muted-speech tip over the mic in a session. One line, 16 px, rounded. */
export const Large: StoryObj = {
  render: () => (
    <Tooltip content="You're talking, but the microphone is muted. Press M to unmute." open inline size="lg">
      <IconButton icon="micOff" label="Unmute" />
    </Tooltip>
  ),
};
