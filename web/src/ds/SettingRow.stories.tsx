import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Badge } from "./Badge";
import { Button, IconButton } from "./Button";
import { CopyField } from "./CopyField";
import { Input } from "./Field";
import { Icon } from "./icons";
import { Select } from "./Select";
import { Segmented } from "./Segmented";
import { SettingGroup, SettingRow } from "./SettingRow";
import { Toggle } from "./Toggle";

/* D76: one row per setting — name and description left, the control right, whatever the control is.
 * D78: rows sit in titled groups (SettingGroup), one rounded box each. Copy: Settings → Voice, Practice, Privacy. */
const meta: Meta = { title: "DS/SettingRow" };
export default meta;

const box = { maxWidth: "40rem", containerType: "inline-size" } as const;

function Rows() {
  const [speak, setSpeak] = useState(true);
  const [order, setOrder] = useState<"content" | "delivery">("content");
  return (
    <div style={{ ...box, display: "flex", flexDirection: "column" }}>
      <SettingRow label="Voice">
        <Select label="Voice" hideLabel width="content" value="eric" onChange={() => {}} options={[{ value: "eric", label: "Eric · en-US" }]} />
        <IconButton icon="play" label="Play a sample" />
      </SettingRow>
      <SettingRow label="Mike speaks aloud" description="Off: Mike only writes. Useful in a quiet office.">
        <Toggle label="Mike speaks aloud" hideLabel checked={speak} onChange={setSpeak} />
      </SettingRow>
      <SettingRow label="Feedback order" description="The order of the three feedback blocks in the debrief.">
        <Segmented label="Feedback order" hideLabel value={order} onChange={setOrder}
          options={[{ value: "content", label: "Content first" }, { value: "delivery", label: "Delivery first" }]} />
      </SettingRow>
      <SettingRow label="Send my voice answer after" description="Longer pauses give you more time to think.">
        <Select label="Send my voice answer after" hideLabel width="content" value="3" onChange={() => {}} options={[{ value: "3", label: "3 s of quiet" }]} />
      </SettingRow>
    </div>
  );
}

export const Inline: StoryObj = { render: () => <Rows /> };
/** Under 30rem of container width a wide control drops under the text; a switch stays on the right. */
export const Narrow: StoryObj = { render: () => <div style={{ width: 343 }}><Rows /></div> };

/** A Button as the control: Settings → General (install the app) and About (run setup again); Setup → About you, where the
 * label itself is the chosen job with its icon. */
export const ButtonControl: StoryObj = {
  render: () => (
    <div style={box}>
      <SettingRow label="Install Vukoli as an app" description="Its own window and icon in the Dock. If the app is closed, the icon offers to start it.">
        <Button variant="secondary" size="sm" icon="download">Install</Button>
      </SettingRow>
      <SettingRow label="Run setup again" description="AI engine, voice check, your name and CV. Sessions and settings stay as they are.">
        <Button variant="secondary" size="sm" icon="refresh">Run setup again</Button>
      </SettingRow>
      <SettingRow label={<span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}><Icon name="briefcase" size="sm" />Kestrel Pay · Senior Product Designer</span>}>
        <Button variant="secondary" size="sm">Change</Button>
      </SettingRow>
    </div>
  ),
};

/** `layout="stack"`: the control under the text, full width. Settings → Privacy and data. */
export const Stack: StoryObj = {
  render: () => (
    <div style={box}>
      <SettingRow layout="stack" label="Data folder" description="Sessions, your CV and settings are saved here as plain files.">
        <div data-field="">
          <CopyField label="Data folder" value="~/Library/Application Support/Vukoli" copyLabel="Copy" copiedLabel="Copied" />
        </div>
      </SettingRow>
      <SettingRow layout="stack" label={<>Markdown export folder<span style={{ color: "var(--color-text-secondary)", fontWeight: "var(--weight-regular)" }}> · optional</span></>}
        description="Optional. Each finished session is also saved as a Markdown note in this folder.">
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
          <Input label="Markdown export folder" hideLabel defaultValue="" spellCheck={false} />
          <Button variant="secondary" disabled>Save folder</Button>
        </div>
      </SettingRow>
    </div>
  ),
};

