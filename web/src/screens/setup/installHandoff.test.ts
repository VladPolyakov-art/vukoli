import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WindowLink } from "../../lib/windowLink";
import { CLOSE_GRACE_MS, HELLO_WAIT_MS, handOffToInstalledApp } from "./installHandoff";

/** A link whose hello we fire by hand. */
function fakeLink() {
  const listeners = new Set<(m: { type: "hello"; id: string; loadedAt: number }) => void>();
  const link: WindowLink = {
    id: "old", loadedAt: 0, hello: () => {}, ping: vi.fn(),
    onHello(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    dispose: () => {},
  };
  return { link, say: (loadedAt: number) => listeners.forEach((l) => l({ type: "hello", id: "new", loadedAt })) };
}

describe("install hand-off (D104)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("the new window says hello: this window closes itself at once", async () => {
    const { link, say } = fakeLink();
    const closeWindow = vi.fn();
    const done = vi.fn();
    void handOffToInstalledApp({ link, since: 100, closeWindow }).then(done);
    expect(link.ping).toHaveBeenCalledTimes(1);
    say(200);
    await vi.advanceTimersByTimeAsync(0);
    expect(closeWindow).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();                       // a window that closed never gets further
    await vi.advanceTimersByTimeAsync(CLOSE_GRACE_MS);
    expect(done).toHaveBeenCalled();                           // ...one that stays open does: close was refused, the caller continues here
  });

  it("no hello within the wait: it does not close and the caller continues here", async () => {
    const { link } = fakeLink();
    const closeWindow = vi.fn();
    const done = vi.fn();
    void handOffToInstalledApp({ link, since: 100, closeWindow }).then(done);
    await vi.advanceTimersByTimeAsync(HELLO_WAIT_MS - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("a hello from a window that loaded before Install does not close it", async () => {
    const { link, say } = fakeLink();
    const closeWindow = vi.fn();
    const done = vi.fn();
    void handOffToInstalledApp({ link, since: 100, closeWindow }).then(done);
    say(50);
    await vi.advanceTimersByTimeAsync(HELLO_WAIT_MS + 1);
    expect(closeWindow).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
  });

  it("window.close() throws: the caller continues here at once", async () => {
    const { link, say } = fakeLink();
    const done = vi.fn();
    void handOffToInstalledApp({ link, since: 0, closeWindow: () => { throw new Error("refused"); } }).then(done);
    say(5);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });
});
