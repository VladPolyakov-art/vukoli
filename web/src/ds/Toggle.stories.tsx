import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Toggle } from "./Toggle";

const meta: Meta = { title: "DS/Toggle" };
export default meta;

function Demo({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div style={{ maxWidth: "28rem" }}>
      <Toggle label="Answer suggester" description="Practice only. Shows a sample answer you can study." checked={on} onChange={setOn} />
    </div>
  );
}
export const Off: StoryObj = { render: () => <Demo initial={false} /> };
export const On: StoryObj = { render: () => <Demo initial /> };
export const Disabled: StoryObj = { render: () => <Toggle label="Mike speaks" checked={false} onChange={() => {}} disabled /> };
