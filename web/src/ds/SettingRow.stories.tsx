import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { IconButton } from "./Button";
import { Select } from "./Select";
import { Segmented } from "./Segmented";
import { SettingGroup, SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";

/* D76: one row per setting — name and description left, the control right, whatever the control is.
 * D78: rows sit in titled groups (SettingGroup), one rounded box each. */
const meta: Meta = { title: "DS/SettingRow" };
export default meta;

function Rows() {
  const [speak, setSpeak] = useState(true);
  const [order, setOrder] = useState<"content" | "delivery">("content");
  return (
    <div style={{ maxWidth: "40rem", display: "flex", flexDirection: "column", containerType: "inline-size" }}>
      <SettingRow label="Voice">
        <Select label="Voice" hideLabel width="content" value="eric" onChange={() => {}} options={[{ value: "eric", label: "Eric · US, male" }]} />
        <IconButton icon="play" label="Play a sample" />
      </SettingRow>
      <SettingRow label="Mike speaks aloud" description="Off: Mike only writes. Useful in a quiet office.">
        <Toggle label="Mike speaks aloud" hideLabel checked={speak} onChange={setSpeak} />
      </SettingRow>
      <SettingRow label="Feedback order" description="The order of the three feedback blocks after each question.">
        <Segmented label="Feedback order" hideLabel value={order} onChange={setOrder}
          options={[{ value: "content", label: "Content first" }, { value: "delivery", label: "Delivery first" }]} />
      </SettingRow>
      <SettingRow label="Send my voice answer after" description="Longer pauses give you more time to think.">
        <div data-field="">
          <Select label="Send my voice answer after" hideLabel width="content" value="3" onChange={() => {}} options={[{ value: "3", label: "3 s of quiet" }]} />
        </div>
      </SettingRow>
    </div>
  );
}

export const Inline: StoryObj = { render: () => <Rows /> };
/** Under 30rem of container width a wide control drops under the text; a switch stays on the right. */
export const Narrow: StoryObj = { render: () => <div style={{ width: 343 }}><Rows /></div> };
export const Stack: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "40rem" }}>
      <SettingRow layout="stack" label="Data folder" description="Sessions, your CV and settings are saved here as plain files.">
        <code>~/Library/Application Support/Vukoli</code>
      </SettingRow>
    </div>
  ),
};
/** D78: two groups of one section, so where one ends and the next begins is plain to see. */
export const Groups: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "40rem", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <SettingGroup title="Mike's voice">
        <SettingRow label="Voice">
          <Select label="Voice" hideLabel width="content" value="eric" onChange={() => {}} options={[{ value: "eric", label: "Eric · US, male" }]} />
        </SettingRow>
        <SettingRow label="Mike speaks aloud" description="Off: Mike only writes.">
          <Toggle label="Mike speaks aloud" hideLabel checked onChange={() => {}} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="Speech recognition" description="Audio stays on this computer.">
        <SettingRow label="Send my voice answer after">
          <Select label="Send my voice answer after" hideLabel width="content" value="3" onChange={() => {}} options={[{ value: "3", label: "3 s of quiet" }]} />
        </SettingRow>
      </SettingGroup>
    </div>
  ),
};
