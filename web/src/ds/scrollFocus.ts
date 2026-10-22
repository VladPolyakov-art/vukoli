/* Keyboard access to scrollable boxes (QA-09, WCAG 2.1.1). A box that scrolls and holds nothing focusable cannot be
 * scrolled with the keyboard, so it gets `tabindex="0"`, a landmark role and a name. A box that is not scrollable, or
 * that already holds a control, is left alone (no extra tab stop). */
import { useCallback, useEffect, useState, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ScrollMetrics {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  hasFocusable: boolean;
}

/** True when the box scrolls (either axis, one pixel of slack for rounding) and offers no focus stop of its own. */
export function needsScrollFocus(m: ScrollMetrics): boolean {
  const scrolls = m.scrollHeight > m.clientHeight + 1 || m.scrollWidth > m.clientWidth + 1;
  return scrolls && !m.hasFocusable;
}

export interface ScrollFocusProps<T extends HTMLElement> {
  /** Callback ref: the box may mount later than the component (a drawer's portal), so the element is kept in state. */
  ref: (node: T | null) => void;
  tabIndex?: 0;
  role?: "region";
  "aria-label"?: string;
}

/** The attributes the scroller gets: they appear only while the box scrolls and has nothing focusable inside. */
export function scrollFocusAttrs(on: boolean, label: string): Pick<ScrollFocusProps<HTMLElement>, "tabIndex" | "role" | "aria-label"> {
  return on ? { tabIndex: 0, role: "region", "aria-label": label } : {};
}

/** Watches the box (size and content) and returns its `ref` plus the attributes from `scrollFocusAttrs`; spread both
 * on the scroller. `forward` also receives the element, for a box whose ref is used for something else too. */
export function useScrollFocusable<T extends HTMLElement = HTMLDivElement>(label: string, forward?: RefObject<T | null>): ScrollFocusProps<T> {
  const [el, setEl] = useState<T | null>(null);
  const [on, setOn] = useState(false);
  const ref = useCallback((node: T | null) => {
    setEl(node);
    if (forward) (forward as { current: T | null }).current = node;
  }, [forward]);
  useEffect(() => {
    if (!el) return;
    const check = () => setOn(needsScrollFocus({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      hasFocusable: Boolean(el.querySelector(FOCUSABLE)),
    }));
    check();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    ro?.observe(el);
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(check);
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { ro?.disconnect(); mo?.disconnect(); };
  }, [el]);
  return { ref, ...scrollFocusAttrs(on, label) };
}
