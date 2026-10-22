/* Motion catalogue (docs/motion.md): every shared keyframe from global.css on a sample block, with a replay
 * button. Replaying remounts the block (a new key), which is also how the app avoids replays: same key, no replay. */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dots } from "./Dots";
import { Skeleton } from "./Skeleton";

const meta: Meta = { title: "DS/Motion" };
export default meta;

const box = {
  padding: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-raised)",
  border: "var(--border-width) solid var(--color-border-subtle)",
  minHeight: "var(--control-h-lg)",
};

function Row({ name, note, children }: { name: string; note: string; children: (key: number) => ReactNode }) {
  const [n, setN] = useState(0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "12rem minmax(0, 1fr) auto", gap: "var(--space-4)", alignItems: "center" }}>
      <div>
        <strong>{name}</strong>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{note}</div>
      </div>
      <div style={{ position: "relative" }}>{children(n)}</div>
      <Button size="sm" variant="secondary" icon="redo" onClick={() => setN(n + 1)}>Replay</Button>
    </div>
  );
}

const ONE_SHOT: [string, string, string][] = [
  ["rise-in", "motion-rise", "page / line entrance"],
  ["rise-in (base)", "motion-rise-base", "swaps, controls"],
  ["fade-in", "motion-fade", "pills, labels"],
  ["card-in", "motion-card", "feedback card"],
  ["row-in", "motion-row", "history rows"],
  ["menu-in", "motion-menu", "menus (none yet)"],
  ["dock-in", "motion-dock", "session controls"],
  ["meta-in", "motion-meta", "timer + status pill"],
  ["word-in", "motion-word", "streamed reply chunk"],
  ["soft-out", "motion-soft-out", "leaving Home"],
  ["fade-out", "motion-fade-out", "route exit"],
  ["row-out", "motion-row-out", "deleted row"],
];

function Catalogue() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: "52rem" }}>
      <p style={{ color: "var(--color-text-secondary)" }}>
        Turn on reduced motion in the OS to check that every row becomes instant and the loops stop.
      </p>
      {ONE_SHOT.map(([name, cls, note]) => (
        <Row key={name} name={name} note={note}>
          {(k) => <div key={k} className={cls} style={box}>Sample</div>}
        </Row>
      ))}
      <Row name="stagger" note="Home build-up, 80ms steps">
        {(k) => (
          <div key={k} className="motion-stagger" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={box}>One</div><div style={box}>Two</div><div style={box}>Three</div>
          </div>
        )}
      </Row>
      <Row name="dialog-in" note="dialog box">
        {(k) => <div key={k} style={{ ...box, animation: "dialog-in var(--duration-slow) var(--ease-enter) backwards" }}>Dialog</div>}
      </Row>
      <Row name="panel-in-x" note="feedback panel">
        {(k) => <div key={k} style={{ ...box, animation: "panel-in-x var(--duration-slower) var(--ease-standard) backwards" }}>Panel</div>}
      </Row>
      <Row name="shimmer-text" note="waiting lines (loop)">
        {(k) => <span key={k} className="shimmer-text">Getting your feedback ready…</span>}
      </Row>
      <Row name="dots" note="3-dot loader (loop)">{(k) => <Dots key={k} label="Thinking" showLabel />}</Row>
      <Row name="skeleton" note="ghost loading (loop)">{(k) => <Skeleton key={k} lines={2} />}</Row>
    </div>
  );
}
export const Keyframes: StoryObj = { render: () => <Catalogue /> };
