import { describe, expect, it } from "vitest";
import { createInstallOffer, iconPlace, type InstallPromptEvent } from "./installApp";

/** A `beforeinstallprompt` event whose dialog ends with `outcome`. */
function promptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as InstallPromptEvent;
  let prompted = 0;
  e.prompt = async () => { prompted += 1; };
  e.userChoice = Promise.resolve({ outcome });
  return { e, prompted: () => prompted };
}

function setup(opts: { dismissed?: boolean } = {}) {
  const target = new EventTarget();
  let saved = 0;
  const offer = createInstallOffer({
    target,
    wasDismissed: () => Boolean(opts.dismissed),
    saveDismissed: () => { saved += 1; },
  });
  return { target, offer, saved: () => saved };
}

describe("install offer", () => {
  it("offers nothing until the browser says Vukoli can be installed", () => {
    const { offer } = setup();
    expect(offer.getSnapshot()).toEqual({ canInstall: false, showCard: false });
  });

  it("shows the card and the settings row when the browser offers the install, and keeps the event for our own button", () => {
    const { target, offer } = setup();
    const { e } = promptEvent();
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(offer.getSnapshot()).toEqual({ canInstall: true, showCard: true });
  });

  it("hides the card but not the settings row after 'Not now', and remembers it", () => {
    const { target, offer, saved } = setup();
    target.dispatchEvent(promptEvent().e);
    offer.dismiss();
    expect(offer.getSnapshot()).toEqual({ canInstall: true, showCard: false });
    expect(saved()).toBe(1);
    offer.dismiss();
    expect(saved()).toBe(1);
  });

  it("keeps the card hidden when it was dismissed on an earlier visit", () => {
    const { target, offer } = setup({ dismissed: true });
    target.dispatchEvent(promptEvent().e);
    expect(offer.getSnapshot()).toEqual({ canInstall: true, showCard: false });
  });

  it("opens the browser's dialog once and hides everything while it is open", async () => {
    const { target, offer } = setup();
    const { e, prompted } = promptEvent("accepted");
    target.dispatchEvent(e);
    const result = offer.install();
    expect(offer.getSnapshot().canInstall).toBe(false);
    expect(await result).toBe("accepted");
    expect(prompted()).toBe(1);
    expect(await offer.install()).toBe("unavailable");
    expect(prompted()).toBe(1);
  });

  it("treats a cancelled dialog as 'Not now'", async () => {
    const { target, offer, saved } = setup();
    target.dispatchEvent(promptEvent("dismissed").e);
    expect(await offer.install()).toBe("dismissed");
    expect(saved()).toBe(1);
    // Chrome may offer again later: the row comes back, the card stays away.
    target.dispatchEvent(promptEvent().e);
    expect(offer.getSnapshot()).toEqual({ canInstall: true, showCard: false });
  });

  it("hides everything after the app was installed, even if the browser offers again", () => {
    const { target, offer } = setup();
    target.dispatchEvent(promptEvent().e);
    target.dispatchEvent(new Event("appinstalled"));
    expect(offer.getSnapshot()).toEqual({ canInstall: false, showCard: false });
    target.dispatchEvent(promptEvent().e);
    expect(offer.getSnapshot().canInstall).toBe(false);
  });

  it("tells the listeners only when something changed", () => {
    const { target, offer } = setup();
    let calls = 0;
    const off = offer.subscribe(() => { calls += 1; });
    target.dispatchEvent(promptEvent().e);
    target.dispatchEvent(promptEvent().e);
    expect(calls).toBe(1);
    off();
    offer.dismiss();
    expect(calls).toBe(1);
  });
});

describe("iconPlace", () => {
  it("is the Dock on a Mac and the taskbar elsewhere", () => {
    expect(iconPlace("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150.0 Safari/537.36")).toBe("dock");
    expect(iconPlace("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0 Safari/537.36")).toBe("taskbar");
    expect(iconPlace("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/150.0 Safari/537.36")).toBe("taskbar");
  });
});
