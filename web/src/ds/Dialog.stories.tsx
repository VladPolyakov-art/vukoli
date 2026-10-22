import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { OverlayRoot } from "./OverlayRoot";

/* Fixture: docs/ia.md §6 (Alex Morgan; Kestrel Pay, Lumen Health). */
const meta: Meta = { title: "DS/Dialog" };
export default meta;

const endActions = (close: () => void) => (
  <>
    <Button variant="ghost" onClick={close}>Keep going</Button>
    <Button variant="primary" onClick={close}>End and see debrief</Button>
  </>
);

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>End round…</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="End this round?" actions={endActions(() => setOpen(false))}>
        <p>You answered 2 of 5 questions. The debrief covers what you answered.</p>
      </Dialog>
    </>
  );
}

/** A box the size of a phone frame with its own OverlayRoot: the dialog stays inside it (review page behaviour). */
function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ width, maxWidth: "100%", height, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>{children}</OverlayRoot>
    </div>
  );
}

function Contained() {
  const [open, setOpen] = useState(true);
  return (
    <Frame width={375} height={520}>
      <div style={{ padding: "var(--space-4)" }}>
        <Button onClick={() => setOpen(true)}>Delete job…</Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete Kestrel Pay?"
        actions={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => setOpen(false)}>Delete job</Button></>}
      >
        <p>Your two sessions for this job stay in Recents and Archive.</p>
      </Dialog>
    </Frame>
  );
}

/** Interactive: native showModal() (the app). */
export const Default: StoryObj = { render: () => <Demo /> };

/** Open and static, in the flow (gallery, review). */
export const InlineOpen: StoryObj = {
  render: () => (
    <Dialog inline open onClose={() => {}} title="End this round?" actions={endActions(() => {})}>
      <p>You answered 2 of 5 questions. The debrief covers what you answered.</p>
    </Dialog>
  ),
};

/** D80: confirming a delete (sidebar "…" → Delete, Archive, debrief menu): the confirm button is red (`danger`). */
export const DeleteConfirm: StoryObj = {
  render: () => (
    <Dialog inline open onClose={() => {}} title="Delete this chat?" actions={<><Button onClick={() => {}}>Cancel</Button><Button variant="danger" onClick={() => {}}>Delete</Button></>}>
      <p>“Kestrel Pay · Senior Product Designer” and its debrief leave the app. You can bring it back from Trash in Settings → Privacy and data.</p>
    </Dialog>
  ),
};

/** A secondary action on the left (actionsStart). */
export const WithStartAction: StoryObj = {
  render: () => (
    <Dialog
      inline
      open
      onClose={() => {}}
      title="Edit job"
      actionsStart={<Button variant="ghost">Delete job</Button>}
      actions={<><Button variant="ghost">Cancel</Button><Button variant="primary">Save job</Button></>}
    >
      <p>Kestrel Pay · Senior Product Designer. Mike asks about this role and its requirements.</p>
    </Dialog>
  ),
};

/** Under 480px of dialog width the actions stack, primary on top. */
export const Narrow: StoryObj = {
  render: () => (
    <div style={{ width: 343, maxWidth: "100%" }}>
      <Dialog inline open onClose={() => {}} title="End this round?" actions={endActions(() => {})}>
        <p>You answered 2 of 5 questions. The debrief covers what you answered.</p>
      </Dialog>
    </div>
  ),
};

/** Inside an OverlayRoot (review frame): scrim element instead of the top layer, focus trapped in the frame. */
export const InFrame: StoryObj = { render: () => <Contained /> };
