/* Search dialog (D105, docs/ui-spec.md "Search"): the sidebar's "Search" row and ⌘K / Ctrl+K open it. An input (focused)
 * over the hits of every saved practice, the archived ones too: the title, then the line that matched with the words
 * marked. ↑ / ↓ move, Enter opens, Esc closes (the Dialog does). It is a combobox: focus stays in the input, the hit
 * being pointed at is `aria-activedescendant`. A hit opens its Debrief, on the question it was said in (`?q=n`).
 * `SearchDialogView` is pure (stories, review); `SearchDialog` is the live container (network, router). */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Dialog, Icon, Input } from "../../ds";
import { t, tp } from "../../i18n";
import type { SearchResult } from "../../lib/types";
import { activeAfter, highlightParts, moveActive, resultPath, searchKey } from "./searchModel";
import { useSearch, type SearchStatus } from "./useSearch";
import s from "./SearchDialog.module.css";

/** The text with the words of the query in <mark>. */
export function Marked({ text, query }: { text: string; query: string }) {
  return <>{highlightParts(text, query).map((p, i) => (p.hit ? <mark key={i} className={s.mark}>{p.text}</mark> : p.text))}</>;
}

/** "Mike · question 3", "Your answer · question 3", "Job": where the line came from. */
function source(r: SearchResult): string {
  const { field, q } = r.match;
  if (field === "job") return t("search.job");
  if (field === "question") return q ? t("search.mikeQ", { n: q }) : t("search.mike");
  return q ? t("search.youQ", { n: q }) : t("search.you");
}

export interface SearchDialogViewProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  status: SearchStatus;
  results: SearchResult[];
  /** The query `results` are for (marked in them, named in the empty state). */
  searched: string;
  /** The highlighted hit (-1: none). */
  active: number;
  onActiveChange: (index: number) => void;
  onOpenResult: (result: SearchResult) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Render in the flow (stories, review frames). */
  inline?: boolean;
}

export function SearchDialogView({ open, onClose, query, onQueryChange, status, results, searched, active, onActiveChange, onOpenResult, inputRef, inline }: SearchDialogViewProps) {
  const id = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const empty = status === "ready" && results.length === 0;
  const optionId = (i: number) => `${id}-o${i}`;
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const k = searchKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, isComposing: e.nativeEvent.isComposing }, results.length);
    if (!k) return;
    e.preventDefault();
    if (k.do === "move") {
      const next = moveActive(active, k.key, results.length);
      onActiveChange(next);
      document.getElementById(optionId(next))?.scrollIntoView?.({ block: "nearest" });
    } else {
      const hit = results[active] ?? results[0];
      if (hit) onOpenResult(hit);
    }
  };

  let body: ReactNode;
  if (results.length) {
    body = (
      <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={t("search.results")} className={s.list}>
        {results.map((r, i) => (
          <li
            key={r.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className={s.row}
            data-track="search-result"
            onMouseMove={() => { if (i !== active) onActiveChange(i); }}
            onClick={() => onOpenResult(r)}
          >
            <span className={s.titleLine}>
              <span className={s.title}><Marked text={r.title} query={searched} /></span>
              {r.archived ? <Badge>{t("search.archived")}</Badge> : null}
            </span>
            {r.subtitle ? <span className={s.sub}>{r.subtitle}</span> : null}
            {r.match.field === "title" || !r.match.snippet ? null : (
              <span className={s.said}><span className={s.who}>{source(r)}: </span><Marked text={r.match.snippet} query={searched} /></span>
            )}
          </li>
        ))}
      </ul>
    );
  } else if (empty) {
    body = (
      <div className={s.note} data-track="search-empty">
        <span className={s.noteTitle}>{t("search.empty", { query: searched })}</span>
        <span>{t("search.emptyBody")}</span>
      </div>
    );
  } else if (status === "error") {
    body = <div className={s.note} role="alert">{t("search.error")}</div>;
  } else {
    body = <div className={s.note}>{t("search.hint")}</div>;
  }

  return (
    <Dialog open={open} title={t("search.title")} onClose={onClose} closeLabel={t("common.close")} inline={inline}>
      <div className={s.panel} data-review-id="SearchDialog">
        <div className={s.inputLine}>
          <span className={s.inputIcon}><Icon name="search" size="md" /></span>
          <Input
            ref={inputRef}
            bare
            label={t("search.label")}
            hideLabel
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={results.length ? `${id}-list` : undefined}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && results[active] ? optionId(active) : undefined}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            data-track="search-input"
          />
        </div>
        <div className={s.results}>{body}</div>
        <p className="visually-hidden" role="status" aria-live="polite">
          {status === "ready" ? (results.length ? tp("search.count", results.length) : t("search.empty", { query: searched })) : ""}
        </p>
      </div>
    </Dialog>
  );
}

/** The live dialog: its own query, the debounced search and the way into a hit. Closing forgets the query. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, results, searched } = useSearch(query, open);
  const shown = useRef<SearchResult[]>([]);

  // New hits: keep the pointer on the same practice if it is still listed, else on the first.
  useEffect(() => {
    setActive((a) => activeAfter(shown.current, a, results));
    shown.current = results;
  }, [results]);

  // Opening puts the cursor in the input (after the Dialog has shown itself); closing forgets the query.
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    setQuery("");
    setActive(-1);
    shown.current = [];
    return undefined;
  }, [open]);

  return (
    <SearchDialogView
      open={open}
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      status={status}
      results={results}
      searched={searched}
      active={active}
      onActiveChange={setActive}
      onOpenResult={(r) => { onClose(); navigate(resultPath(r)); }}
      inputRef={inputRef}
    />
  );
}
