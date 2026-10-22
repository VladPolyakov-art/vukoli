import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState, type ReactNode } from "react";
import { getFakeLevel } from "./fakeLevel";
import { MicButton } from "./MicButton";

/** Thin 2px blue ring (--color-mic-live) around the button while the mic is open; its opacity and scale follow the
 * voice level (read every frame, no re-render). Blue only for the Presence glow, the live mic and the focus ring. */
const meta: Meta<typeof MicButton> = { title: "DS/MicButton", component: MicButton, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof MicButton>;

const pad = (node: ReactNode) => <div style={{ padding: "var(--space-6)" }}>{node}</div>;

/** Fake voice level: the slider feeds getLevel. */
function Demo() {
  const [level, setLevel] = useState(0.3);
  const [muted, setMuted] = useState(false);
  const [live, setLive] = useState(true);
  const ref = useRef(level);
  ref.current = level;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", alignItems: "flex-start" }}>
      {pad(<MicButton label={muted ? "Unmute" : "Mute"} muted={muted} live={live} getLevel={() => ref.current} onClick={() => setMuted(!muted)} />)}
      <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        Level
        <input type="range" min={0} max={1} step={0.01} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{level.toFixed(2)}</span>
      </label>
      <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Mic open (session live)
      </label>
    </div>
  );
}
export const FakeLevel: Story = { render: () => <Demo /> };
export const LiveSpeaking: Story = { render: () => pad(<MicButton label="Mute" muted={false} live getLevel={getFakeLevel} />) };
export const LiveQuiet: Story = { render: () => pad(<MicButton label="Mute" muted={false} live level={0} />) };
export const LiveLoud: Story = { render: () => pad(<MicButton label="Mute" muted={false} live level={1} />) };
export const Idle: Story = { render: () => pad(<MicButton label="Mute" muted={false} live={false} />) };
export const Muted: Story = { render: () => pad(<MicButton label="Unmute" muted live />) };
export const Disabled: Story = { render: () => pad(<MicButton label="Mute" muted={false} live={false} disabled />) };
