import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { IconButton } from "./Button";
import { Select } from "./Select";
import { SettingRow } from "./SettingRow";

/* D78: our own dropdown — the same look on every OS (the native <select> took the system's menu).
 * The app always uses it inside a SettingRow: the row names the setting, so the Select has `hideLabel` and
 * `width="content"` (as wide as the current value, the list opens to the end edge). */
const meta: Meta = { title: "DS/Select" };
export default meta;

const VOICES = [
  { value: "eric", label: "Eric · en-US" },
  { value: "emma", label: "Emma · en-GB" },
  { value: "liam", label: "Liam · en-US" },
];

const box = { maxWidth: "40rem", containerType: "inline-size" } as const;

function VoiceRow({ open, disabled }: { open?: boolean; disabled?: boolean }) {
  const [v, setV] = useState("eric");
  return (
    <SettingRow label="Voice">
      <Select label="Voice" hideLabel width="content" value={v} onChange={setV} options={VOICES} inline={open} defaultOpen={open} disabled={disabled} />
      <IconButton icon="play" label="Play a sample" disabled={disabled} />
    </SettingRow>
  );
}

function Rows() {
  const [n, setN] = useState("5");
  const [level, setLevel] = useState("B1");
  return (
    <div style={box}>
      <VoiceRow />
      <SettingRow label="Questions per interview">
        <Select label="Questions per interview" hideLabel width="content" value={n} onChange={setN}
          options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
      </SettingRow>
      <SettingRow label="Default English level" description="How Mike speaks to you and how much he corrects.">
        <Select label="Default English level" hideLabel width="content" value={level} onChange={setLevel}
          options={[
            { value: "A2", label: "A2 · Everyday topics" },
            { value: "B1", label: "B1 · Familiar topics" },
            { value: "B2", label: "B2 · Work topics" },
            { value: "C1", label: "C1 · Complex topics" },
          ]} />
      </SettingRow>
    </div>
  );
}

/** Settings → Voice and Practice: a short list, a numeric list and a list with a hint under the name. */
export const Content: StoryObj = { render: () => <Rows /> };
export const Open: StoryObj = { render: () => <div style={{ ...box, minHeight: "14rem" }}><VoiceRow open /></div> };
/** Voices load when speech is installed (Settings → Voice): disabled until then. */
export const Disabled: StoryObj = { render: () => <div style={box}><VoiceRow disabled /></div> };
