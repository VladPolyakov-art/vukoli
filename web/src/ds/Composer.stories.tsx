import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button, IconButton } from "./Button";
import { Composer, ComposerAttachment, type ComposerProps } from "./Composer";
import { Skeleton } from "./Skeleton";
import { TextShimmer } from "./TextShimmer";

/** Composer (G1): one rounded input with the attachment card, the field, a toolbar and the round send button inside.
 * `send.variant`: `quiet` on Home (Start stays the only primary), `action` in Session text mode. */
const meta: Meta<typeof Composer> = { title: "DS/Composer", component: Composer, tags: ["autodocs"] };
export default meta;
type Story = StoryObj<typeof Composer>;

const KESTREL = (
  <ComposerAttachment
    title="Kestrel Pay"
    meta="Senior Product Designer · Added Oct 18"
    preview="Own the end-to-end checkout experience for small merchants on web and mobile."
    status="12 questions from this job"
    actions={
      <>
        <IconButton icon="more" label="Kestrel Pay options" size="sm" />
        <IconButton icon="x" label="Remove job, use general questions" size="sm" />
      </>
    }
  />
);

const HOME_TOOLBAR = {
  toolbarStart: (
    <>
      <Button variant="secondary" size="sm" icon="upload">File</Button>
      <Button variant="secondary" size="sm" icon="folder" iconRight="chevronDown" aria-haspopup="listbox" aria-expanded={false}>Saved jobs</Button>
    </>
  ),
  toolbarEnd: <Button variant="secondary" size="sm" iconRight="chevronDown" aria-label="Strictness: Standard">Standard</Button>,
};

function Home(props: Partial<ComposerProps> & { initial?: string }) {
  const { initial = "", ...rest } = props;
  const [v, setV] = useState(initial);
  return (
    <Composer
      label="Paste a job description or a link"
      placeholder="Paste another job or a link"
      value={v}
      onChange={(e) => setV(e.target.value)}
      send={{ label: "Add this job", icon: "arrowRight", variant: "quiet", hidden: v.trim() === "" }}
      {...HOME_TOOLBAR}
      {...rest}
    />
  );
}

/** Home, returning user: job attached, send hidden until there is text. */
export const HomeWithAttachment: Story = { render: () => <Home attachment={KESTREL} /> };
/** Home, first visit: no job, toolbar shows only "File". */
export const HomeEmpty: Story = {
  render: () => (
    <Home
      placeholder="Paste a job description or a link (optional)"
      toolbarStart={<Button variant="secondary" size="sm" icon="upload">File</Button>}
      toolbarEnd={undefined}
    />
  ),
};
/** Pasted text: the quiet send button rises in. */
export const HomePasted: Story = {
  render: () => <Home attachment={KESTREL} initial="https://jobs.lumenhealth.example/product-designer-design-systems" />,
};
/** Job being prepared: status shimmers. */
export const HomePreparing: Story = {
  render: () => (
    <Home
      attachment={<ComposerAttachment title="Fieldnote" meta="Lead UX Designer · Added Oct 9" status={<TextShimmer status>Preparing questions…</TextShimmer>} />}
    />
  ),
};
/** Loading the saved job: skeleton row in the attachment slot, aria-busy. */
export const Loading: Story = { render: () => <Home busy attachment={<Skeleton variant="row" rows={1} label="Loading the job…" />} /> };
export const Error: Story = { render: () => <Home initial="kestrelpay.example/jobs/42" error="This link didn't open. Paste the job text instead." /> };
export const Disabled: Story = { render: () => <Home disabled attachment={KESTREL} /> };

