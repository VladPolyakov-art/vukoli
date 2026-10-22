/* Toast (G3, components.md §4): a short confirmation with an optional action — "Moved to Trash. · Undo".
 * Never a success-green callout (P8: not a system state); `error` tone only for system errors, and those stay until
 * dismissed. Neutral toasts hide after 5 s, paused while hovered or focused. Nothing appears while the user speaks:
 * `ToastProvider paused` queues them (GR6, motion rule 3). The region is a polite live region that always exists;
 * error toasts are role="alert". Renders in the OverlayRoot layer (review frames) or document.body (app).
 * Motion (docs/motion.md 3.6 T1, 3.7): drop in `slow` `--ease-enter`, out `.motion-soft-out` `exit`, solid surface. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { t } from "../i18n";
import { Button, IconButton } from "./Button";
import { Icon } from "./icons";
import { durationMs, EXIT_SLACK_MS } from "./motion";
import { OverlayPortal } from "./OverlayRoot";
import s from "./Toast.module.css";

/** Auto-hide delay for neutral toasts (motion.md T1: 5 s). A behaviour timer, not a motion token. */
export const TOAST_AUTO_HIDE_MS = 5000;

export interface ToastAction { label: string; onClick: () => void }

export interface ToastProps {
  message: ReactNode;
  action?: ToastAction;
  tone?: "neutral" | "error";
  onDismiss?: () => void;
  /** Playing the exit animation. */
  leaving?: boolean;
  /** Render in the flow (stories, gallery) instead of inside the region. */
  inline?: boolean;
}

/** One toast, presentational. Use `useToast().show()` in the app; render it directly only for review states. */
export function Toast({ message, action, tone = "neutral", onDismiss, leaving, inline }: ToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`${s.toast} ${tone === "error" ? s.error : ""} ${inline ? s.inline : ""} ${leaving ? "motion-soft-out" : ""}`}
    >
      {tone === "error" ? <span className={s.icon}><Icon name="alert" size="sm" /></span> : null}
      <span className={s.message}>{message}</span>
      {action ? (
        <Button variant="link" size="sm" className={s.action} data-track="toast-action" onClick={() => { action.onClick(); onDismiss?.(); }}>{action.label}</Button>
      ) : null}
      {onDismiss ? <IconButton icon="x" size="sm" label={t("overlay.dismiss")} data-track="toast-dismiss" onClick={onDismiss} /> : null}
    </div>
  );
}

export interface ToastOptions {
  message: ReactNode;
  action?: ToastAction;
  tone?: "neutral" | "error";
  /** ms before it hides; `null` keeps it (errors default to null). */
  duration?: number | null;
}

interface Item extends ToastOptions { id: number; leaving: boolean }

interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Toasts from anywhere under the provider. Outside a provider, `show` is a no-op (and warns in development). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  return api ?? {
    show: () => {
      if (import.meta.env.DEV) console.warn("useToast outside ToastProvider");
      return -1;
    },
    dismiss: () => {},
  };
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Queue new toasts while true (the user is speaking); they appear when it turns false. */
  paused?: boolean;
  /** At most this many on screen; older ones leave first. */
  max?: number;
}

export function ToastProvider({ children, paused = false, max = 3 }: ToastProviderProps) {
  const [items, setItems] = useState<Item[]>([]);
  const queue = useRef<Item[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const dismiss = useCallback((id: number) => {
    queue.current = queue.current.filter((i) => i.id !== id);
    const ms = durationMs("--duration-exit");
    if (ms <= 0) {
      remove(id);
      return;
    }
    setItems((list) => list.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.set(id, window.setTimeout(() => remove(id), ms + EXIT_SLACK_MS));
  }, [remove]);

  const push = useCallback((item: Item) => {
    setItems((list) => {
      const live = list.filter((i) => !i.leaving);
      const over = live.length + 1 - max;
      if (over > 0) live.slice(0, over).forEach((i) => window.setTimeout(() => dismiss(i.id), 0));
      return [...list, item];
    });
  }, [dismiss, max]);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
    if (paused || !queue.current.length) return;
    const pending = queue.current;
    queue.current = [];
    pending.forEach(push);
  }, [paused, push]);

  const show = useCallback((o: ToastOptions) => {
    const item: Item = { ...o, id: nextId.current++, leaving: false };
    if (pausedRef.current) queue.current.push(item);
    else push(item);
    return item.id;
  }, [push]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastRegion({ items, onDismiss }: { items: Item[]; onDismiss: (id: number) => void }) {
  // D78: a modal dialog (Settings) sits in the browser's top layer, above anything in the page; a toast shown while it
  // is open goes inside it, so it is seen ("Saved") and is not inert.
  return (
    <OverlayPortal host={items.length ? openModal() : null}>
      <div className={s.region} role="region" aria-label={t("overlay.notifications")} aria-live="polite">
        {items.map((item) => <TimedToast key={item.id} item={item} onDismiss={onDismiss} />)}
      </div>
    </OverlayPortal>
  );
}

/** Auto-hide, paused while the pointer or focus is on the toast. */
function TimedToast({ item, onDismiss }: { item: Item; onDismiss: (id: number) => void }) {
  const [hold, setHold] = useState(false);
  const duration = item.duration === undefined ? (item.tone === "error" ? null : TOAST_AUTO_HIDE_MS) : item.duration;
  useEffect(() => {
    if (duration === null || hold || item.leaving) return;
    const id = window.setTimeout(() => onDismiss(item.id), duration);
    return () => window.clearTimeout(id);
  }, [duration, hold, item.leaving, item.id, onDismiss]);
  return (
    <div
      className={s.slot}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <Toast message={item.message} action={item.action} tone={item.tone} leaving={item.leaving} onDismiss={() => onDismiss(item.id)} />
    </div>
  );
}

function openModal(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  try {
    return document.querySelector<HTMLElement>("dialog:modal");
  } catch {
    return null;
  }
}
