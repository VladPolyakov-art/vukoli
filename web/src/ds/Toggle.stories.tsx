import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";

/* The app always puts a Toggle in a SettingRow: the row carries the name and the description, so the switch has
 * `hideLabel` (it is still announced). Settings → Voice, Practice and Privacy. */
const meta: Meta = { title: "DS/Toggle" };
export default meta;

function Demo({ initial, disabled }: { initial: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div style={{ maxWidth: "40rem", containerType: "inline-size" }}>
      <SettingRow label="Mike speaks aloud" description="Off: Mike only writes. Useful in a quiet office.">
        <Toggle label="Mike speaks aloud" hideLabel checked={on} onChange={setOn} disabled={disabled} />
      </SettingRow>
    </div>
  );
}
export const Off: StoryObj = { render: () => <Demo initial={false} /> };
export const On: StoryObj = { render: () => <Demo initial /> };
/** Disabled until the setting has loaded (Settings → Privacy). */
export const Disabled: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "40rem", containerType: "inline-size" }}>
      <SettingRow label="Share anonymous usage counts" description="Off by default. Counts, timings, engine names and error codes, never what you said or wrote. Today nothing leaves this computer.">
        <Toggle label="Share anonymous usage counts" hideLabel checked={false} onChange={() => {}} disabled />
      </SettingRow>
    </div>
  ),
};
