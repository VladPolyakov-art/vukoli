import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Select } from "./Select";

/* D78: our own dropdown — the same look on every OS (the native <select> took the system's menu). */
const meta: Meta = { title: "DS/Select" };
export default meta;

const VOICES = [
  { value: "eric", label: "Eric · US, male · en-US" },
  { value: "emma", label: "Emma · UK, female · en-GB" },
  { value: "liam", label: "Liam · US, male · en-US" },
];

function Live({ width, open }: { width?: "fill" | "content"; open?: boolean }) {
  const [v, setV] = useState("eric");
  return <Select label="Voice" value={v} onChange={setV} options={VOICES} width={width} inline={open} defaultOpen={open} />;
}

export const Fill: StoryObj = { render: () => <div style={{ maxWidth: "22rem" }}><Live /></div> };
export const Content: StoryObj = {
  render: () => {
    const [n, setN] = useState("5");
    return (
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
        <Select label="Questions" width="content" value={n} onChange={setN}
          options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
        <Live width="content" />
      </div>
    );
  },
};
export const Open: StoryObj = { render: () => <div style={{ maxWidth: "22rem", minHeight: "14rem" }}><Live open /></div> };
export const Disabled: StoryObj = {
  render: () => <div style={{ maxWidth: "22rem" }}><Select label="Voice" disabled value="eric" onChange={() => {}} options={VOICES} hint="Voices load when speech is installed." /></div>,
};
