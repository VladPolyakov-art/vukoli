import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Badge } from "./Badge";
import { Button, IconButton } from "./Button";
import { Drawer, type DrawerSide } from "./Drawer";
import { NavRow } from "./NavRow";
import { OverlayRoot } from "./OverlayRoot";
import { t } from "../i18n";

const meta: Meta = { title: "DS/Drawer" };
export default meta;

/* The real rail (components/AppShell.tsx, Rail): a top row with the sidebar toggle (the drawer has no title, so no
 * second ×), New practice, Archive, Recents (chat rows, "EN" at the end of an English one), the "AI engine" warning with
 * a Badge when the engine is not ready, and the account row. Not here: a "Vukoli" title, a Settings row (Settings is in
 * the account menu). The brand lockup and the account button are AppShell patterns, not DS parts; NavRow stands in. */
const railBody = (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minHeight: "100%" }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <IconButton icon="sidebar" size="sm" label={t("rail.toggleClose")} />
    </div>
    <nav aria-label={t("nav.main")} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <NavRow href="#new" label={t("nav.newPractice")} icon="plus" current />
      <NavRow href="#archive" label={t("rail.archive")} icon="archive" />
    </nav>
    <section aria-labelledby="rail-recents" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", flex: "1 1 auto" }}>
      <h2 id="rail-recents" style={{ margin: 0, padding: "0 var(--space-3)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--color-text-secondary)" }}>{t("rail.recents")}</h2>
      <NavRow href="#s1" label="Kestrel Pay · Senior Product Designer" />
      <NavRow href="#s2" label="Lumen Health · Product Designer" />
      <NavRow href="#s3" label="Small talk at work" end={<span title={t("rail.english")}>EN</span>} />
    </section>
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <NavRow href="#engine" label={t("rail.engineWarning")} icon="cpu" end={<Badge tone="warning" icon="alert">{t("rail.notReady")}</Badge>} />
      <NavRow href="#account" label={`${t("rail.you")} · ${t("rail.local")}`} icon="user" />
    </div>
  </div>
);
/* Session feedback (screens/session/SessionView.tsx): the panel body, and the "Next question" button as the footer. */
const feedbackBody = (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
    <p><strong style={{ color: "var(--color-text-primary)" }}>Question 2 of 5.</strong> Clear situation and a concrete result: the checkout redesign cut drop-off for small merchants.</p>
    <p>Say what you did yourself, not the team: "I ran the usability sessions" instead of "we tested".</p>
  </div>
);
const nextQuestion = (
  <Button variant="primary" fullWidth iconRight="arrowRight">{t("session.panel.nextQuestion")}</Button>
);

function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ width, maxWidth: "100%", height, border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-canvas)" }}>
      <OverlayRoot>{children}</OverlayRoot>
    </div>
  );
}

function Demo({ side, startOpen = false }: { side: DrawerSide; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const left = side === "left";
  return (
    <Frame width={left || side === "bottom" ? 375 : 720} height={560}>
      <div style={{ padding: "var(--space-4)" }}>
        <Button onClick={() => setOpen(true)}>{left ? t("rail.openMenu") : t("session.island.feedbackShow")}</Button>
      </div>
      {left ? (
        <Drawer open={open} onClose={() => setOpen(false)} side="left" label={t("rail.menu")}>{railBody}</Drawer>
      ) : (
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          side={side}
          label={t("feedback.panel")}
          title={t("feedback.panel")}
          closeLabel={t("session.island.feedbackHide")}
          footer={nextQuestion}
          duration="slower"
        >
          {feedbackBody}
        </Drawer>
      )}
    </Frame>
  );
}

/** Left: the rail below 1024 (sidebar surface), open and static. No `title` (the rail has its own toggle and no "Vukoli" heading) and no Settings row. */
export const LeftRail: StoryObj = {
  render: () => (
    <Drawer inline open onClose={() => {}} side="left" label={t("rail.menu")}>{railBody}</Drawer>
  ),
};

/** Right: the Session feedback panel at mid width, open and static. A title with a × (`closeLabel`), the "Next question" footer, entrance `slower`. */
export const RightPanel: StoryObj = {
  render: () => (
    <Drawer inline open onClose={() => {}} side="right" label={t("feedback.panel")} title={t("feedback.panel")} closeLabel={t("session.island.feedbackHide")}
      footer={nextQuestion} duration="slower">
      {feedbackBody}
    </Drawer>
  ),
};

/** Bottom: the feedback sheet on a phone, open and static. Same title, × and footer as the right panel. */
export const BottomSheet: StoryObj = {
  render: () => (
    <div style={{ width: 375, maxWidth: "100%" }}>
      <Drawer inline open onClose={() => {}} side="bottom" label={t("feedback.panel")} title={t("feedback.panel")} closeLabel={t("session.island.feedbackHide")}
        footer={nextQuestion} duration="slower">
        {feedbackBody}
      </Drawer>
    </div>
  ),
};

/** Interactive in a frame (OverlayRoot): slide in, scrim, Esc / scrim click close, focus returns. */
export const InteractiveLeft: StoryObj = { render: () => <Demo side="left" startOpen /> };
export const InteractiveRight: StoryObj = { render: () => <Demo side="right" /> };
export const InteractiveBottom: StoryObj = { render: () => <Demo side="bottom" /> };

/** QA-09: long feedback with no control inside the sheet. The scrolling area takes keyboard focus (named region), so the
 * arrow keys scroll it; a sheet that fits, or holds a button, adds no extra Tab stop. */
export const BottomSheetScrolls: StoryObj = {
  render: () => (
    <Frame width={375} height={360}>
      <Drawer open onClose={() => {}} side="bottom" label={t("feedback.panel")} title={t("feedback.panel")} closeLabel={t("session.island.feedbackHide")} duration="slower">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i}>Question {i + 1}: clear situation and a concrete result. Say what you did yourself, not the team.</p>
          ))}
        </div>
      </Drawer>
    </Frame>
  ),
};
