import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { SearchResult } from "../../lib/types";
import { SearchDialogView, type SearchDialogViewProps } from "./SearchDialog";

/* D105: search across past practices (sidebar "Search", ⌘K / Ctrl+K). Open and static, in the flow; states by props.
 * Fixture: docs/ia.md §6 (Alex Morgan, Kestrel Pay). Copy is from i18n/en.json (search.*). ↑ / ↓ move the highlight in
 * the stories too; Enter and a click do nothing here. */
const meta: Meta = { title: "Patterns/Search", parameters: { layout: "padded" } };
export default meta;

const HITS: SearchResult[] = [
  {
    id: "s-1", title: "Kestrel Pay · Product Manager", subtitle: "27 Oct 2026", mode: "interview", archived: false, started_at: "2026-10-27T10:00:00+01:00",
    match: { field: "title", snippet: "Kestrel Pay · Product Manager" },
  },
  {
    id: "s-2", title: "Northwind Logistics · Product Owner", subtitle: "20 Oct 2026", mode: "interview", archived: false, started_at: "2026-10-20T10:00:00+01:00",
    match: { field: "answer", q: 2, snippet: "…noticed merchants dropped out at the payment step, so I interviewed several of them and changed the checkout label with the designer…" },
  },
  {
    id: "s-3", title: "General questions", subtitle: "13 Oct 2026", mode: "interview", archived: true, started_at: "2026-10-13T10:00:00+01:00",
    match: { field: "question", q: 4, snippet: "Tell me about a time you changed the checkout flow without a designer. What did you decide yourself?" },
  },
  {
    id: "s-4", title: "English practice", subtitle: "6 Oct 2026", mode: "english", archived: false, started_at: "2026-10-06T10:00:00+01:00",
    match: { field: "answer", snippet: "I went to the checkout and the cashier asked me for a card I did not have with me." },
  },
];

function View(props: Partial<SearchDialogViewProps>) {
  const [query, setQuery] = useState(props.query ?? "");
  const [active, setActive] = useState(props.active ?? -1);
  return (
    <SearchDialogView
      inline open status="idle" results={[]} searched="" onClose={() => {}} onOpenResult={() => {}}
      {...props} query={query} onQueryChange={setQuery} active={active} onActiveChange={setActive}
    />
  );
}

/** Before typing: a quiet hint of what is searched. The cursor is in the input. */
export const Empty: StoryObj = { render: () => <View /> };

/** Typing "checkout": the title row has no second line (the title shows the match); a hit in an answer or a question says whose line it is and which question; an English practice has no question number; the archived one carries a badge. ↑ / ↓ move the highlight. */
export const Results: StoryObj = { render: () => <View query="checkout" status="ready" results={HITS} searched="checkout" active={0} /> };

/** Nothing matches: the words typed are named, and a way out. */
export const NoResults: StoryObj = { render: () => <View query="blockchain" status="ready" results={[]} searched="blockchain" /> };

/** The server did not answer. */
export const ServerError: StoryObj = { render: () => <View query="checkout" status="error" /> };

/** On a phone (375): the dialog is the full width minus the gutters, like every dialog. */
export const Mobile: StoryObj = {
  render: () => (
    <div style={{ width: 375, maxWidth: "100%" }}>
      <View query="checkout designer" status="ready" results={HITS} searched="checkout designer" active={1} />
    </div>
  ),
};
