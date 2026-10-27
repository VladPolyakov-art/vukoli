import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { Composer } from "./Composer";
import { Dots } from "./Dots";
import { Island, type IslandGroup } from "./Island";
import { MicButton } from "./MicButton";
import { Tooltip } from "./Tooltip";

/** Island (G21): the Session's one control surface (screens/session/parts/Island.tsx, `tools="open"`, D62). Groups:
 * status · voice · tools · exit, separated by hairlines. A fixed set of controls: disabled, never hidden. On a wide
 * screen there is no More menu: Redo, Type instead, the sample-answer bulb and Feedback are icons, Help (?) and End
 * close the row. `box` = text mode, `stacked` = phones (More returns there, Redo moves into it). */
const meta: Meta<typeof Island> = { title: "DS/Island", component: Island, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Island>;

/** Status group: "Question 2 of 5" (phones "Q2 of 5") and the static timer (session Island.module.css `.status`). */
const statusText = (progress = "Question 2 of 5", time = "07:12") => (
  <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)", paddingInline: "var(--space-1)", whiteSpace: "nowrap", fontSize: "var(--text-sm)" }}>
    <span style={{ fontWeight: "var(--weight-medium)" }}>{progress}</span>
    <span role="timer" aria-label="Elapsed time 7 minutes 12 seconds" style={{ color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>{time}</span>
  </span>
);
const status = (opts: { progress?: string; time?: string; grow?: boolean; row?: 1 | 2; tip?: boolean } = {}): IslandGroup => ({
  id: "status",
  label: "Status",
  grow: opts.grow,
  row: opts.row,
  // D62: the context that lived in the More header is the status tooltip.
  children: opts.tip === false
    ? statusText(opts.progress, opts.time)
    : <Tooltip content="Kestrel Pay · Senior Product Designer · Behavioural · Standard" placement="top-start">{statusText(opts.progress, opts.time)}</Tooltip>,
});

const redo = (disabled = false) => <IconButton icon="redo" label="Redo answer (R)" disabled={disabled} title={disabled ? "Nothing to redo yet" : undefined} />;
const typeInstead = <IconButton icon="keyboard" label="Type instead (T)" />;
const toVoice = <IconButton icon="mic" label="Switch to voice (T)" />;
const suggest = (on = false) => <IconButton icon="bulb" label={on ? "Hide the sample answer" : "Show a sample answer"} pressed={on} />;
/** Feedback toggle (F). `unread`: feedback is ready and the panel is closed → a dot, and the name says so (QA-01). */
const feedback = (opts: { open?: boolean; unread?: boolean } = {}) => (
  <IconButton
    icon="panel"
    label={opts.open ? "Hide feedback (F)" : opts.unread ? "Show feedback (F), new feedback is ready" : "Show feedback (F)"}
    pressed={opts.open}
    dot={opts.unread && !opts.open}
  />
);
const help = <IconButton icon="help" label="Shortcuts and microphone help (?)" />;
const more = <IconButton icon="more" label="More" />;
const end = (size: "sm" | "md" = "md") => <Button variant="secondary" size={size} icon="stop">End</Button>;

const toolsGroup = (children: ReactNode, extra: Partial<IslandGroup> = {}): IslandGroup => ({ id: "tools", label: "Tools", children, ...extra });
const exitWide: IslandGroup = { id: "exit", label: "Exit", children: <>{help}{end()}</> };
const nextQuestion = <Button variant="primary" iconRight="arrowRight">Next question</Button>;

/** Your turn is over, feedback is open (S5): "Next question" is the one primary; Redo, Type, bulb, Feedback, Help, End. */
export const Voice: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status({ tip: false }),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute" muted={false} live level={0.4} />{nextQuestion}</> },
        toolsGroup(<>{redo()}{typeInstead}{suggest()}{feedback({ open: true })}</>),
        exitWide,
      ]}
    />
  ),
};

/** You are talking: the main action is "Send now"; nothing else changes (GR6), only the mic follows the voice. */
export const Listening: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status({ tip: false, time: "05:48" }),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute" muted={false} live level={0.6} /><Button variant="primary" icon="send">Send now</Button></> },
        toolsGroup(<>{redo(true)}{typeInstead}{suggest()}{feedback()}</>),
        exitWide,
      ]}
    />
  ),
};

/** Mike is thinking (S4, D55/D61): no dots — the button you pressed stays as a disabled "Sent", so the slot never empties. */
export const Thinking: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status({ tip: false }),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute" muted={false} live level={0} /><Button variant="secondary" icon="check" disabled>Sent</Button></> },
        toolsGroup(<>{redo()}{typeInstead}{suggest()}{feedback()}</>),
        exitWide,
      ]}
    />
  ),
};

/** Feedback is being prepared or re-checked: a dots pill takes the main slot. */
export const Preparing: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status({ tip: false }),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute" muted={false} live={false} /><Dots variant="pill" label="Preparing feedback" showLabel /></> },
        toolsGroup(<>{redo(true)}{typeInstead}{suggest()}{feedback()}</>),
        exitWide,
      ]}
    />
  ),
};

