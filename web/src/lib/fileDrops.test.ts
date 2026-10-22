import { describe, expect, it } from "vitest";
import { guardFileDrops } from "./fileDrops";

function drag(type: "dragover" | "drop", kinds: string[], handled = false) {
  const e = new Event(type, { cancelable: true }) as DragEvent;
  const dataTransfer = { types: kinds, dropEffect: "move" };
  Object.defineProperty(e, "dataTransfer", { value: dataTransfer });
  if (handled) e.preventDefault();
  return { e, dataTransfer };
}

describe("file drops outside a drop zone (D89)", () => {
  it("are refused instead of opening the file in place of the app", () => {
    const win = new EventTarget() as unknown as Window;
    const stop = guardFileDrops(win);
    const over = drag("dragover", ["Files"]);
    win.dispatchEvent(over.e);
    expect(over.e.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe("none");
    const drop = drag("drop", ["Files"]);
    win.dispatchEvent(drop.e);
    expect(drop.e.defaultPrevented).toBe(true);
    stop();
  });

  it("leave text drags and zones that took the file alone", () => {
    const win = new EventTarget() as unknown as Window;
    const stop = guardFileDrops(win);
    const text = drag("dragover", ["text/plain"]);
    win.dispatchEvent(text.e);
    expect(text.e.defaultPrevented).toBe(false);
    const zone = drag("dragover", ["Files"], true);
    win.dispatchEvent(zone.e);
    expect(zone.dataTransfer.dropEffect).toBe("move");
    stop();
  });
});
