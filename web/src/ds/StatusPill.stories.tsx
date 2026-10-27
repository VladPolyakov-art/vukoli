import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { Presence, type PresenceState } from "./Presence";
import { StatusPill, type StatusPillProps } from "./StatusPill";

/** Session status pill (G11). Stories show the states `screens/session/stage.ts` really produces (D91–D93): copy from the
 * locale file, `surface="glass"` over Mike's glow (the pill sits at the top of the stage inside the glow), the dot always
 * blue (`--color-mic-live`; it pulses only while thinking / connecting), Muted swaps it for the slashed mic, `sub` is the
 * line under the pill and `subFadeMs` folds a hint away once it was read. `offline` (never reached by the app) and the typed
 * "Listening" (typing is `your-turn` + "Type your answer below") are gone. */
const meta: Meta<typeof StatusPill> = { title: "DS/StatusPill", component: StatusPill, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof StatusPill>;

const frame: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "var(--layout-narrow)",
  background: "var(--color-canvas)",
  border: "var(--border-width) solid var(--color-border-subtle)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
};
const glowBox: CSSProperties = { height: "var(--presence-reach)" };
const atTop: CSSProperties = { position: "absolute", inset: "var(--space-6) var(--space-4) auto", display: "flex", justifyContent: "center" };

/** The pill as the Session places it: glass, at the top of the stage, over the glow of the matching Presence state. */
function Glow({ presence = "idle", level, ...pill }: StatusPillProps & { presence?: PresenceState; level?: number }) {
  return (
    <div style={frame}>
      <div style={glowBox}><Presence state={presence} level={level} reducedMotion /></div>
      <div style={atTop}><StatusPill surface="glass" {...pill} /></div>
    </div>
  );
}

export const Connecting: Story = {
  render: () => <Glow state="connecting" label="Connecting" sub="Starting the local engine…" />,
};
export const Speaking: Story = {
  render: () => <Glow presence="speaking" level={0.5} state="speaking" label="Mike is speaking" sub="Press Space to interrupt" />,
};
export const YourTurn: Story = {
  render: () => <Glow presence="waiting" state="your-turn" label="Your turn" live sub="Answer when you're ready" />,
};
/** Typed answers: the same "Your turn", no mic, the hint points at the field. */
export const YourTurnTyped: Story = {
  render: () => <Glow presence="waiting" state="your-turn" label="Your turn" sub="Type your answer below" />,
};
/** Mic live: blue dot, no loop (nothing moves while the user speaks, GR6). */
export const ListeningMicLive: Story = {
  render: () => <Glow presence="listening" level={0.5} state="listening" label="Listening" live sub="Take your time. Mike waits for 5 s of quiet." />,
};
/** Manual send (pause 0): the hint says how the answer is sent. */
export const ListeningManual: Story = {
  render: () => <Glow presence="listening" level={0.5} state="listening" label="Listening" live sub="Press Send now when you're done." />,
};
export const Thinking: Story = { render: () => <Glow presence="thinking" state="thinking" label="Thinking" /> };
/** Mike is writing the feedback for the answer that was just given. */
export const PreparingFeedback: Story = { render: () => <Glow state="between" label="Preparing your feedback" /> };
/** Between questions: the sub says what Next question does. */
export const Between: Story = {
  render: () => <Glow state="between" label="Round complete" sub="Mike asks question 3 when you press Next question." />,
};
/** Feedback could not be written: the answer is still kept. */
export const AnswerSaved: Story = {
  render: () => <Glow state="between" label="Your answer is saved" sub="Mike asks question 3 when you press Next question." />,
};
export const Muted: Story = { render: () => <Glow state="muted" label="Muted" sub="Press M to unmute" /> };
export const Paused: Story = { render: () => <Glow state="paused" label="Paused" sub="Your answers so far are saved." /> };
/** D91: a hint that has been read folds away after `subFadeMs` (6 s in the app), so the line goes back to the transcript;
 * a new state or a new hint brings it back. A state's own sub (Muted, Paused) stays. */
export const HintFades: Story = {
  render: () => <Glow presence="speaking" level={0.5} state="speaking" label="Mike is speaking" sub="Press Space to interrupt" subFadeMs={4000} />,
};
export const Overflow: Story = {
  render: () => (
    <div style={{ width: "15rem" }}>
      <StatusPill state="between" surface="glass" label="Your answer is saved and the feedback for question 3 of 5 is on its way" />
    </div>
  ),
};

const ALL: [StatusPillProps["state"], string, string?, boolean?][] = [
  ["connecting", "Connecting", "Starting the local engine…"],
  ["speaking", "Mike is speaking", "Press Space to interrupt"],
  ["your-turn", "Your turn", "Answer when you're ready", true],
  ["listening", "Listening", "Take your time. Mike waits for 5 s of quiet.", true],
  ["thinking", "Thinking"],
  ["between", "Preparing your feedback"],
  ["between", "Round complete", "Mike asks question 3 when you press Next question."],
  ["muted", "Muted", "Press M to unmute"],
  ["paused", "Paused", "Your answers so far are saved."],
];
export const AllStates: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", alignItems: "flex-start" }}>
      {ALL.map(([state, label, sub, live]) => <StatusPill key={label} state={state} label={label} sub={sub} live={live} surface="glass" announce={false} />)}
    </div>
  ),
};
