import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Segmented } from "./Segmented";

const meta: Meta = { title: "DS/Segmented" };
export default meta;

function Demo() {
  const [v, setV] = useState<"voice" | "text">("voice");
  return (
    <Segmented
      label="How you answer"
      value={v}
      onChange={setV}
      options={[{ value: "voice", label: "Voice", icon: "mic" }, { value: "text", label: "Keyboard", icon: "keyboard" }]}
    />
  );
}
export const Default: StoryObj = { render: () => <Demo /> };
function Theme() {
  const [v, setV] = useState<"system" | "light" | "dark">("system");
  return (
    <Segmented
      label="Theme"
      value={v}
      onChange={setV}
      options={[
        { value: "system", label: "System", icon: "monitor" },
        { value: "light", label: "Light", icon: "sun" },
        { value: "dark", label: "Dark", icon: "moon" },
      ]}
    />
  );
}
export const ThemePicker: StoryObj = { render: () => <Theme /> };

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
