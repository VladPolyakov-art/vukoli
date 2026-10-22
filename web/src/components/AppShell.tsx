/* AppShell (pattern, components.md §5; ds/screens/_index.md §2; D57: the sidebar works like claude.ai's).
 * Container `shell` on the root: ≥ 1024 the rail (expanded 240px, or collapsed to a narrow icon rail, remembered in
 * localStorage `ic.railCollapsed`) · 640–1023 / < 640 top bar (menu button, app name, a warning badge only while the AI
 * engine is not ready) with the same sidebar, always expanded, in a left Drawer (G5).
 * Rail, top to bottom: app mark + name with the sidebar toggle · New practice (a round filled plus) · Archive (D80: replaced
 * History) · "Recents" = every chat not archived, newest first (one line each, no dates, a quiet EN marker for English; the
 * middle part scrolls; a "…" menu on hover or focus: Rename, Download as Markdown, Archive, Delete — Delete asks first,
 * then goes to Trash with Undo) · an "AI engine · Not ready" row (only when it is not ready: P6) · the account row (avatar
 * with the initial, the user's name or "You", the engine in use) which opens a menu (Settings, Privacy and data, Help &
 * what's free; the theme lives in Settings → General since D80). Collapsed: toggle, round plus, archive, a warning icon
 * (only when not ready) and the avatar, each with a Tooltip. The rail is set off from the content by its fill, no line.
 * <main> is the scroll container and the `page` container for screens.
 * `AppShellView` is pure (every state by props: review frames, stories); `AppShell` is the live container. */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode, type Ref } from "react";
import { Link, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { Badge, Button, Dialog, Drawer, Icon, IconButton, InlineRename, Menu, NavRow, Skeleton, Tooltip, ToastProvider, useToast } from "../ds";
import type { LinkComponent, MenuEntry, ToastOptions } from "../ds";
import { t } from "../i18n";
import { api } from "../lib/api";
import { pendingSave } from "../lib/pendingSave";
import { prefs } from "../lib/prefs";
import { errorMessage, useApp } from "../lib/store";
import { railSessions, type RailSession } from "./railItems";
import { SESSIONS_CHANGED, TITLE_MAX } from "../screens/debrief/rename";
import { LogoMark, Wordmark } from "./Wordmark";
import { engineShort } from "./engine/meta";
import s from "./AppShell.module.css";

/** react-router adapter for DS rows (NavRow, ListRow): `href` → `to`. */
export const RouterLink: LinkComponent = ({ href, children, ...rest }) => <Link to={href} {...rest}>{children}</Link>;

export type NavKey = "practice" | "archive" | "settings";
/** One chat row: title and track (no date or time: D57). */
export type RecentSession = RailSession;
export type RecentState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: RecentSession[] };
export type EngineStatus = "checking" | "ready" | "notReady";
export interface ShellEngine { name?: string; status: EngineStatus }
/** D80: what a chat's "…" menu can do. Rename resolves false when it failed (the old name comes back). */
/** Stories and review frames: a menu with every action that does nothing. */
export const NOOP_ACTIONS: SessionActions = { rename: async () => true, download: () => {}, archive: () => {}, remove: () => {} };
export interface SessionActions {
  rename: (id: string, title: string) => Promise<boolean>;
  download: (id: string) => void;
  archive: (id: string) => void;
  remove: (id: string) => void;
}

/** Shell width from which the full rail shows (a container width, docs/frontend.md): the drawer closes above it. */
const SHELL_FULL_MIN = 1024;


/** Engine status badge (Badge success / warning / neutral + icon). Pure. */
export function EngineBadge({ status }: { status: EngineStatus }) {
  if (status === "checking") return <Badge>{t("rail.checking")}</Badge>;
  return status === "ready"
    ? <Badge tone="success" icon="check">{t("rail.ready")}</Badge>
    : <Badge tone="warning" icon="alert">{t("rail.notReady")}</Badge>;
}

