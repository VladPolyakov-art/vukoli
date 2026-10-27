import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./Button";
import { MicButton } from "./MicButton";
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

/** The rail's icon buttons (their name is the tooltip, so the native `title` is off). Each tip is forced open here;
 * in the app it shows on hover (after `--duration-slow`) or keyboard focus. Placements: the sidebar toggle `bottom-end`
 * expanded, `bottom-start` collapsed; New practice and Archive `bottom-start`; the engine warning and the account
 * `top-start` (they sit at the bottom of the rail, the tip opens upward). */
export const RailPlacements: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 11rem)", gap: "var(--space-4)", alignItems: "center", minHeight: "9rem", paddingBlock: "var(--space-8)" }}>
      <Tooltip content="Close sidebar" placement="bottom-end" open>
        <IconButton icon="sidebar" size="sm" label="Close sidebar" title={undefined} />
      </Tooltip>
      <Tooltip content="Open sidebar" placement="bottom-start" open>
        <IconButton icon="sidebar" size="sm" label="Open sidebar" title={undefined} />
      </Tooltip>
      <Tooltip content="New practice" placement="bottom-start" open>
        <IconButton icon="plus" size="sm" label="New practice" title={undefined} />
      </Tooltip>
      <Tooltip content="AI engine: Not ready" placement="top-start" open>
        <IconButton icon="alert" size="sm" label="AI engine: Not ready" title={undefined} />
      </Tooltip>
      <Tooltip content="Alex · Ollama" placement="top-start" open>
        <IconButton icon="user" size="sm" label="Alex. Account menu" title={undefined} />
      </Tooltip>
    </div>
  ),
};

/** The Session island status: "Question 2 of 5" and the timer carry the session context in a tooltip
 * (title · round · strictness), hover only. */
export const IslandStatus: StoryObj = {
  render: () => (
    <Tooltip content="Kestrel Pay · Senior Product Designer · Behavioural · Standard" open inline placement="top-start">
      <span style={{ display: "inline-flex", gap: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
        <span>Question 2 of 5</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>07:12</span>
      </span>
    </Tooltip>
  ),
};

/** `size="lg"` (D75): a message the user must notice — the muted-speech tip over the mic in a session. One line, 16 px, rounded. */
export const Large: StoryObj = {
  render: () => (
    <Tooltip content="You're talking, but the microphone is muted. Press M to unmute." open inline size="lg" placement="top-start">
      <MicButton label="Unmute" muted live />
    </Tooltip>
  ),
};

/** `disabled`: never shows, even on hover. The collapsed rail's account button while its menu is open. */
export const Disabled: StoryObj = {
  render: () => (
    <Tooltip content="Alex · Ollama" placement="top-start" disabled>
      <IconButton icon="user" size="sm" label="Alex. Account menu" title={undefined} />
    </Tooltip>
  ),
};
