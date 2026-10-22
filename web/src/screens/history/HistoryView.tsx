/* Archive list (D80; was History, ds/screens/debrief.md §4; US-21, US-23). Pure: every state comes from props. The live
 * container is `screens/History.tsx`. Filter chips (All / Interview / English), week groups, G16 list rows with rename,
 * "Move back to Recents" and Delete (asks first, then to Trash). A removed row slides out, focus has already moved on; the toast with Undo belongs to the caller. */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge, Button, Callout, Chip, ChipGroup, Dialog, durationMs, EmptyState, Icon, IconButton, ListRow, ListRows, Menu, Skeleton, Swap, Toast,
  type MenuEntry,
} from "../../ds";
import { RouterLink } from "../../components/AppShell";
import { Page } from "../../components/Page";
import { t, tp } from "../../i18n";
import { formatDateTime, formatDuration } from "../../lib/format";
import { groupByWeek } from "./groupByWeek";
import type { HistoryRowModel, HistoryViewProps, Track, TrackFilter } from "./types";
import s from "./HistoryView.module.css";

const STAGGER_CAP = 8;

/** Before a row leaves, focus moves to the next row's link, else the previous one, else the page title (motion rule 5). */
function focusAfter(li: HTMLElement | null) {
  const live = (el: Element | null | undefined, dir: "next" | "prev") => {
    let n = el as HTMLElement | null;
    while (n?.dataset.leaving) n = (dir === "next" ? n.nextElementSibling : n.previousElementSibling) as HTMLElement | null;
    return n;
  };
  const sibling = live(li?.nextElementSibling, "next") ?? live(li?.previousElementSibling, "prev");
  const target = sibling?.querySelector<HTMLElement>("a, button") ?? li?.closest("main")?.querySelector<HTMLElement>("h1") ?? null;
  if (!target) return;
  if (target.tagName === "H1") target.tabIndex = -1;
  target.focus();
}

const icon = (track: Track) => (track === "english" ? "chat" : "briefcase");

function Meta({ row }: { row: HistoryRowModel }) {
  const length = formatDuration(row.durationS);
  return (
    <>
      <Badge tone="outline">{t(`history.mode.${row.track}`)}</Badge>
      {row.round ? <span>{row.round}</span> : null}
      <span className={s.metaItem}>
        <Icon name="clock" size="sm" />
        {formatDateTime(row.startedAt)}{length ? ` · ${length}` : ""}
      </span>
    </>
  );
}