function useEngine(): ShellEngine {
  const { selectedEngine, enginesLoading, engines } = useApp();
  if (!engines && enginesLoading) return { name: selectedEngine ? engineShort(selectedEngine) : undefined, status: "checking" };
  if (!selectedEngine) return { status: "notReady" };
  return { name: engineShort(selectedEngine), status: selectedEngine.status.ready ? "ready" : "notReady" };
}

/** Live badge for screens that show the engine state outside the shell (kept for existing imports). */
export function EngineStatusBadge() {
  return <EngineBadge status={useEngine().status} />;
}

export type InitialMenu = "account" | "row";

export interface AppShellViewProps {
  /** The nav row of the page being shown (null: none, e.g. a debrief listed in Recents). */
  current: NavKey | null;
  /** The session being shown, highlighted in Recents. */
  currentSessionId?: string;
  recent: RecentState;
  engine: ShellEngine;
  /** Rail drawer below 1024 (controlled; uncontrolled when omitted). */
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  /** Rail collapsed to the icon rail (≥ 1024). Controlled when `onCollapsedChange` is given, else it is the initial value. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Open one of the sidebar menus at first render (stories, review): the account menu or the first chat's "…" menu. */
  initialMenu?: InitialMenu;
  /** A chat's "…" menu: Rename, Download as Markdown, Archive, Delete (D80); without it the menu only has Open. */
  actions?: SessionActions;
  /** D80: the name from Settings → General; "You" when there is none. */
  userName?: string;
  mainRef?: Ref<HTMLElement>;
  rootRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function AppShellView({
  current, currentSessionId, recent, engine, drawerOpen, onDrawerOpenChange, collapsed, onCollapsedChange, initialMenu,
  actions, userName, mainRef, rootRef, children,
}: AppShellViewProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = drawerOpen ?? ownOpen;
  const setOpen = useCallback((next: boolean) => {
    if (drawerOpen === undefined) setOwnOpen(next);
    onDrawerOpenChange?.(next);
  }, [drawerOpen, onDrawerOpenChange]);
  const [ownCollapsed, setOwnCollapsed] = useState(collapsed ?? false);
  const isCollapsed = onCollapsedChange ? (collapsed ?? false) : ownCollapsed;
  const setCollapsed = (next: boolean) => {
    setOwnCollapsed(next);
    onCollapsedChange?.(next);
  };
  const drawerId = useId();
  // Any link chosen in the drawer closes it (the route changes under it).
  const closeOnLink = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("a")) setOpen(false);
  };
  // The menus are portalled out of the drawer, so they close it themselves (see `onNavigate`).
  const common = { current, currentSessionId, recent, engine, actions, userName };

  return (
    <div ref={rootRef} className={s.shell} data-review-id="AppShell">
      <a href="#main" className={s.skip} data-track="skip-to-content">{t("app.skipToContent")}</a>
      <div className={s.frame} data-collapsed={isCollapsed || undefined}>
        <aside className={s.rail} data-review-id="AppShell/rail" aria-label={t("rail.menu")}>
          <Rail
            {...common}
            collapsed={isCollapsed}
            onToggle={() => setCollapsed(!isCollapsed)}
            initialMenu={initialMenu}
          />
        </aside>

        <header className={s.topbar} data-review-id="AppShell/topbar">
          <IconButton
            icon="menu"
            label={t("rail.openMenu")}
            data-track="topbar-menu"
            aria-expanded={open}
            aria-controls={open ? drawerId : undefined}
            onClick={() => setOpen(true)}
          />
          <Link to="/" className={s.topbarName} data-track="topbar-brand"><Wordmark /></Link>
          {engine.status === "notReady" ? (
            <Link to="/settings/engine" className={s.topbarEngine} data-track="rail-engine-warning" aria-label={`${t("rail.engineWarning")}: ${t("rail.notReady")}`}>
              <EngineBadge status="notReady" />
            </Link>
          ) : null}
        </header>

        <main id="main" ref={mainRef} className={s.main} tabIndex={-1}>
          <div className={s.page}>{children}</div>
        </main>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} side="left" label={t("rail.menu")}>
        <div id={drawerId} className={s.drawerRail} onClick={closeOnLink}>
          <Rail {...common} collapsed={false} drawer onToggle={() => setOpen(false)} onNavigate={() => setOpen(false)} />
        </div>
      </Drawer>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className={s.brand} data-track="rail-brand" data-review-id="AppShell/brand">
      <Wordmark />
    </Link>
  );
}

