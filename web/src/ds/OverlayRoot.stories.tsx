import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button, IconButton } from "./Button";
import { Dialog } from "./Dialog";
import { Drawer } from "./Drawer";
import { Menu } from "./Menu";
import { NavRow } from "./NavRow";
import { OverlayRoot } from "./OverlayRoot";
import { ToastProvider, useToast } from "./Toast";
import { Tooltip } from "./Tooltip";

const meta: Meta = { title: "DS/OverlayRoot", parameters: { layout: "wide" } };
export default meta;

function Controls() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const toast = useToast();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4)" }}>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
        Everything below opens inside this frame, not over the page: the review page wraps each frame in an OverlayRoot.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
        <Button size="sm" onClick={() => setDialog(true)}>Dialog</Button>
        <Button size="sm" onClick={() => setDrawer(true)}>Drawer</Button>
        <Button size="sm" onClick={() => toast.show({ message: "Moved to Trash.", action: { label: "Undo", onClick: () => {} } })}>Toast</Button>
        <Menu
          label="More actions for this session"
          items={[{ id: "download", label: "Download as Markdown", icon: "download" }, { id: "trash", label: "Move to Trash", icon: "trash" }]}
          trigger={(p) => <IconButton {...p} icon="more" size="sm" label="More actions for this session" />}
        />
        <Tooltip content="Saved on this computer only"><IconButton icon="lock" size="sm" label="Storage" /></Tooltip>
      </div>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="End this round?"
        actions={<><Button variant="ghost" onClick={() => setDialog(false)}>Keep going</Button><Button variant="primary" onClick={() => setDialog(false)}>End and see debrief</Button></>}
      >
        <p>You answered 2 of 5 questions. The debrief covers what you answered.</p>
      </Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} side="left" label="Menu" title="Vukoli">
        <nav aria-label="Main" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <NavRow href="#practice" label="Home" icon="practice" current />
          <NavRow href="#history" label="Archive" icon="history" />
          <NavRow href="#settings" label="Settings" icon="settings" />
        </nav>
      </Drawer>
    </div>
  );
}

function FrameDemo({ width }: { width: number }) {
  return (
    <div style={{ width, maxWidth: "100%", height: 560, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>
        <ToastProvider><Controls /></ToastProvider>
      </OverlayRoot>
    </div>
  );
}

/** A 375 frame: menus become full-width sheets (layer narrower than 640). */
export const PhoneFrame: StoryObj = { render: () => <FrameDemo width={375} /> };

/** A wide frame: anchored popovers. */
export const WideFrame: StoryObj = { render: () => <FrameDemo width={900} /> };
