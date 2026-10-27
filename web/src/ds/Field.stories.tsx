import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Input, Textarea } from "./Field";
import { IconButton } from "./Button";
import { Icon } from "./icons";
import { SettingRow } from "./SettingRow";

const meta: Meta = { title: "DS/Field" };
export default meta;

/** Visible label + hint (the OpenAI-compatible engine form). */
export const TextInput: StoryObj = {
  render: () => <div style={{ maxWidth: "24rem" }}><Input label="Base URL" defaultValue="http://localhost:1234/v1" hint="The address that ends in /v1." /></div>,
};
function KeyDemo() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ maxWidth: "24rem" }}>
      <Input
        label="API key"
        type={show ? "text" : "password"}
        defaultValue="sk-example-not-real"
        optionalText="optional"
        hint="Stored only on this computer. Local servers usually don't need one."
        adornment={<IconButton icon="eye" label={show ? "Hide key" : "Show key"} size="sm" pressed={show} onClick={() => setShow(!show)} />}
      />
    </div>
  );
}
export const SecretInput: StoryObj = { render: () => <KeyDemo /> };
/** Visible label, `showCount` (the job description in the job editor). */
export const TextArea: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "32rem" }}>
      <Textarea label="Job description" placeholder="Paste the job description" rows={8} showCount value="" onChange={() => {}} />
    </div>
  ),
};
/** Hidden label (`hideLabel`, still announced): the row says what the field is. Settings → General, Setup → About you. */
export const HiddenLabelInput: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "40rem", containerType: "inline-size" }}>
      <SettingRow label="Name" description="Mike calls you by it in practice. It also shows in the sidebar.">
        <Input label="Name" hideLabel placeholder="e.g. Alex" defaultValue="" maxLength={40} autoComplete="given-name" spellCheck={false} />
      </SettingRow>
    </div>
  ),
};
/** Hidden label under a Disclosure (Settings → Your CV and files): the text about yourself. */
export const HiddenLabelTextarea: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "32rem" }}>
      <Textarea label="Your text" hideLabel placeholder="Paste your CV, or a few lines about your experience." rows={8} showCount value="" onChange={() => {}} />
    </div>
  ),
};
function SearchDemo() {
  const [q, setQ] = useState("");
  return (
    <div style={{ maxWidth: "18rem" }} role="search">
      {/* The app hides the browser's own clear button (Settings.module.css); ours replaces it. */}
      <style>{`[type="search"]::-webkit-search-cancel-button { appearance: none; display: none; }`}</style>
      <Input
        type="search"
        label="Search settings"
        hideLabel
        placeholder="Search settings"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        adornment={q
          ? <IconButton icon="x" size="sm" label="Clear search" onClick={() => setQ("")} />
          : <span style={{ display: "inline-flex", paddingRight: "var(--space-2)", color: "var(--color-text-secondary)" }}><Icon name="search" size="sm" /></span>}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}
/** The Settings search: a search icon while empty, a clear button once there is text. */
export const SearchField: StoryObj = { render: () => <SearchDemo /> };