function Session(props: Partial<ComposerProps>) {
  const [v, setV] = useState("");
  return (
    <Composer
      label="Your answer"
      placeholder="Type your answer"
      value={v}
      onChange={(e) => setV(e.target.value)}
      submitOnEnter
      send={{ label: "Send", icon: "send", variant: "action", disabled: v.trim() === "", onSend: () => setV("") }}
      hint="Enter to send · Shift+Enter for a new line"
      {...props}
    />
  );
}
/** Session text mode: black send button, Enter sends. */
export const SessionTyping: Story = { render: () => <Session /> };
/** QA-16: the field is focused: the box shows the focus ring (token ring, 2px offset) and the lighter fill. */
export const Focused: Story = {
  render: () => <div style={{ padding: "var(--space-2)" }}><Home attachment={KESTREL} initial="Product Manager at Kestrel Pay" /></div>,
  play: ({ canvasElement }) => { canvasElement.querySelector("textarea")?.focus(); },
};
/** Overflow: long answer grows to 8 rows, then scrolls; long attachment clamps to 2 lines. */
export const Overflow: Story = {
  render: () => (
    <Home
      attachment={
        <ComposerAttachment
          title="Kestrel Pay — Merchant Platform, Checkout, Payments and Onboarding Experience Group (Europe and North America)"
          meta="Senior Product Designer, Checkout and Merchant Onboarding (web, iOS, Android) · Added Oct 18"
          preview="Own the end-to-end checkout experience for small merchants on web and mobile, partner with engineering and risk."
          status="12 questions from this job"
          actions={<IconButton icon="x" label="Remove job, use general questions" size="sm" />}
        />
      }
      initial={Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: Own the end-to-end checkout experience for small merchants.`).join("\n")}
    />
  ),
};
/** Narrow parent (343px, the 375 frame): the toolbar end group drops to its own line. */
export const Narrow: Story = { render: () => <div style={{ width: "21.4375rem" }}><Home attachment={KESTREL} initial="Paste" /></div> };
/** v2 `surface: none`: no own box — the composer lives inside another surface (Session island in text mode). */
export const SurfaceNone: Story = {
  render: () => (
    <div style={{ width: "var(--layout-narrow)", maxWidth: "100%", padding: "var(--space-3)", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", background: "var(--color-raised)", boxShadow: "var(--shadow-raised)" }}>
      <Session surface="none" minRows={1} maxRows={6} hint={undefined} />
    </div>
  ),
};
/** v2 Home start: one row, mode chip + plus inside, the black send action appears with text. */
export const HomeStartV2: Story = {
  render: () => (
    <Home
      label="Message Mike"
      placeholder="Paste a job or a link, or say what you want to practise"
      minRows={1}
      initial="I have an HR screen with Lumen tomorrow"
      send={{ label: "Send", icon: "arrowRight", variant: "action" }}
      toolbarStart={(
        <>
          <Button variant="secondary" size="sm" icon="briefcase" iconRight="chevronDown" aria-label="Practice type: Interview">Interview</Button>
          <IconButton icon="plus" size="sm" outlined label="Add a job file" />
        </>
      )}
      toolbarEnd={undefined}
    />
  ),
};

/** D52 (Home, Gemini layout): with an empty field the end button is a round unlabelled action (mic = start a voice
 * session; its tooltip says what it starts); typing morphs it into the Send arrow. `send.busy` shows a spinner. */
function StartAction({ busy, disabled, icon = "mic" }: { busy?: boolean; disabled?: boolean; icon?: "mic" | "keyboard" }) {
  const [v, setV] = useState("");
  const empty = v.trim() === "";
  return (
    <Composer
      label="Message Mike"
      placeholder="Paste a job or a link, or say what you want to practise"
      value={v}
      minRows={1}
      submitOnEnter
      onChange={(e) => setV(e.target.value)}
      toolbarStart={(
        <>
          <IconButton icon="plus" size="sm" outlined label="Add a job file" />
          <Button variant="secondary" size="sm" icon="briefcase" iconRight="chevronDown">Interview</Button>
        </>
      )}
      send={empty
        ? { label: icon === "mic" ? "Start now — voice practice" : "Start now — typed practice", title: "General questions · Unseen mix · 5 questions", icon, variant: "action", busy, disabled }
        : { label: "Send", icon: "arrowRight", variant: "action" }}
    />
  );
}
export const StartActionMic: Story = { render: () => <StartAction /> };
export const StartActionKeyboard: Story = { render: () => <StartAction icon="keyboard" /> };
export const StartActionBusy: Story = { render: () => <StartAction busy /> };
export const StartActionDisabled: Story = { render: () => <StartAction disabled /> };
