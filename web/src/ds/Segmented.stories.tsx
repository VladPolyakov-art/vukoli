import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Segmented } from "./Segmented";
import { SettingRow } from "./SettingRow";

/* The app always hides the visible label (`hideLabel`, still announced): the SettingRow around it, or the dialog /
 * page heading, says what the control is. */
const meta: Meta = { title: "DS/Segmented" };
export default meta;

const box = { maxWidth: "40rem", containerType: "inline-size" } as const;

/** Setup → About you: how you'll answer. */
function Demo() {
  const [v, setV] = useState<"voice" | "text">("voice");
  return (
    <div style={box}>
      <SettingRow label="How you'll answer" description="Five questions, about 20 minutes.">
        <Segmented
          label="How you'll answer"
          hideLabel
          value={v}
          onChange={setV}
          options={[{ value: "voice", label: "Voice", icon: "mic" }, { value: "text", label: "Keyboard", icon: "keyboard" }]}
        />
      </SettingRow>
    </div>
  );
}
export const Default: StoryObj = { render: () => <Demo /> };
/** Settings → General. The theme lives only here (D80). */
function Theme() {
  const [v, setV] = useState<"system" | "light" | "dark">("system");
  return (
    <div style={box}>
      <SettingRow label="Theme" description="System follows your computer's light or dark setting.">
        <Segmented
          label="Theme"
          hideLabel
          value={v}
          onChange={setV}
          options={[
            { value: "system", label: "System", icon: "monitor" },
            { value: "light", label: "Light", icon: "sun" },
            { value: "dark", label: "Dark", icon: "moon" },
          ]}
        />
      </SettingRow>
    </div>
  );
}
export const ThemePicker: StoryObj = { render: () => <Theme /> };

/** Settings → Practice: strictness. The values are the numbers 1 / 2 / 3, the labels are words. */
function Strictness() {
  const [v, setV] = useState<"1" | "2" | "3">("2");
  return (
    <div style={box}>
      <SettingRow label="Default strictness">
        <Segmented
          label="Default strictness"
          hideLabel
          value={v}
          onChange={setV}
          options={[{ value: "1", label: "Gentle" }, { value: "2", label: "Standard" }, { value: "3", label: "Tough" }]}
        />
      </SettingRow>
    </div>
  );
}
export const StrictnessLevels: StoryObj = { render: () => <Strictness /> };

/** Settings → Voice: an option that can't be used is `disabled` (local recognition isn't installed); the other stays selected. */
function Recognition() {
  const [v, setV] = useState<"server" | "browser">("browser");
  return (
    <div style={box}>
      <SettingRow label="Recognise my speech" description="Local recognition isn't installed. Use the browser or the keyboard.">
        <Segmented
          label="Speech recognition"
          hideLabel
          value={v}
          onChange={setV}
          options={[
            { value: "server", label: "Computer", icon: "lock", disabled: true },
            { value: "browser", label: "Browser", icon: "globe" },
          ]}
        />
      </SettingRow>
    </div>
  );
}
export const DisabledOption: StoryObj = { render: () => <Recognition /> };

/** `fullWidth`: the job editor's source switch fills the dialog, the three options share it equally. */
function Source() {
  const [v, setV] = useState<"paste" | "file" | "link">("paste");
  return (
    <div style={{ maxWidth: "32rem" }}>
      <Segmented
        label="Source"
        hideLabel
        fullWidth
        value={v}
        onChange={setV}
        options={[
          { value: "paste", label: "Paste", icon: "file" },
          { value: "file", label: "File", icon: "upload" },
          { value: "link", label: "Link", icon: "link" },
        ]}
      />
    </div>
  );
}
export const FullWidth: StoryObj = { render: () => <Source /> };

/** Debrief: pick the question to read. Numbers only; the question is the option's `title` (hover). */
function Picker() {
  const [v, setV] = useState("2");
  const questions = [
    "Walk me through your career so far.",
    "Tell me about a design decision you changed after seeing the data.",
    "Describe a disagreement with a product manager.",
    "How do you measure the impact of a design system?",
    "Why do you want this job?",
  ];
  return (
    <Segmented
      label="Question"
      hideLabel
      value={v}
      onChange={setV}
      options={questions.map((q, i) => ({ value: String(i + 1), label: String(i + 1), title: q }))}
    />
  );
}
export const QuestionPicker: StoryObj = { render: () => <Picker /> };

/** The thumb slides between options (base, ease-standard) and follows the width of long labels. */
function Thumb() {
  const [v, setV] = useState<"a" | "b" | "c">("a");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "36rem" }}>
      <Segmented
        label="Length"
        value={v}
        onChange={setV}
        options={[
          { value: "a", label: "Short" },
          { value: "b", label: "A much longer label" },
          { value: "c", label: "Mid size" },
        ]}
      />
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
        Arrow keys move the selection. Under reduced motion the thumb jumps.
      </p>
    </div>
  );
}
export const SlidingThumb: StoryObj = { render: () => <Thumb /> };
