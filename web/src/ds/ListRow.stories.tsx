import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ReactNode } from "react";
import { Badge } from "./Badge";
import { Button, IconButton } from "./Button";
import { Icon } from "./icons";
import { ListRow, ListRows } from "./ListRow";
import { Menu } from "./Menu";

/* The only real use: the Archive list (screens/history/HistoryView.tsx). Fixture: docs/ia.md §6, debrief.md §4 (S1–S3);
 * overflow rows are the separate stress fixture. The rail rows are NavRow, not ListRow. */
const meta: Meta = { title: "DS/ListRow", parameters: { layout: "wide" } };
export default meta;

interface Fixture { id: string; title: string; question?: string; track: "interview" | "english"; round: string; when: string; length: string; result: string }
const S: Fixture[] = [
  { id: "s3", title: "Kestrel Pay · Senior Product Designer", question: "Tell me about a design decision you changed after seeing the data.", track: "interview", round: "Behavioural · Standard", when: "Oct 19, 8:40 PM", length: "24 min", result: "Getting there" },
  { id: "s2", title: "English · Talk about your work", track: "english", round: "B2", when: "Oct 18, 9:05 PM", length: "11 min", result: "5 corrections" },
  { id: "s1", title: "Lumen Health · Product Designer, Design Systems", question: "Why do you want to move from agency work to a product team?", track: "interview", round: "HR screen · Gentle", when: "Oct 17, 19:10", length: "14 min", result: "Not ready yet" },
];
const OVERFLOW: Fixture[] = [
  { id: "o1", title: "Kestrel Pay · Senior Product Designer", question: "Walk me through your career so far.", track: "interview", round: "Behavioural · Standard", when: "Oct 20, 8:15 AM", length: "6 min", result: "No verdict — 2 of 5 answered" },
  ...S,
  { id: "o2", title: "Lumen HR screen — calmer second try", track: "interview", round: "HR screen · Gentle", when: "Oct 16, 18:30", length: "13 min", result: "Getting there" },
  { id: "o3", title: "Northwind Logistics International · Senior Product Designer, Platform and Internal Tools", track: "interview", round: "Technical · Tough", when: "Oct 9, 17:00", length: "31 min", result: "Not ready yet" },
  { id: "o4", title: "English · Explaining a delayed release to a client without sounding defensive", track: "english", round: "C1", when: "Oct 11, 20:10", length: "16 min", result: "8 corrections" },
];

function Row({ f, rename, enterIndex, tooltipOpen, leaving }: { f: Fixture; rename?: boolean; enterIndex?: number; tooltipOpen?: boolean; leaving?: boolean }) {
  return (
    <ListRow
      title={f.title}
      href={`#/sessions/${f.id}`}
      icon={f.track === "english" ? "chat" : "briefcase"}
      sub={f.question}
      enterIndex={enterIndex}
      leaving={leaving}
      tooltipOpen={tooltipOpen}
      meta={
        <>
          <Badge tone="outline">{f.track === "english" ? "English" : "Interview"}</Badge>
          <span>{f.round}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}><Icon name="clock" size="sm" />{f.when} · {f.length}</span>
        </>
      }
      result={f.result}
      actions={
        <>
          <IconButton icon="edit" size="sm" label={`Rename ${f.title}`} />
          <IconButton icon="archive" size="sm" label={`Move ${f.title} back to Recents`} />
          <IconButton icon="trash" size="sm" label={`Delete ${f.title}`} />
        </>
      }
      compactActions={
        <Menu
          label={`More actions for ${f.title}`}
          items={[
            { id: "rename", label: "Rename", icon: "edit" },
            { id: "unarchive", label: "Move back to Recents", icon: "archive" },
            { id: "sep", separator: true },
            { id: "trash", label: "Delete", icon: "trash" },
          ]}
          placement="bottom-end"
          trigger={(p) => <IconButton {...p} icon="more" size="sm" label={`More actions for ${f.title}`} />}
        />
      }
      rename={rename ? { value: "Lumen Health · HR screen, first try", onSave: () => {}, onCancel: () => {}, autoFocus: false } : undefined}
    />
  );
}

/** A `page` container of a given width, as <main> is in the app (narrow < 560 switches the actions). */
function PageBox({ width, children }: { width: number | string; children: ReactNode }) {
  return <div style={{ width, maxWidth: "100%", containerType: "inline-size", containerName: "page" }}>{children}</div>;
}

/** Archive rows (S1–S3): title, first question (`sub`), meta, result, three actions (rename, move back to Recents,
 * delete). Hover or focus a row to see the actions; on touch they are always shown. */
export const Default: StoryObj = {
  render: () => (
    <PageBox width={760}>
      <ListRows label="This week">{S.map((f) => <Row key={f.id} f={f} />)}</ListRows>
    </PageBox>
  ),
};

/** Renaming: the Lumen row becomes InlineRename (35 / 80). */
export const Renaming: StoryObj = {
  render: () => (
    <PageBox width={760}>
      <ListRows>{S.map((f) => <Row key={f.id} f={f} rename={f.id === "s1"} />)}</ListRows>
    </PageBox>
  ),
};

/** Narrow page column (375): title on 2 lines, one `more` button → menu (Rename, Move back to Recents, Delete). */
export const Narrow: StoryObj = {
  render: () => (
    <PageBox width={375}>
      <ListRows>{S.map((f) => <Row key={f.id} f={f} />)}</ListRows>
    </PageBox>
  ),
};

/** Overflow (7 rows, long titles): ellipsis + tooltip, the long one forced open. */
export const Overflow: StoryObj = {
  render: () => (
    <PageBox width={760}>
      <ListRows>{OVERFLOW.map((f) => <Row key={f.id} f={f} tooltipOpen={f.id === "o3"} />)}</ListRows>
    </PageBox>
  ),
};

function EnterDemo() {
  const [key, setKey] = useState(0);
  return (
    <PageBox width={760}>
      <div style={{ marginBottom: "var(--space-3)" }}><Button size="sm" icon="redo" onClick={() => setKey((k) => k + 1)}>Replay</Button></div>
      <ListRows key={key}>{S.map((f, i) => <Row key={f.id} f={f} enterIndex={i} />)}</ListRows>
    </PageBox>
  );
}

/** Enter motion: rows rise in from the left, 40ms apart (none under reduced motion). */
export const Entering: StoryObj = { render: () => <EnterDemo /> };

function LeaveDemo() {
  const [key, setKey] = useState(0);
  return (
    <PageBox width={760}>
      <div style={{ marginBottom: "var(--space-3)" }}><Button size="sm" icon="redo" onClick={() => setKey((k) => k + 1)}>Replay</Button></div>
      <ListRows key={key}>
        <Row f={S[0]!} />
        <Row f={S[1]!} leaving />
        <Row f={S[2]!} />
      </ListRows>
    </PageBox>
  );
}

/** Leave motion: moving a row back to Recents or deleting it plays `row-out` (the caller removes the row after `--duration-exit`). */
export const Leaving: StoryObj = { render: () => <LeaveDemo /> };
