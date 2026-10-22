/* Roving tabindex for single-choice groups (ARIA radio group pattern), shared by ChipGroup and
 * SelectableCardGroup. Items render role="radio" + aria-checked themselves; the group owns focus:
 * - one Tab stop: the checked radio, or the first enabled one when nothing is checked yet;
 * - arrows move focus AND select (the item's own click handler runs), Home / End jump to the ends.
 * DOM-based on purpose: items stay plain children, no context or cloneElement. */
import { useCallback, useLayoutEffect, type KeyboardEvent, type RefObject } from "react";

const RADIO = '[role="radio"]';

function radios(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(RADIO)).filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true",
  );
}

/** Keep exactly one radio in the tab order. Runs after every render of the group. */
export function syncRovingTabIndex(root: HTMLElement) {
  const all = Array.from(root.querySelectorAll<HTMLElement>(RADIO));
  const enabled = radios(root);
  const checked = enabled.find((el) => el.getAttribute("aria-checked") === "true") ?? enabled[0];
  all.forEach((el) => el.setAttribute("tabindex", el === checked ? "0" : "-1"));
}

/** Index of the radio to move to for a key, or -1 when the key is not a navigation key. */
export function nextIndex(key: string, current: number, count: number): number {
  if (count === 0) return -1;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return -1;
  }
}

export function useRovingRadios(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    if (enabled && ref.current) syncRovingTabIndex(ref.current);
  });
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const root = ref.current;
      if (!enabled || !root) return;
      const list = radios(root);
      const current = list.indexOf(document.activeElement as HTMLElement);
      if (current < 0) return;
      const next = nextIndex(e.key, current, list.length);
      if (next < 0) return;
      e.preventDefault();
      const target = list[next]!;
      target.focus();
      if (target.getAttribute("aria-checked") !== "true") target.click();
    },
    [ref, enabled],
  );
}
