import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { OverlayRoot } from "./OverlayRoot";
import { Toast, ToastProvider, useToast } from "./Toast";
import { t, tp } from "../i18n";

/* The toasts the app really shows (components/AppShell.tsx, screens/History.tsx, screens/Debrief.tsx): a neutral one
 * with "Undo" after archive, delete and move-back; an error; and the two after End (saving, then saved + "Open debrief").
 * D79: no "Saved" toasts for things the screen already shows (a rename, a setting). */
const meta: Meta = { title: "DS/Toast" };
export default meta;

/** Neutral with an action (open and static): Archive, Delete and "Move back to Recents" all end in "Undo". */
export const Neutral: StoryObj = {
  render: () => <Toast inline message={t("rail.archived")} action={{ label: t("common.undo"), onClick: () => {} }} onDismiss={() => {}} />,
};

/** System error: stays until dismissed, role="alert". */
export const ErrorTone: StoryObj = {
  render: () => <Toast inline tone="error" message={t("rail.renameFailed")} onDismiss={() => {}} />,
};

function Buttons() {
  const toast = useToast();
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", padding: "var(--space-4)" }}>
      <Button size="sm" onClick={() => toast.show({ message: t("rail.archived"), action: { label: t("common.undo"), onClick: () => toast.show({ message: t("history.toast.unarchived") }) } })}>{t("rail.rowArchive")}</Button>
      <Button size="sm" onClick={() => toast.show({ tone: "error", message: t("rail.renameFailed") })}>Show an error</Button>
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

/* D73/D74/D96: after End the shell goes Home and says the session is being saved. The toast stays (`duration: null`) and its
 * text follows the real work, in a shimmer: "Saving your session…" → "Preparing feedback · 2 of 5 answers" → "Writing your
 * debrief…" (SavingMessage in AppShell.tsx). */
const shimmer = (text: string): ReactNode => <span className="shimmer-text">{text}</span>;

/** D73/D74: first the session is being saved (stays, shimmer while real work runs)… */
export const AfterEndSaving: StoryObj = {
  render: () => <Toast inline message={shimmer(t("session.afterEnd.saving"))} onDismiss={() => {}} />,
};

/** D96: …then the feedback for each answer, with a live count… */
export const AfterEndPreparing: StoryObj = {
  render: () => <Toast inline message={shimmer(tp("session.afterEnd.preparing", 5, { done: 2 }))} onDismiss={() => {}} />,
};

/** D96: …then the debrief is being written… */
export const AfterEndDebrief: StoryObj = {
  render: () => <Toast inline message={shimmer(t("session.debriefPending"))} onDismiss={() => {}} />,
};

/** …then that it is ready, with the way to the debrief. */
export const AfterEndSaved: StoryObj = {
  render: () => <Toast inline message={t("session.afterEnd.ready")} action={{ label: t("session.afterEnd.open"), onClick: () => {} }} onDismiss={() => {}} />,
};
