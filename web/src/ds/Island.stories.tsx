import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button, IconButton } from "./Button";
import { Composer } from "./Composer";
import { Dots } from "./Dots";
import { Island, type IslandGroup } from "./Island";
import { MicButton } from "./MicButton";

/** Island (G21): the Session's one control surface (replaces the v1 top bar + dock). Groups: status · voice · tools ·
 * exit, separated by hairlines. A fixed set of controls: disabled, never hidden. `box` = text mode, `stacked` = phones. */
const meta: Meta<typeof Island> = { title: "DS/Island", component: Island, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Island>;

const status = (n = "2 of 5", time = "07:12"): IslandGroup => ({
  id: "status",
  label: "Status",
  children: (
    <span style={{ display: "inline-flex", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
      <span aria-label={`Question ${n}`}>{n}</span><span aria-hidden="true">·</span><span>{time}</span>
    </span>
  ),
});
const tools = (feedbackOn = false, feedbackDisabled = false): IslandGroup => ({
  id: "tools",
  label: "Tools",
  children: (
    <>
      <IconButton icon="redo" label="Redo answer (R)" />
      <IconButton icon="keyboard" label="Type instead (T)" />
      <IconButton icon="panel" label="Show feedback (F)" pressed={feedbackOn} disabled={feedbackDisabled} />
    </>
  ),
});
const exit: IslandGroup = {
  id: "exit",
  label: "Exit",
  children: (
    <>
      <IconButton icon="more" label="More" />
      <Button variant="secondary" icon="stop">End</Button>
    </>
  ),
};

/** Your turn (S5): mic live, "Next question" is the one primary, the feedback panel is open. */
export const Voice: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status(),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute (M)" muted={false} live level={0.4} /><Button variant="primary">Next question</Button></> },
        tools(true),
        exit,
      ]}
    />
  ),
};

/** Mike is thinking (S4): the main slot shows a dots pill; feedback is disabled with its reason in the tooltip. */
export const Thinking: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status(),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute (M)" muted={false} live={false} /><Dots variant="pill" label="Thinking" showLabel /></> },
        tools(false, true),
        exit,
      ]}
    />
  ),
};

function TextBox() {
  const [v, setV] = useState("");
  return (
    <div style={{ width: "var(--layout-narrow)", maxWidth: "100%" }}>
      <Island
        label="Session controls"
        shape="box"
        lead={(
          <Composer surface="none" label="Your answer" placeholder="Type your answer" minRows={1} maxRows={6} submitOnEnter value={v}
            onChange={(e) => setV(e.target.value)} send={{ label: "Send", icon: "send", disabled: !v.trim(), onSend: () => setV("") }} />
        )}
        groups={[
          status(),
          { id: "tools", label: "Tools", grow: true, children: <><IconButton icon="redo" label="Redo answer (R)" /><IconButton icon="mic" label="Switch to voice" /><IconButton icon="panel" label="Show feedback (F)" /></> },
          exit,
        ]}
      />
    </div>
  );
}
/** Text mode (S6): the island becomes a box; the Composer has no own surface. */
export const TextMode: Story = { render: () => <TextBox /> };

/** Phone (375): two rows — status · feedback · End, then mic · main action · type · more. */
export const Stacked: Story = {
  render: () => (
    <div style={{ width: "21.4375rem" }}>
      <Island
        label="Session controls"
        layout="stacked"
        groups={[
          { ...status(), row: 1, grow: true },
          { id: "row1-end", row: 1, children: <><IconButton icon="panel" label="Show feedback (F)" /><Button variant="secondary" size="sm" icon="stop">End</Button></> },
          { id: "voice", row: 2, grow: true, children: <><MicButton label="Mute (M)" muted={false} live level={0.3} /><Button variant="primary" size="lg" fullWidth>Next question</Button></> },
          { id: "row2-end", row: 2, children: <><IconButton icon="keyboard" label="Type instead (T)" /><IconButton icon="more" label="More" /></> },
        ]}
      />
    </div>
  ),
};
