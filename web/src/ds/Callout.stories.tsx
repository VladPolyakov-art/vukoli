import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout } from "./Callout";
import { Button, IconButton } from "./Button";
import { CopyField } from "./CopyField";

/** Callout: copy and prop combinations are the ones the screens use (locale file, 2026-10-25). `live="alert"` for an error
 * that answers an action, `live="status"` for a passive notice, none for a static line; `icon` overrides the tone's icon. */
const meta: Meta<typeof Callout> = { title: "DS/Callout", component: Callout };
export default meta;
type Story = StoryObj<typeof Callout>;

/** Debrief with too few answers: title + body, a passive notice. */
export const Info: Story = {
  args: {
    title: "Not enough answers for a verdict",
    children: "You answered 2 of 5 questions. Answer at least 3 and you'll get a verdict and weak spots.",
    live: "status",
  },
};
/** Body only, no title (Settings → Voice). */
export const InfoBodyOnly: Story = { args: { children: "Mike's voice isn't installed. He'll show his questions as text." } };
/** Home engine banner: title, a body with the command to copy, actions, `live="status"`. */
export const Warning: Story = {
  args: {
    tone: "warning",
    live: "status",
    title: "Mike can't start yet",
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <p style={{ margin: 0 }}>The AI model (Ollama) isn't running. Open the Ollama app, or paste this into Terminal:</p>
        <CopyField value="ollama serve" label="Command" copyLabel="Copy command" copiedLabel="Copied" />
        <p style={{ margin: 0 }}>We check again every 5 seconds.</p>
      </div>
    ),
    actions: <Button variant="secondary" size="sm" icon="refresh">Try again now</Button>,
  },
};
/** Error with an action, `live="alert"` (the debrief could not be opened). */
export const Error: Story = {
  args: {
    tone: "error",
    live: "alert",
    title: "We couldn't open this debrief.",
    children: "The session file may be damaged.",
    actions: <Button variant="secondary" size="sm" icon="refresh">Try again</Button>,
  },
};
/** Success notice in Trash (`live="status"`). */
export const Success: Story = { args: { tone: "success", live: "status", children: "Restored." } };
/** `icon` override: a warning about the browser keeps its own icon (globe) and a dismiss IconButton beside the action. */
export const IconOverride: Story = {
  args: {
    tone: "warning",
    icon: "globe",
    title: "This browser can't recognise speech",
    children: "Use Chrome or Edge for voice, or answer by typing. You can switch back any time.",
    actions: (
      <>
        <Button variant="secondary" size="sm" icon="keyboard">Use text mode</Button>
        <IconButton icon="x" size="sm" label="Dismiss for this session" />
      </>
    ),
  },
};
/** `icon` on an info callout: the install card (monitor icon). */
export const InstallCard: Story = {
  args: {
    icon: "monitor",
    children: "Install Vukoli as an app: its own window and icon in the Dock.",
    actions: (
      <>
        <Button variant="secondary" size="sm" icon="download">Install</Button>
        <IconButton icon="x" size="sm" label="Not now" />
      </>
    ),
  },
};