interface RailProps {
  current: NavKey | null;
  currentSessionId?: string;
  recent: RecentState;
  engine: ShellEngine;
  collapsed: boolean;
  /** In the drawer: the toggle closes it, and a menu choice closes it too. */
  drawer?: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  initialMenu?: InitialMenu;
  actions?: SessionActions;
  userName?: string;
}

/** The sidebar, expanded or collapsed. The body keeps a fixed width per state, so the rail's width animation only reveals it. */
function Rail({ current, currentSessionId, recent, engine, collapsed, drawer, onToggle, onNavigate, initialMenu, actions, userName }: RailProps) {
  const toggleLabel = drawer || !collapsed ? t("rail.toggleClose") : t("rail.toggleOpen");
  // D78: collapsed, the toggle is the app mark; pointing at it (or focusing it) turns it into the "open sidebar" icon.
  const toggle = collapsed && !drawer ? (
    <button type="button" className={s.markToggle} aria-label={toggleLabel} onClick={onToggle} data-track="rail-toggle" data-review-id="AppShell/toggle">
      <LogoMark className={s.markGlyph} />
      <span className={s.markOpen} aria-hidden="true"><Icon name="sidebar" /></span>
    </button>
  ) : <IconButton icon="sidebar" size="sm" label={toggleLabel} onClick={onToggle} title={undefined} data-track="rail-toggle" data-review-id="AppShell/toggle" />;
  return (
    <div className={s.railBody} data-collapsed={collapsed || undefined}>
      <div className={s.top}>
        {collapsed ? null : <Brand />}
        {drawer ? toggle : <Tooltip content={toggleLabel} placement={collapsed ? "bottom-start" : "bottom-end"}>{toggle}</Tooltip>}
      </div>

      <nav aria-label={t("nav.main")} className={s.nav} data-review-id="AppShell/nav">
        <NewPractice current={current === "practice"} collapsed={collapsed} />
        <ArchiveLink current={current === "archive"} collapsed={collapsed} />
      </nav>

      {collapsed ? <div className={s.recentSpacer} aria-hidden="true" /> : (
        <Recents
          recent={recent}
          currentSessionId={currentSessionId}
          openRowMenu={initialMenu === "row"}
          actions={actions}
          onNavigate={onNavigate}
        />
      )}

      <div className={s.foot} data-review-id="AppShell/account">
        {engine.status === "notReady" ? (collapsed ? (
          <Tooltip content={`${t("rail.engineWarning")}: ${t("rail.notReady")}`} placement="top-start">
            <Link to="/settings/engine" className={s.engineIcon} data-track="rail-engine-warning" aria-label={`${t("rail.engineWarning")}: ${t("rail.notReady")}`} data-review-id="AppShell/engine">
              <Icon name="alert" />
            </Link>
          </Tooltip>
        ) : (
          <NavRow
            href="/settings/engine"
            icon="cpu"
            label={t("rail.engineWarning")}
            end={<EngineBadge status="notReady" />}
            current={false}
            linkAs={RouterLink}
            track="rail-engine-warning"
            className={s.engineWarn}
          />
        )) : null}
        <Account collapsed={collapsed} defaultOpen={initialMenu === "account"} onNavigate={onNavigate} name={userName} engine={engine} />
      </div>
    </div>
  );
}

