import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { OverlayRoot } from "./OverlayRoot";
import { Toast, ToastProvider, useToast } from "./Toast";
import { t } from "../i18n";

const meta: Meta = { title: "DS/Toast" };
export default meta;

/** Neutral with an action (open and static). */
export const Neutral: StoryObj = {
  render: () => <Toast inline message="Moved to Trash." action={{ label: "Undo", onClick: () => {} }} onDismiss={() => {}} />,
};

/** Message only. */
export const MessageOnly: StoryObj = { render: () => <Toast inline message="Title saved." /> };

/** System error: stays until dismissed, role="alert". */
export const ErrorTone: StoryObj = {
  render: () => <Toast inline tone="error" message="Couldn't move the session to Trash. Check that the app server is running." onDismiss={() => {}} />,
};

function Buttons() {
  const toast = useToast();
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", padding: "var(--space-4)" }}>
      <Button size="sm" onClick={() => toast.show({ message: "Moved to Trash.", action: { label: "Undo", onClick: () => toast.show({ message: "Restored." }) } })}>Move to Trash</Button>
      <Button size="sm" onClick={() => toast.show({ tone: "error", message: "Couldn't save the title. Try again." })}>Show an error</Button>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 720, maxWidth: "100%", height: 320, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>{children}</OverlayRoot>
    </div>
  );
}

/** Interactive (provider in a frame): drop-in from the top, auto-hide after 5 s (paused on hover / focus), max 3. */
export const Interactive: StoryObj = {
  render: () => (
    <Frame>
      <ToastProvider><Buttons /></ToastProvider>
    </Frame>
  ),
};

/** D73/D74: after End the shell goes Home and says the session is being saved (stays, shimmer while real work runs)… */
export const AfterEndSaving: StoryObj = {
  render: () => <Toast inline message={<span className="shimmer-text">{t("session.afterEnd.saving")}</span>} onDismiss={() => {}} />,
};

/** …then that it is ready, with the way to the debrief. */
export const AfterEndSaved: StoryObj = {
  render: () => <Toast inline message={t("session.afterEnd.ready")} action={{ label: t("session.afterEnd.open"), onClick: () => {} }} onDismiss={() => {}} />,
};
