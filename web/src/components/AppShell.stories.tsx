import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { Button, Card } from "../ds";
import { OverlayRoot } from "../ds/OverlayRoot";
import { AppShellView, NOOP_ACTIONS, type AppShellViewProps, type RecentState } from "./AppShell";
import { Page, Section } from "./Page";

/* Fixture: docs/ia.md §6 (Alex Morgan; S1–S3). Each story is a frame of a real width, scaled to fit, with its own
 * OverlayRoot (the drawer opens inside it) — the same set-up as the review page. */
const meta: Meta = { title: "Patterns/AppShell", parameters: { layout: "wide" } };
export default meta;

const READY: RecentState = {
  status: "ready",
  items: [
    { id: "s3", title: "Kestrel Pay · Senior Product Designer", track: "interview" },
    { id: "s2", title: "English practice", track: "english" },
    { id: "s1", title: "Lumen Health · Product Designer, Design Systems", track: "interview" },
    { id: "s0", title: "Interview practice", track: "interview" },
  ],
};
const ENGINE = { name: "Ollama · qwen3:4b", status: "ready" as const };

function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={outer} style={{ width: "100%", maxWidth: width, height: height * scale, overflow: "hidden", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
        <OverlayRoot>{children}</OverlayRoot>
      </div>
    </div>
  );
}

function SamplePage({ start }: { start?: boolean }) {
  return start ? (
    <Page layout="start" title="Good evening, Alex">
      <Card padding="md"><p>The start column: centred header, 720px column (Home builds its content here).</p></Card>
    </Page>
  ) : (
    <Page title="Archive" sub="Chats you moved out of Recents. Open any of them, or bring one back." actions={<Button variant="link" size="sm" icon="trash">Trash (1)</Button>}>
      <Section title="This week" id="sample-week">
        <Card padding="md"><p>Page rhythm: header to blocks --space-10, groups --space-4, rows --space-2.</p></Card>
      </Section>
      <Section title="Last week" id="sample-last">
        <Card padding="md"><p>Lumen Health · Product Designer, Design Systems</p></Card>
      </Section>
    </Page>
  );
}

function Shell({ width, height, path = "/archive", start, ...props }: Partial<AppShellViewProps> & { width: number; height: number; path?: string; start?: boolean }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Scaled width={width} height={height}>
        <AppShellView current={start ? "practice" : "archive"} recent={READY} engine={ENGINE} userName="Alex" {...props}>
          <SamplePage start={start} />
        </AppShellView>
      </Scaled>
    </MemoryRouter>
  );
}

/** ≥ 1024, expanded (D57, claude.ai sidebar): brand + toggle, New practice (round plus), Recents (one line each, no dates),
 * Archive (D80, replaced History), the account row at the bottom (name + engine in use). */
export const Expanded: StoryObj = { render: () => <Shell width={1440} height={900} /> };

/** ≥ 1024, collapsed to the icon rail: the toggle, the round plus and the avatar, each with a tooltip (hover or focus one). */
export const Collapsed: StoryObj = { render: () => <Shell width={1440} height={900} collapsed /> };

/** The account row opened upward: the name, Settings, Appearance, Privacy and data. */
export const AccountMenuOpen: StoryObj = { render: () => <Shell width={1440} height={900} initialMenu="account" /> };
export const AccountMenuOpenCollapsed: StoryObj = { render: () => <Shell width={1440} height={900} collapsed initialMenu="account" /> };

/** The "…" menu of a chat row (shown on hover or focus): Open, Move to Trash. */
export const RowMenuOpen: StoryObj = { render: () => <Shell width={1440} height={900} initialMenu="row" actions={NOOP_ACTIONS} /> };

const SAVING = (progress?: { done: number; total: number; stage: "feedback" | "debrief" }): RecentState => ({
  status: "ready",
  items: [{ id: "s4", title: "Kestrel Pay · Senior Product Designer", track: "interview", pending: true, progress }, ...(READY.status === "ready" ? READY.items : [])],
});

/** After End (D73): the session is the top row of Recents at once, its title shimmering (no "Saving…" toast, no
 * full-screen state); the row is still a link. Plain secondary text under reduced motion. */
export const RecentsSaving: StoryObj = { render: () => <Shell width={1440} height={900} path="/" start recent={SAVING()} /> };
/** The server has said how far it is: "2 of 5" sits in the trailing slot. */
export const RecentsPreparing: StoryObj = { render: () => <Shell width={1440} height={900} path="/" start recent={SAVING({ done: 2, total: 5, stage: "feedback" })} /> };
/** The same in the drawer below 1024. */
export const RecentsSavingDrawer: StoryObj = {
  render: () => <Shell width={375} height={812} drawerOpen onDrawerOpenChange={() => {}} recent={SAVING({ done: 2, total: 5, stage: "feedback" })} />,
};

/** Home start layout (Page layout="start"). */
export const DesktopStart: StoryObj = { render: () => <Shell width={1440} height={900} path="/" start /> };

/** 640–1023: top bar (menu, app name; a Not ready badge only when the engine is down); the sidebar lives in a drawer. */
export const Tablet: StoryObj = { render: () => <Shell width={800} height={720} /> };

/** < 640: the same top bar; page column narrow (< 560). */
export const Mobile: StoryObj = { render: () => <Shell width={375} height={812} /> };

/** < 1024 with the sidebar drawer open (always expanded; its toggle closes the drawer). */
export const MobileDrawerOpen: StoryObj = { render: () => <Shell width={375} height={812} drawerOpen onDrawerOpenChange={() => {}} /> };
export const MobileDrawerAccountMenu: StoryObj = { render: () => <Shell width={375} height={812} drawerOpen onDrawerOpenChange={() => {}} initialMenu="account" /> };

/** Recents loading (skeleton) and the engine check in progress. */
export const Loading: StoryObj = {
  render: () => <Shell width={1440} height={900} recent={{ status: "loading" }} engine={{ status: "checking" }} />,
};

/** Engine not ready: a warning row above the account (→ Settings · AI engine) and the badge in the top bar (P6). */
export const EngineNotReady: StoryObj = {
  render: () => <Shell width={1440} height={900} engine={{ name: "Ollama · qwen3:4b", status: "notReady" }} />,
};
/** Collapsed: the warning row becomes a warning icon with a tooltip. */
export const EngineNotReadyCollapsed: StoryObj = {
  render: () => <Shell width={1440} height={900} collapsed engine={{ name: "Ollama · qwen3:4b", status: "notReady" }} />,
};
export const EngineNotReadyTablet: StoryObj = {
  render: () => <Shell width={800} height={720} engine={{ name: "Ollama · qwen3:4b", status: "notReady" }} />,
};

/** First run: no sessions yet, no engine chosen. */
export const Empty: StoryObj = {
  render: () => <Shell width={1440} height={900} path="/" start recent={{ status: "ready", items: [] }} engine={{ status: "notReady" }} />,
};

/** A debrief listed in Recents: its row is current, no nav row is. */
export const DebriefCurrent: StoryObj = {
  render: () => <Shell width={1440} height={900} path="/sessions/s3" current={null} currentSessionId="s3" />,
};
/** The account row names the engine compactly: "Antigravity (CLI)", not the server's long name. */
export const EngineCli: StoryObj = {
  render: () => <Shell width={1440} height={900} engine={{ name: "Antigravity (CLI)", status: "ready" }} />,
};
