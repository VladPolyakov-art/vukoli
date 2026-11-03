import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWindowLink, waitForOtherWindow, type ChannelLike } from "./windowLink";

/** A bus that stands in for BroadcastChannel: a message reaches every channel on it except the sender's own. */
function bus() {
  const channels: FakeChannel[] = [];
  class FakeChannel implements ChannelLike {
    private listeners = new Set<(e: MessageEvent) => void>();
    constructor() { channels.push(this); }
    postMessage(message: unknown) {
      for (const c of channels) if (c !== this) queueMicrotask(() => c.listeners.forEach((l) => l({ data: message } as MessageEvent)));
    }
    addEventListener(_t: "message", l: (e: MessageEvent) => void) { this.listeners.add(l); }
    removeEventListener(_t: "message", l: (e: MessageEvent) => void) { this.listeners.delete(l); }
    close() { this.listeners.clear(); }
  }
  return () => new FakeChannel();
}

describe("window link", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("a window that loads after Install was pressed says hello and the waiting window sees it", async () => {
    const make = bus();
    const old = createWindowLink({ channel: make(), id: "old", now: () => 1000 });
    const waiting = waitForOtherWindow(old, { since: 1500, waitMs: 4000 });
    const fresh = createWindowLink({ channel: make(), id: "new", now: () => 2000 });
    fresh.hello();
    await vi.advanceTimersByTimeAsync(10);
    await expect(waiting).resolves.toBe(true);
  });

  it("a window that loaded before the waiter attached answers the ping", async () => {
    const make = bus();
    const fresh = createWindowLink({ channel: make(), id: "new", now: () => 2000 });   // loaded, said hello to nobody
    fresh.hello();
    const old = createWindowLink({ channel: make(), id: "old", now: () => 1000 });
    const waiting = waitForOtherWindow(old, { since: 1500, waitMs: 4000 });
    await vi.advanceTimersByTimeAsync(10);
    await expect(waiting).resolves.toBe(true);
  });

  it("a window that was already open before Install does not count", async () => {
    const make = bus();
    const old = createWindowLink({ channel: make(), id: "old", now: () => 1000 });
    createWindowLink({ channel: make(), id: "tab", now: () => 500 });                  // another tab, open all along
    const waiting = waitForOtherWindow(old, { since: 1500, waitMs: 4000 });
    await vi.advanceTimersByTimeAsync(4001);
    await expect(waiting).resolves.toBe(false);
  });

  it("ignores its own messages and gives up silently with no channel at all", async () => {
    const make = bus();
    const solo = createWindowLink({ channel: make(), id: "solo", now: () => 3000 });
    solo.hello();
    const waiting = waitForOtherWindow(solo, { since: 0, waitMs: 4000 });
    await vi.advanceTimersByTimeAsync(4001);
    await expect(waiting).resolves.toBe(false);

    const mute = createWindowLink({ channel: null });
    const w2 = waitForOtherWindow(mute, { since: 0, waitMs: 4000 });
    await vi.advanceTimersByTimeAsync(4001);
    await expect(w2).resolves.toBe(false);
  });
});