/** "New practice": a grey circle with the plus, then the label, like Claude's "New chat" (D59: no white fill). Collapsed: the circle alone. */
function NewPractice({ current, collapsed }: { current: boolean; collapsed: boolean }) {
  const link = (
    <Link to="/" className={s.newRow} aria-current={current ? "page" : undefined} data-track="nav-new" data-review-id="AppShell/new">
      <span className={s.plus}><Icon name="plus" size="sm" /></span>
      <span className={collapsed ? "visually-hidden" : s.newLabel}>{t("nav.newPractice")}</span>
    </Link>
  );
  return collapsed ? <Tooltip content={t("nav.newPractice")} placement="bottom-start">{link}</Tooltip> : link;
}

/** D80: the Archive (chats moved out of Recents), under New practice. Collapsed: the icon alone, with a Tooltip. */
function ArchiveLink({ current, collapsed }: { current: boolean; collapsed: boolean }) {
  const link = (
    <Link to="/archive" className={s.newRow} aria-current={current ? "page" : undefined} data-track="nav-archive" data-review-id="AppShell/archive">
      <span className={s.navIcon}><Icon name="archive" size="sm" /></span>
      <span className={collapsed ? "visually-hidden" : s.newLabel}>{t("rail.archive")}</span>
    </Link>
  );
  return collapsed ? <Tooltip content={t("rail.archive")} placement="bottom-start">{link}</Tooltip> : link;
}

