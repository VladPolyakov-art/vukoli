import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Input, Textarea } from "./Field";
import { IconButton } from "./Button";

const meta: Meta = { title: "DS/Field" };
export default meta;

export const TextInput: StoryObj = {
  render: () => <div style={{ maxWidth: "24rem" }}><Input label="Base URL" defaultValue="http://localhost:1234/v1" hint="Where your local server listens." /></div>,
};
export const WithError: StoryObj = {
  render: () => <div style={{ maxWidth: "24rem" }}><Input label="Model" defaultValue="" error="Enter a model name, for example qwen3:4b-instruct." /></div>,
};
function KeyDemo() {
  const [show, setShow] = useState(false);
  return (
    <div style={{ maxWidth: "24rem" }}>
      <Input
        label="API key"
        type={show ? "text" : "password"}
        defaultValue="sk-example-not-real"
        optionalText="stored on this computer"
        adornment={<IconButton icon="eye" label={show ? "Hide key" : "Show key"} size="sm" pressed={show} onClick={() => setShow(!show)} />}
      />
    </div>
  );
}
export const SecretInput: StoryObj = { render: () => <KeyDemo /> };
export const TextArea: StoryObj = {
  render: () => (
    <div style={{ maxWidth: "32rem" }}>
      <Textarea label="Your CV" optionalText="optional" showCount value="Alex Morgan — product designer, 6 years in fintech." onChange={() => {}} />
    </div>
  ),
};