/** QA-01: new feedback with the panel closed puts a dot on the Feedback icon; the sample-answer bulb is switched on. */
export const FeedbackNew: Story = {
  render: () => (
    <Island
      label="Session controls"
      groups={[
        status({ tip: false }),
        { id: "voice", label: "Voice", children: <><MicButton label="Mute" muted={false} live level={0} />{nextQuestion}</> },
        toolsGroup(<>{redo()}{typeInstead}{suggest(true)}{feedback({ unread: true })}</>),
        exitWide,
      ]}
    />
  ),
};

/** D62: with no More menu the context (title, round, strictness) is the status tooltip. Shown open. */
export const StatusTooltip: Story = {
  render: () => (
    <div style={{ paddingTop: "var(--space-12)" }}>
      <Island
        label="Session controls"
        groups={[
          {
            id: "status",
            label: "Status",
            children: <Tooltip open content="Kestrel Pay · Senior Product Designer · Behavioural · Standard" placement="top-start">{statusText()}</Tooltip>,
          },
          { id: "voice", label: "Voice", children: <><MicButton label="Mute" muted={false} live level={0} />{nextQuestion}</> },
          toolsGroup(<>{redo()}{typeInstead}{suggest()}{feedback()}</>),
          exitWide,
        ]}
      />
    </div>
  ),
};

function TextBox({ main }: { main?: boolean }) {
  const [v, setV] = useState("");
  return (
    <div style={{ width: "var(--layout-narrow)", maxWidth: "100%" }}>
      <Island
        label="Session controls"
        shape="box"
        lead={(
          <Composer surface="none" label="Your answer" placeholder="Type your answer" minRows={1} maxRows={6} submitOnEnter value={v}
            onChange={(e) => setV(e.target.value)} send={{ label: "Send", icon: "send", variant: "action", disabled: !v.trim(), onSend: () => setV("") }} />
        )}
        groups={[
          status({ tip: false, grow: !main }),
          ...(main ? [{ id: "voice", label: "Voice", grow: true, children: nextQuestion }] : []),
          toolsGroup(<>{redo()}{toVoice}{suggest()}{feedback()}</>),
          exitWide,
        ]}
      />
    </div>
  );
}
/** Text mode (S6): the island becomes a box; the Composer has no own surface; no mic, "Switch to voice" in its place. */
export const TextMode: Story = { render: () => <TextBox /> };
/** Text mode after an answer: the main slot returns between status and tools. */
export const TextModeNext: Story = { render: () => <TextBox main /> };

/** Phone (375, voice): two rows — status · Feedback · End, then mic · main action · Type · bulb · More. Redo moves into More. */
export const Stacked: Story = {
  render: () => (
    <div style={{ width: "21.4375rem" }}>
      <Island
        label="Session controls"
        layout="stacked"
        groups={[
          status({ progress: "Q2 of 5", grow: true, row: 1, tip: false }),
          { id: "exit", label: "Exit", row: 1, children: <>{feedback()}{end("sm")}</> },
          { id: "voice", label: "Voice", row: 2, grow: true, children: <><MicButton label="Mute" muted={false} live level={0.3} /><Button variant="primary" size="lg" iconRight="arrowRight" fullWidth>Next question</Button></> },
          { id: "tools", label: "Tools", row: 2, children: <>{typeInstead}{suggest()}{more}</> },
        ]}
      />
    </div>
  ),
};

function StackedText({ compact }: { compact?: boolean }) {
  const [v, setV] = useState("");
  const lead = (
    <Composer surface="none" label="Your answer" placeholder="Type your answer" minRows={1} maxRows={6} submitOnEnter value={v}
      onChange={(e) => setV(e.target.value)} send={{ label: "Send", icon: "send", variant: "action", disabled: !v.trim(), onSend: () => setV("") }} />
  );
  const tools = toolsGroup(<>{toVoice}{suggest()}{feedback()}{more}</>, { row: compact ? 2 : 1 });
  const exit: IslandGroup = { id: "exit", label: "Exit", row: 1, children: end("sm") };
  const main: IslandGroup = { id: "voice", label: "Voice", row: 2, grow: true, children: <Button variant="primary" size="lg" iconRight="arrowRight" fullWidth>Next question</Button> };
  return (
    <div style={{ width: compact ? "21.4375rem" : "30rem", maxWidth: "100%" }}>
      <Island
        label="Session controls"
        shape="box"
        layout="stacked"
        lead={lead}
        groups={compact
          ? [status({ progress: "Q2 of 5", grow: true, row: 1, tip: false }), exit, main, tools]
          : [status({ progress: "Q2 of 5", grow: true, row: 1, tip: false }), tools, exit, main]}
      />
    </div>
  );
}
/** Compact phone (< 420, text mode, QA-10): End stays on the first row, the tools drop to the second row beside the main action. */
export const StackedCompact: Story = { render: () => <StackedText compact /> };
/** A wider stacked box (420–559): the tools stay on the first row with the status and End, the main action below. */
export const StackedTextMode: Story = { render: () => <StackedText /> };