export function HistoryView(props: HistoryViewProps) {
  const { state, rows, now, trashCount, ui, enterStagger, toast, notice, className } = props;
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const headId = useId();

  const [ownTrack, setOwnTrack] = useState<TrackFilter>(props.track ?? "all");
  const track = props.onTrackChange ? props.track ?? "all" : ownTrack;
  const setTrack = (next: TrackFilter) => { setOwnTrack(next); props.onTrackChange?.(next); };

  const [renaming, setRenaming] = useState<string | null>(ui?.renaming ?? null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(ui?.menuOpen ?? null);
  const [shortOpen, setShortOpen] = useState<ReadonlySet<string>>(() => new Set(ui?.shortOpen ?? []));
  const toggleShort = (key: string) => setShortOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const [titles, setTitles] = useState<Readonly<Record<string, string>>>({});
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  // A row that is gone from the data (trashed) no longer needs the local "hidden" mark: if it comes back (Undo), it shows.
  useEffect(() => {
    setHidden((prev) => {
      const next = new Set([...prev].filter((id) => rows.some((r) => r.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const counts = useMemo(() => ({
    all: rows.length,
    interview: rows.filter((r) => r.track === "interview").length,
    english: rows.filter((r) => r.track === "english").length,
  }), [rows]);

  const visible = useMemo(
    () => rows.filter((r) => !hidden.has(r.id) && (track === "all" || r.track === track)).map((r) => ({ ...r, title: titles[r.id] ?? r.title })),
    [rows, hidden, track, titles],
  );
  const groups = useMemo(() => groupByWeek(visible, now), [visible, now]);

  const rowEl = (id: string) => root.current?.querySelector<HTMLElement>(`a[href="/sessions/${id}"]`)?.closest("li") ?? null;

  const trash = (id: string) => leave(id, props.onTrash);
  const unarchive = (id: string) => leave(id, props.onUnarchive);
  const leave = (id: string, action?: (id: string) => void | Promise<boolean | void>) => {
    focusAfter(rowEl(id));
    setLeaving((prev) => new Set(prev).add(id));
    timers.current.push(window.setTimeout(() => {
      setHidden((prev) => new Set(prev).add(id));
      setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, durationMs("--duration-exit")));
    const done = action?.(id);
    if (done instanceof Promise) {
      void done.then((ok) => {
        if (ok !== false) return;
        setHidden((prev) => { const n = new Set(prev); n.delete(id); return n; });
        setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
      });
    }
  };

  const save = (id: string, title: string, before: string) => {
    setTitles((prev) => ({ ...prev, [id]: title }));
    setRenaming(null);
    window.requestAnimationFrame(() => rowEl(id)?.querySelector<HTMLElement>("a")?.focus());
    const done = props.onRename?.(id, title);
    if (done instanceof Promise) {
      void done.then((ok) => { if (ok === false) setTitles((prev) => ({ ...prev, [id]: before })); });
    }
  };

  const trashLink = (
    <Link to="/archive/trash" className={s.trashLink} data-track="archive-trash-link" data-review-id="History/TrashLink">
      <Icon name="trash" size="sm" />
      {trashCount > 0 ? t("history.trashCount", { n: trashCount }) : t("history.trash")}
    </Link>
  );

  const chips = (disabled?: boolean) => (
    <ChipGroup label={t("history.filter.label")} role="radio" className={s.filter}>
      {(["all", "interview", "english"] as const).map((k) => (
        <Chip key={k} role="radio" data-track={`archive-filter-${k}`} selected={track === k} count={state === "ready" ? counts[k] : undefined} disabled={disabled} onClick={() => setTrack(k)}>
          {t(`history.filter.${k}`)}
        </Chip>
      ))}
    </ChipGroup>
  );

  const section = (label: string, id: string) => `${id}-${label}`;

  const renderRow = (row: HistoryRowModel, ri: number, gi: number) => {
    const index = groups.slice(0, gi).reduce((n, x) => n + x.rows.length, 0) + ri;
    const items: MenuEntry[] = [
      { id: "rename", track: "archive-row-rename", label: t("history.row.menuRename"), icon: "edit", onSelect: () => { setRenaming(row.id); } },
      ...(props.onUnarchive ? [{ id: "unarchive", track: "archive-row-unarchive", label: t("history.row.menuUnarchive"), icon: "archive" as const, onSelect: () => unarchive(row.id) }] : []),
      { id: "sep", separator: true },
      { id: "trash", track: "archive-row-trash", label: t("history.row.menuTrash"), icon: "trash", onSelect: () => setConfirming(row.id) },
    ];
    const before = rows.find((r) => r.id === row.id)?.title ?? row.title;
    return (
      <ListRow
        key={row.id}
        title={row.title}
        href={`/sessions/${row.id}`}
        icon={icon(row.track)}
        linkAs={RouterLink}
        track="archive-row"
        sub={row.question}
        meta={<Meta row={row} />}
        result={<span className={s.result}>{row.result}</span>}
        leaving={leaving.has(row.id)}
        enterIndex={enterStagger && !leaving.size ? Math.min(index, STAGGER_CAP) : undefined}
        tooltipOpen={ui?.tooltipOpen === row.id}
        rename={renaming === row.id ? {
          value: row.title,
          onSave: (title) => save(row.id, title, before),
          onCancel: () => setRenaming(null),
          autoFocus: ui?.renaming !== row.id,
        } : undefined}
        actions={(
          <>
            <IconButton icon="edit" size="sm" label={t("history.row.rename", { title: row.title })} data-track="archive-row-rename" onClick={() => setRenaming(row.id)} />
            {props.onUnarchive ? <IconButton icon="archive" size="sm" label={t("history.row.unarchive", { title: row.title })} data-track="archive-row-unarchive" onClick={() => unarchive(row.id)} /> : null}
            <IconButton icon="trash" size="sm" label={t("history.row.trash", { title: row.title })} data-track="archive-row-trash" onClick={() => setConfirming(row.id)} />
          </>
        )}
        compactActions={(
          <Menu
            label={t("history.row.more", { title: row.title })}
            items={items}
            placement="bottom-end"
            open={ui?.menuOpen === row.id ? menuOpen === row.id : undefined}
            onOpenChange={(o) => setMenuOpen(o ? row.id : null)}
            trigger={(p) => <IconButton icon="more" size="sm" label={t("history.row.more", { title: row.title })} data-track="archive-row-more" {...p} />}
          />
        )}
      />
    );
  };

  let body;
  if (state === "loading") {
    body = (
      <div className={s.body} aria-busy="true" data-review-id="History/List" data-review-section="History · List" data-comment-target="">
        {chips(true)}
        <Skeleton variant="row" rows={4} label={t("common.loading")} />
      </div>
    );
  } else if (state === "error") {
    body = (
      <div data-review-id="History/Error" data-review-section="History · Error" data-comment-target="">
        <Callout
          tone="error"
          live="alert"
          title={t("history.error.title")}
          actions={(
            <>
              <Button variant="secondary" size="sm" icon="refresh" data-track="archive-retry" onClick={props.onRetry}>{t("history.error.retry")}</Button>
              <Link to="/settings/storage" className={s.inlineLink} data-track="archive-storage-link">{t("history.error.storage")}</Link>
            </>
          )}
        >
          {t("history.error.body")}
        </Callout>
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div data-review-id="History/Empty" data-review-section="History · Empty" data-comment-target="">
        <EmptyState
          icon="archive"
          title={t("history.emptyState.title")}
          actions={(
            <>
              <Button variant="primary" icon="practice" data-track="archive-empty-start" onClick={() => navigate("/")}>{t("history.emptyState.start")}</Button>
              <Button variant="link" data-track="archive-empty-example" onClick={() => navigate("/sessions/example")}>{t("history.emptyState.example")}</Button>
            </>
          )}
        >
          {t("history.emptyState.body")}
        </EmptyState>
      </div>
    );
  } else {
    body = (
      <div className={s.body} data-review-id="History/List" data-review-section="History · List" data-comment-target="">
        {chips()}
        <Swap swapKey={track}>
          {groups.length ? (
            <div className={s.groups}>
              {groups.map((g, gi) => {
                const gid = section(g.key, headId);
                const full = g.rows.filter((r) => !r.short);
                const short = g.rows.filter((r) => r.short);
                return (
                  <section key={g.key} className={s.group} aria-labelledby={gid} data-review-id={`History/Group/${g.key}`}>
                    <h2 id={gid} className={s.groupLabel}>{g.label}</h2>
                    <ListRows>{full.map((row) => renderRow(row, g.rows.indexOf(row), gi))}</ListRows>
                    {short.length ? (
                      <div className={s.short} data-review-id="History/Short">
                        <button
                          type="button"
                          data-track="archive-short-toggle"
                          className={s.shortToggle}
                          aria-expanded={shortOpen.has(g.key)}
                          aria-controls={`${gid}-short`}
                          onClick={() => toggleShort(g.key)}
                        >
                          <Icon name={shortOpen.has(g.key) ? "chevronDown" : "chevronRight"} size="sm" />
                          {shortOpen.has(g.key) ? t("history.short.hide") : tp("history.short.show", short.length)}
                          <span className={s.shortHint}>{t("history.short.hint")}</span>
                        </button>
                        {shortOpen.has(g.key) ? (
                          <div id={`${gid}-short`}>
                            <ListRows>{short.map((row) => renderRow(row, g.rows.indexOf(row), gi))}</ListRows>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className={s.filteredEmpty} data-review-id="History/FilteredEmpty" data-review-section="History · Filtered empty" data-comment-target="">
              <EmptyState
                compact
                icon={track === "english" ? "chat" : "briefcase"}
                title={t(`history.none.${track === "english" ? "english" : "interview"}.title`)}
                actions={(
                  <Button variant="secondary" data-track="archive-filtered-start" onClick={() => navigate(track === "english" ? "/?track=english" : "/")}>
                    {t(`history.none.${track === "english" ? "english" : "interview"}.start`)}
                  </Button>
                )}
              >
                {t(`history.none.${track === "english" ? "english" : "interview"}.body`)}
              </EmptyState>
            </div>
          )}
        </Swap>
      </div>
    );
  }

  return (
    <div ref={root} className={`${s.page} ${className ?? ""}`} data-review-id="History/Page">
      <Page title={t("history.title")} sub={t("history.sub")} actions={trashLink} className={s.inner}>
        {notice ? <Callout tone="error" live="alert">{notice}</Callout> : null}
        {body}
        <Dialog
          open={confirming !== null}
          title={t("rail.deleteTitle")}
          onClose={() => setConfirming(null)}
          actions={(
            <>
              <Button data-track="archive-trash-cancel" onClick={() => setConfirming(null)}>{t("common.cancel")}</Button>
              <Button variant="danger" data-track="archive-trash-confirm" onClick={() => { const id = confirming; setConfirming(null); if (id) trash(id); }}>{t("rail.deleteConfirm")}</Button>
            </>
          )}
        >
          <p>{t("rail.deleteBody", { title: rows.find((r) => r.id === confirming)?.title ?? "" })}</p>
        </Dialog>
        {toast ? (
          <div className={s.toast}>
            <Toast inline message={toast.message} action={toast.undoLabel ? { label: toast.undoLabel, onClick: toast.onUndo ?? (() => {}) } : undefined} />
          </div>
        ) : null}
      </Page>
    </div>
  );
}