/** D78: two groups of one section, so where one ends and the next begins is plain to see. */
export const Groups: StoryObj = {
  render: () => (
    <div style={{ ...box, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <SettingGroup title="Mike's voice">
        <SettingRow label="Voice">
          <Select label="Voice" hideLabel width="content" value="eric" onChange={() => {}} options={[{ value: "eric", label: "Eric · en-US" }]} />
          <IconButton icon="play" label="Play a sample" />
        </SettingRow>
        <SettingRow label="Mike speaks aloud" description="Off: Mike only writes. Useful in a quiet office.">
          <Toggle label="Mike speaks aloud" hideLabel checked onChange={() => {}} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="Speech recognition">
        <SettingRow label="Send my voice answer after" description="Longer pauses give you more time to think.">
          <Select label="Send my voice answer after" hideLabel width="content" value="3" onChange={() => {}} options={[{ value: "3", label: "3 s of quiet" }]} />
        </SettingRow>
      </SettingGroup>
    </div>
  ),
};

/** `description` under the title and an `action` at its end (Settings → AI engine: re-check the engines). */
export const GroupAction: StoryObj = {
  render: () => (
    <div style={box}>
      <SettingGroup
        title="Other engines"
        description="Switch any time. Your sessions stay as they are."
        action={<IconButton icon="refresh" size="sm" label="Check again" />}
      >
        <SettingRow label="Ollama" description="Runs on this computer, free.">
          <Badge>Recommended</Badge>
          <Button variant="secondary" size="sm">Set up</Button>
        </SettingRow>
        <SettingRow label="Other AI (OpenAI-compatible)" description="LM Studio, Jan, OpenRouter, OpenAI or any server that speaks the OpenAI API.">
          <Button variant="secondary" size="sm">Set up</Button>
        </SettingRow>
      </SettingGroup>
    </div>
  ),
};

const cell = { padding: "var(--space-3) var(--space-4)", textAlign: "left", borderBottom: "1px solid var(--color-border-subtle)", fontSize: "var(--text-sm)" } as const;
const yes = (
  <span style={{ display: "inline-flex" }}><Icon name="check" size="sm" /><span className="visually-hidden">Included</span></span>
);
const no = <span><span aria-hidden="true">—</span><span className="visually-hidden">Not included</span></span>;

/** `flush`: no side padding in the box; the content draws its own cells edge to edge (the "What's free" table; the engine list). */
export const GroupFlush: StoryObj = {
  render: () => {
    const rows: [string, ReactNode, ReactNode][] = [
      ["Interview practice with Mike", yes, yes],
      ["Zero setup", "Set up a local engine once", yes],
      ["Trends across sessions", no, yes],
    ];
    return (
      <div style={box}>
        <SettingGroup
          title="What's free"
          description="Everything you need to practise is free forever, with no account and no key. The free core is never a demo."
          flush
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <caption className="visually-hidden">What's free forever and what Premium will add</caption>
            <thead>
              <tr>
                <th scope="col" style={{ ...cell, color: "var(--color-text-secondary)", fontWeight: "var(--weight-medium)" }}>Feature</th>
                <th scope="col" style={{ ...cell, color: "var(--color-text-secondary)", fontWeight: "var(--weight-medium)" }}>Free forever</th>
                <th scope="col" style={{ ...cell, color: "var(--color-text-secondary)", fontWeight: "var(--weight-medium)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>Premium<Badge tone="outline">Coming later</Badge></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, free, premium], i) => (
                <tr key={name}>
                  <th scope="row" style={{ ...cell, fontWeight: "var(--weight-regular)", borderBottom: i === rows.length - 1 ? 0 : cell.borderBottom }}>{name}</th>
                  <td style={{ ...cell, borderBottom: i === rows.length - 1 ? 0 : cell.borderBottom }}>{free}</td>
                  <td style={{ ...cell, borderBottom: i === rows.length - 1 ? 0 : cell.borderBottom }}>{premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SettingGroup>
      </div>
    );
  },
};

/** `hideTitle` + `headingLevel={2}`: Setup steps. The box already says what it is, so the title is only for screen
 * readers, and it is an h2 straight under the page's h1 (in Settings it is an h3 under the section heading). */
export const GroupHiddenTitle: StoryObj = {
  render: () => (
    <div style={box}>
      <SettingGroup title="Your name" hideTitle headingLevel={2}>
        <SettingRow label="What should Mike call you?">
          <Input label="What should Mike call you?" hideLabel placeholder="Your first name" maxLength={40} autoComplete="given-name" spellCheck={false} />
        </SettingRow>
      </SettingGroup>
    </div>
  ),
};
