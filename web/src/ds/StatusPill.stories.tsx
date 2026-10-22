import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusPill, type StatusPillState } from "./StatusPill";

/** Session status pill (G11). The dot is blue only while the user's mic is open (listening / your turn + `live`). */
const meta: Meta<typeof StatusPill> = { title: "DS/StatusPill", component: StatusPill, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof StatusPill>;

export const Connecting: Story = { args: { state: "connecting", label: "Connecting…" } };
export const Speaking: Story = { args: { state: "speaking", label: "Mike is speaking" } };
export const YourTurn: Story = { args: { state: "your-turn", label: "Your turn", live: true } };
/** Mic live: blue dot, no loop (nothing moves while the user speaks). */
export const ListeningMicLive: Story = { args: { state: "listening", label: "Listening", live: true } };
export const ListeningTyped: Story = { args: { state: "listening", label: "Type your answer" } };
export const Thinking: Story = { args: { state: "thinking", label: "Mike is thinking" } };
export const Between: Story = { args: { state: "between", label: "Question 3 of 5" } };
export const Muted: Story = { args: { state: "muted", label: "Mic is off", sub: "Press M to turn it on" } };
export const Offline: Story = { args: { state: "offline", label: "Ollama isn't running" } };
export const Paused: Story = { args: { state: "paused", label: "Paused" } };
export const Overflow: Story = {
  args: { state: "thinking", label: "Mike is thinking about a follow-up on your Kestrel Pay checkout story" },
  render: (args) => <div style={{ width: "15rem" }}><StatusPill {...args} /></div>,
};

const ALL: [StatusPillState, string, boolean?][] = [
  ["connecting", "Connecting…"], ["speaking", "Mike is speaking"], ["your-turn", "Your turn", true], ["listening", "Listening", true],
  ["thinking", "Mike is thinking"], ["between", "Question 3 of 5"], ["muted", "Mic is off"], ["offline", "Ollama isn't running"], ["paused", "Paused"],
];
export const AllStates: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
      {ALL.map(([state, label, live]) => <StatusPill key={state} state={state} label={label} live={live} announce={false} />)}
    </div>
  ),
};
