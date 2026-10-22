import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type CSSProperties } from "react";
import { getFakeLevel } from "./fakeLevel";
import { Presence, type PresenceState } from "./Presence";
import { StatusPill } from "./StatusPill";
import type { StatusPillState } from "./StatusPill";

/** Presence (D49): Mike's glow along the top edge of the Session stage, replacing the Orb. Only while someone talks:
 * speaking follows Mike's level, listening the user's mic (calmer), thinking = a broad crest sweeping side to side,
 * idle = no glow. The dots of the owner's pattern show only inside the glow. The box's bottom is the first text line
 * (text-safe mask). Decorative: the state is always the text label under it. */
const meta: Meta<typeof Presence> = {
  title: "DS/Presence",
  component: Presence,
  tags: ["autodocs"],
  parameters: { layout: "wide" },
  args: { getLevel: getFakeLevel },
  render: (args) => <Stage {...args} />,
};
export default meta;
type Story = StoryObj<typeof Presence>;

const LABEL: Record<PresenceState, { pill: StatusPillState; text: string }> = {
  speaking: { pill: "speaking", text: "Mike is speaking" },
  listening: { pill: "listening", text: "Listening… take your time" },
  thinking: { pill: "thinking", text: "Mike is thinking" },
  waiting: { pill: "your-turn", text: "Your turn" },
  idle: { pill: "between", text: "Between questions" },
};

const frame: CSSProperties = {
  position: "relative",
  width: "100%",
  background: "var(--color-canvas)",
  border: "var(--border-width) solid var(--color-border-subtle)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
};
const glowBox: CSSProperties = { height: "var(--presence-reach)" };
const text: CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)",
  padding: "0 var(--space-6) var(--space-6)", fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)",
  color: "var(--color-text-primary)", textAlign: "center",
};

/** The glow box as the Session uses it, with the first text line right under it and the state label. */
function Stage(props: Parameters<typeof Presence>[0]) {
  const l = LABEL[props.state];
  return (
    <div style={frame}>
      <div style={glowBox}><Presence {...props} /></div>
      <div style={text}>
        <p style={{ margin: 0, maxWidth: "var(--layout-narrow)" }}>Tell me about a time you had to change your plan late in a project. What happened?</p>
        <StatusPill state={l.pill} label={l.text} />
      </div>
    </div>
  );
}

export const Speaking: Story = { args: { state: "speaking" } };
/** No level source yet (the live app until stage 12d): a speech-like envelope drives it. */
export const SpeakingNoLevel: Story = { args: { state: "speaking", getLevel: undefined } };
/** The user talks: the mic level, smoothed ~450ms, raises the lobes gently. */
export const Listening: Story = { args: { state: "listening" } };
export const Thinking: Story = { args: { state: "thinking" } };
/** No glow: the label carries the state. 🟡 D49: idle without glow. */
/** D50: your turn before the first word — faint, slow, inviting. */
export const Waiting: Story = { args: { state: "waiting" } };
export const Idle: Story = { args: { state: "idle" } };
/** Static levels (review frames). */
export const SpeakingStaticLevel: Story = { args: { state: "speaking", getLevel: undefined, level: 0.8 } };
export const ListeningQuiet: Story = { args: { state: "listening", getLevel: undefined, level: 0.1 } };
/** Reduced motion: one still frame per state. */
export const ReducedSpeaking: Story = { args: { state: "speaking", reducedMotion: true } };
export const ReducedListening: Story = { args: { state: "listening", reducedMotion: true } };
export const ReducedThinking: Story = { args: { state: "thinking", reducedMotion: true } };
/** Phone width: shorter reach (--presence-reach-sm), finer columns. */
export const Phone: Story = {
  args: { state: "speaking" },
  render: (args) => (
    <div style={{ width: "23.4375rem", maxWidth: "100%" }}>
      <div style={frame}>
        <div style={{ height: "var(--presence-reach-sm)" }}><Presence {...args} /></div>
        <div style={text}><StatusPill state="speaking" label="Mike is speaking" /></div>
      </div>
    </div>
  ),
};

const ORDER: PresenceState[] = ["speaking", "listening", "thinking", "waiting", "idle"];

function Driver() {
  const [state, setState] = useState<PresenceState>("speaking");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Stage state={state} getLevel={getFakeLevel} />
      <div role="group" aria-label="Presence state" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
        {ORDER.map((s) => (
          <button key={s} type="button" aria-pressed={s === state} onClick={() => setState(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
/** Walk through the states: the fade in / out and the cross-fade between shapes. */
export const StateDriver: Story = { render: () => <Driver /> };