function Recents({ recent, currentSessionId, openRowMenu, actions, onNavigate }: {
  recent: RecentState; currentSessionId?: string; openRowMenu: boolean;
  actions?: SessionActions; onNavigate?: () => void;
}) {
  const recentId = useId();
  if (recent.status === "error") return <div className={s.recent} />;
  return (
    <section className={s.recent} aria-labelledby={recentId} data-review-id="AppShell/recent">
      <h2 id={recentId} className={s.recentLabel}>{t("rail.recents")}</h2>
      {recent.status === "loading" ? (
        <Skeleton variant="lines" lines={3} className={s.recentSkeleton} />
      ) : recent.items.length === 0 ? (
        <p className={s.recentEmpty}>{t("rail.noSessions")}</p>
      ) : (
        <ul className={s.chats}>
          {recent.items.map((item, i) => (
            <ChatRow
              key={item.id}
              item={item}
              current={item.id === currentSessionId}
              menuOpen={openRowMenu && i === 0}
              actions={actions}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One chat: a link row (title, quiet EN) and, on hover or focus, a "…" menu (D80): Rename (in place, in the row),
 * Download as Markdown, Archive, Delete — Delete asks first. */
function ChatRow({ item, current, menuOpen, actions, onNavigate }: {
  item: RecentSession; current: boolean; menuOpen: boolean;
  actions?: SessionActions; onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const items: MenuEntry[] = actions ? [
    { id: "rename", track: "rail-row-rename", label: t("rail.rowRename"), icon: "edit", onSelect: () => setRenaming(true) },
    { id: "download", track: "rail-row-download", label: t("rail.rowDownload"), icon: "download", onSelect: () => actions.download(item.id) },
    { id: "archive", track: "rail-row-archive", label: t("rail.rowArchive"), icon: "archive", onSelect: () => actions.archive(item.id) },
    { id: "sep", separator: true },
    { id: "delete", track: "rail-row-delete", label: t("rail.rowDelete"), icon: "trash", onSelect: () => setConfirm(true) },
  ] : [
    { id: "open", track: "rail-row-open", label: t("rail.rowOpen"), icon: "chat", onSelect: () => { navigate(`/sessions/${encodeURIComponent(item.id)}`); onNavigate?.(); } },
  ];
  const label = t("rail.rowActions", { title: item.title });
  if (renaming && actions) {
    return (
      <li className={s.chatItem}>
        <InlineRename value={item.title} label={t("rail.renameLabel")} max={TITLE_MAX} autoFocus className={s.chatRename}
          onCancel={() => setRenaming(false)}
          onSave={(next) => { setRenaming(false); if (next !== item.title) void actions.rename(item.id, next); }} />
      </li>
    );
  }
  return (
    <li className={s.chatItem}>
      <NavRow
        href={`/sessions/${encodeURIComponent(item.id)}`}
        label={item.title}
        end={item.track === "english" ? <span className={s.track} title={t("rail.english")}>EN</span> : undefined}
        current={current}
        linkAs={RouterLink}
        track="rail-session"
        className={s.chat}
      />
      <Menu
        label={label}
        placement="bottom-end"
        defaultOpen={menuOpen}
        className={s.chatActions}
        items={items}
        trigger={(p) => <IconButton {...p} icon="more" size="sm" label={label} title={undefined} data-track="rail-row-more" data-review-id="AppShell/rowMenu" />}
      />
      {actions ? (
        <Dialog
          open={confirm}
          title={t("rail.deleteTitle")}
          onClose={() => setConfirm(false)}
          actions={(
            <>
              <Button data-track="rail-delete-cancel" onClick={() => setConfirm(false)}>{t("common.cancel")}</Button>
              <Button variant="danger" data-track="rail-delete-confirm" onClick={() => { setConfirm(false); actions.remove(item.id); }}>{t("rail.deleteConfirm")}</Button>
            </>
          )}
        >
          <p>{t("rail.deleteBody", { title: item.title })}</p>
        </Dialog>
      ) : null}
    </li>
  );
}

/** The account row (avatar, the name over the AI engine in use, a chevron; D59, D80): one pill button (D78) that opens a
 * menu to its right, into the work area (D79). The menu: a header (name, "Saved on this computer"), Settings, Privacy,
 * Help. D80: no theme switch here, it lives in Settings → General. Collapsed: the avatar alone. */
function Account({ collapsed, defaultOpen, onNavigate, name, engine }: {
  collapsed: boolean; defaultOpen: boolean; onNavigate?: () => void; name?: string; engine: ShellEngine;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);
  const go = (to: string) => () => { navigate(to); onNavigate?.(); };
  const who = name?.trim() || t("rail.you");
  const sub = engine.name || t("rail.local");
  const items: MenuEntry[] = [
    { id: "settings", track: "nav-settings", label: t("settings.title"), icon: "settings", onSelect: go("/settings") },
    { id: "sep", separator: true },
    { id: "privacy", track: "nav-privacy", label: t("settings.section.privacy"), icon: "lock", onSelect: go("/settings/privacy") },
    { id: "help", track: "nav-help", label: t("rail.help"), icon: "info", onSelect: go("/settings/about#free") },
  ];
  return (
    <Menu
      label={t("rail.accountMenu")}
      placement="right-end"
      open={open}
      onOpenChange={setOpen}
      className={s.accountWrap}
      items={items}
      header={<><span className={s.menuName}>{who}</span><span className={s.menuSub}>{t("rail.storage")}</span></>}
      trigger={(p) => {
        const button = (
          <button {...p} type="button" className={s.account} data-track="account-menu" aria-label={collapsed ? `${who}. ${t("rail.accountMenu")}` : undefined} data-review-id="AppShell/accountButton">
            <span className={s.avatar}>{name?.trim() ? <span className={s.initial} aria-hidden="true">{initial(who)}</span> : <Icon name="user" size="sm" />}</span>
            {collapsed ? null : (
              <>
                <span className={s.accountText}>
                  <span className={s.accountName}>{who}</span>
                  <span className={s.accountSub}>{sub}</span>
                </span>
                {/* D59: the chevron says the row opens a menu; D79: it points right, where the menu opens. */}
                <span className={s.accountChevron} aria-hidden="true"><Icon name="chevronRight" size="sm" /></span>
              </>
            )}
          </button>
        );
        return collapsed ? <Tooltip content={`${who} · ${sub}`} placement="top-start" disabled={open}>{button}</Tooltip> : button;
      }}
    />
  );
}

/** The first letter of the name for the avatar (D80). */
function initial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
}

/* ---------- live container ---------- */

function navFor(pathname: string): NavKey | null {
  if (pathname === "/") return "practice";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/archive")) return "archive";
  return null;
}


/** The collapsed state of the rail, remembered per browser (`ic.railCollapsed`, D57). */
function useRailCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => prefs.railCollapsed());
  const set = useCallback((next: boolean) => {
    setCollapsed(next);
    prefs.setRailCollapsed(next);
  }, []);
  return [collapsed, set];
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <LiveShell>{children}</LiveShell>
    </ToastProvider>
  );
}

/** D73: how often the shell asks whether a session saved after End is ready, and how long it waits. Past the wait the
 * session is offered anyway (its page says "Writing your debrief…" until the debrief lands) or, if nothing was saved,
 * an error says so. Behaviour timers, not motion tokens. */
const SAVE_POLL_MS = 2000;
const SAVE_WAIT_MS = 3 * 60_000;

/** D73 toasts, shared with the review frames: "Saving…" stays (shimmer: real work is going on), "saved" offers the debrief. */
export const savingToast = (): ToastOptions => ({ message: <span className="shimmer-text">{t("session.afterEnd.saving")}</span>, duration: null });
export const savedToast = (onOpen: () => void): ToastOptions => ({
  message: t("session.afterEnd.ready"), action: { label: t("session.afterEnd.open"), onClick: onOpen },
});

/** The page of a saved session (its debrief). UT-4: the "saved" toast is not shown there and leaves when the user gets there. */
export const sessionPath = (id: string) => `/sessions/${encodeURIComponent(id)}`;
export const onSessionPage = (pathname: string, id: string) => pathname === sessionPath(id);

/** D73: the toast for a session being saved after End (lib/pendingSave). It stays while the server saves the session
 * and writes the debrief, then says it is ready, with the way in. Polled: the session's socket is gone by then. */
function useSaveWatch(toast: ReturnType<typeof useToast>, loadRecent: () => Promise<void>, navigate: NavigateFunction, pathname: string) {
  const pending = useSyncExternalStore(pendingSave.subscribe, pendingSave.get);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const saved = useRef<{ id: string; toast: number } | null>(null);
  // UT-4: reaching the debrief (from Recents or the toast) closes the "saved" toast.
  useEffect(() => {
    if (saved.current && onSessionPage(pathname, saved.current.id)) {
      toast.dismiss(saved.current.toast);
      saved.current = null;
    }
  }, [pathname, toast]);
  useEffect(() => {
    if (!pending) return;
    const { id, at } = pending;
    let stopped = false;
    let listed = false;
    let timer = 0;
    const saving = toast.show(savingToast());
    const finish = (ok: boolean) => {
      stopped = true;
      toast.dismiss(saving);
      pendingSave.clear(id);
      void loadRecent();
      if (!ok) toast.show({ message: t("session.afterEnd.failed"), tone: "error" });
      else if (!onSessionPage(pathRef.current, id)) saved.current = { id, toast: toast.show(savedToast(() => navigate(sessionPath(id)))) };
    };
    const poll = async () => {
      const late = Date.now() - at > SAVE_WAIT_MS;
      try {
        const record = await api.session(id);
        if (stopped) return;
        // Saved: it shows in Recents now; the toast waits for the debrief.
        if (!listed) { listed = true; void loadRecent(); }
        if (record.debrief || late) { finish(true); return; }
      } catch {
        if (stopped) return;
        if (late) { finish(false); return; }
      }
      timer = window.setTimeout(() => { void poll(); }, SAVE_POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      toast.dismiss(saving);
    };
  }, [pending, toast, loadRecent, navigate]);
}

function LiveShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const engine = useEngine();
  const { settings } = useApp();
  const [recent, setRecent] = useState<RecentState>({ status: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useRailCollapsed();
  const mainRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const loadRecent = useCallback(() => api.sessions().then(
    ({ sessions }) => {
      if (aliveRef.current) setRecent({ status: "ready", items: railSessions(sessions, t("rail.untitled")) });
    },
    () => { if (aliveRef.current) setRecent((prev) => (prev.status === "ready" ? prev : { status: "error" })); },
  ), []);

  useSaveWatch(toast, loadRecent, navigate, location.pathname);

  // Recents: refetched on every navigation (a session may have been added, renamed or trashed), and when a screen
  // changed a chat in place (rename in the debrief, Undo from a toast).
  useEffect(() => {
    void loadRecent();
  }, [location.pathname, loadRecent]);
  useEffect(() => {
    const reload = () => void loadRecent();
    window.addEventListener(SESSIONS_CHANGED, reload);
    return () => window.removeEventListener(SESSIONS_CHANGED, reload);
  }, [loadRecent]);


  // A new page starts at the top (<main> is the scroll container). Settings is a popup over the page (D76): opening and
  // closing it keeps the page where it was.
  const [page, setPage] = useState(location.pathname);
  if (!location.pathname.startsWith("/settings") && page !== location.pathname) setPage(location.pathname);
  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
  }, [page]);

  // The drawer belongs to the narrow shell: close it once the full rail is back.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !drawerOpen) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width >= SHELL_FULL_MIN) setDrawerOpen(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawerOpen]);

  const sessionId = location.pathname.startsWith("/sessions/") ? decodeURIComponent(location.pathname.slice("/sessions/".length)) : undefined;

  // D80: a chat's "…" menu. Archive and Delete take the row out at once and offer Undo; Delete is a soft delete (Trash).
  const drop = useCallback((id: string) => {
    setRecent((prev) => (prev.status === "ready" ? { ...prev, items: prev.items.filter((x) => x.id !== id) } : prev));
    if (sessionId === id) navigate("/");
  }, [navigate, sessionId]);
  const fail = useCallback((e: unknown) => toast.show({ message: errorMessage(e), tone: "error" }), [toast]);
  const actions = useMemo<SessionActions>(() => ({
    rename: async (id, title) => {
      setRecent((prev) => (prev.status === "ready" ? { ...prev, items: prev.items.map((x) => (x.id === id ? { ...x, title } : x)) } : prev));
      try {
        await api.patchSession(id, { title });
        return true;
      } catch {
        void loadRecent();
        toast.show({ message: t("rail.renameFailed"), tone: "error" });
        return false;
      }
    },
    download: (id) => {
      const a = document.createElement("a");
      a.href = api.sessionMarkdownUrl(id);
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    archive: (id) => {
      api.patchSession(id, { archived: true }).then(() => {
        drop(id);
        toast.show({ message: t("rail.archived"), action: { label: t("common.undo"), onClick: () => { void api.patchSession(id, { archived: false }).then(loadRecent, fail); } } });
      }, fail);
    },
    remove: (id) => {
      api.deleteSession(id).then(({ trash_id }) => {
        drop(id);
        toast.show({
          message: t("rail.deleted"),
          action: trash_id ? { label: t("common.undo"), onClick: () => { void api.restoreSession(trash_id).then(loadRecent, fail); } } : undefined,
        });
      }, fail);
    },
  }), [drop, fail, loadRecent, toast]);

  return (
    <AppShellView
      current={navFor(location.pathname)}
      currentSessionId={sessionId}
      recent={recent}
      engine={engine}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      actions={actions}
      userName={settings?.name}
      mainRef={mainRef}
      rootRef={rootRef}
    >
      {children}
    </AppShellView>
  );
}
