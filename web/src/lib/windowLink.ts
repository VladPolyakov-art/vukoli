/* Windows of Vukoli talking to each other (BroadcastChannel "vukoli-window"). One use today: after the browser installs
 * Vukoli as an app it opens the app in a NEW window; the window the user installed from waits for that window to say
 * hello and then closes itself, so nobody has to close or reopen anything (docs/ui-spec.md §2.0).
 *
 * Every window posts `hello` when it loads and answers a `ping` with `hello` again. A `hello` carries the window's own
 * random id (to tell windows apart) and the time it loaded: the window that is waiting only counts a window that loaded
 * after it pressed Install, so a tab that was open all along is not mistaken for the new app window.
 * No BroadcastChannel (very old browsers, some privacy modes): the link is silent and the waiter simply times out. */

export const WINDOW_CHANNEL = "vukoli-window";

export type WindowMessage =
  | { type: "hello"; id: string; loadedAt: number }
  | { type: "ping"; id: string };

/** The part of BroadcastChannel the link uses (so tests can pass an in-memory pair). */
export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface WindowLink {
  /** This window's id (random per load). */
  readonly id: string;
  readonly loadedAt: number;
  /** Tell the other windows this one is here. */
  hello(): void;
  /** Ask the other windows to say hello again. */
  ping(): void;
  /** Hellos from OTHER windows. Returns the unsubscribe. */
  onHello(listener: (message: Extract<WindowMessage, { type: "hello" }>) => void): () => void;
  dispose(): void;
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isMessage(data: unknown): data is WindowMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (typeof d.id !== "string") return false;
  return d.type === "ping" || (d.type === "hello" && typeof d.loadedAt === "number");
}

export interface WindowLinkOptions {
  channel?: ChannelLike | null;
  id?: string;
  now?: () => number;
}

export function createWindowLink(options: WindowLinkOptions = {}): WindowLink {
  const id = options.id ?? randomId();
  const loadedAt = (options.now ?? Date.now)();
  const channel = options.channel ?? null;
  const listeners = new Set<(message: Extract<WindowMessage, { type: "hello" }>) => void>();

  const post = (message: WindowMessage) => {
    try { channel?.postMessage(message); } catch { /* a closed channel: nothing to tell */ }
  };
  const hello = () => post({ type: "hello", id, loadedAt });

  const handle = (event: MessageEvent) => {
    const m: unknown = event.data;
    if (!isMessage(m) || m.id === id) return;
    if (m.type === "ping") hello();
    else listeners.forEach((l) => l(m));
  };
  channel?.addEventListener("message", handle);

  return {
    id,
    loadedAt,
    hello,
    ping: () => post({ type: "ping", id }),
    onHello(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      channel?.removeEventListener("message", handle);
      try { channel?.close(); } catch { /* ignore */ }
    },
  };
}

export interface WaitForWindowOptions {
  /** Only a window that loaded at or after this time counts (the moment Install was pressed). */
  since: number;
  waitMs: number;
}

/** Resolves `true` when another window that loaded after `since` says hello, `false` after `waitMs`. Pings first, so a
 * window that loaded before the listener was attached still answers. */
export function waitForOtherWindow(link: WindowLink, { since, waitMs }: WaitForWindowOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let off = () => {};
    const timer = setTimeout(() => { off(); resolve(false); }, waitMs);
    off = link.onHello((m) => {
      if (m.loadedAt < since) return;
      clearTimeout(timer);
      off();
      resolve(true);
    });
    link.ping();
  });
}

/** The link of this window, made on first use; it says hello right away when the app starts (`announceWindow`). */
let shared: WindowLink | null = null;
export function windowLink(): WindowLink {
  if (!shared) {
    let channel: ChannelLike | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(WINDOW_CHANNEL);
    } catch { /* blocked: silent link */ }
    shared = createWindowLink({ channel });
  }
  return shared;
}

/** Called once from main.tsx: every window says hello when it loads. */
export function announceWindow() {
  windowLink().hello();
}
