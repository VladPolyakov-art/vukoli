/* Shared overlay behaviour for Dialog, Drawer, Menu, Tooltip, Toast: focus handling and anchored positioning.
 * No library. Positions are computed in the overlay container's own CSS pixels, so a menu stays attached to its
 * trigger inside a scaled review frame (getBoundingClientRect returns scaled numbers; we divide the scale out). */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Container width (CSS px) below which menus become a full-width sheet under the trigger.
 * Mirrors the `shell` mobile breakpoint in ds/screens/_index.md §2 (a container width, not a design value). */
export const OVERLAY_NARROW_MAX = 640;

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
}

/** Keep Tab inside `root` (modal Drawer and the contained Dialog). Call from the root's onKeyDown. */
export function trapTab(event: { key: string; shiftKey: boolean; preventDefault: () => void }, root: HTMLElement | null) {
  if (event.key !== "Tab" || !root) return;
  const list = focusables(root);
  if (!list.length) {
    event.preventDefault();
    root.focus();
    return;
  }
  const first = list[0]!;
  const last = list[list.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Focus for a modal overlay that is not a native modal dialog (Drawer, contained Dialog):
 * when `open` turns true after mount, remember the opener and move focus into `ref` (first `[data-autofocus]`,
 * else the first focusable, else the root); when it turns false, return focus to the opener at once.
 * An overlay that is open on first mount (a static review state) does not steal focus from the page.
 */
export function useOverlayFocus(ref: RefObject<HTMLElement | null>, open: boolean) {
  // `open` should be "open and mounted": the element must exist when it turns true.
  const opener = useRef<HTMLElement | null>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const wasFirst = first.current;
    first.current = false;
    if (open) {
      if (wasFirst) return;
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const root = ref.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(root)[0] ?? root;
      target.focus({ preventScroll: true });
      return;
    }
    const back = opener.current;
    opener.current = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }, [open, ref]);
}

/** The open <dialog> around `el`, if any: in the app, overlays inside a modal dialog portal there (top layer, not inert). */
export function dialogHost(el: Element | null): HTMLElement | null {
  return (el?.closest("dialog[open]") as HTMLElement | null) ?? null;
}

/** Resolve a length custom property (rem / px) to CSS px on `el`. */
export function cssPx(el: Element, name: string, fallback = 0): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const m = /^(-?\d*\.?\d+)(px|rem)?$/.exec(raw);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (m[2] === "rem") return n * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  return n;
}

/** "right-*" (D79): beside the trigger, edges aligned at the top (start) or bottom (end); above or below when no room. */
export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "right-start" | "right-end";

export interface AnchorBox { left: number; top: number; width: number; height: number }
export interface Space { width: number; height: number }

export interface PlaceOptions {
  placement: Placement;
  /** Floating element size in CSS px (offsetWidth / offsetHeight, without margins). */
  floating: { width: number; height: number };
  /** Distance kept from the container edges. */
  pad: number;
  /** Gap between trigger and floating element (the floating CSS adds it as a margin). */
  gap: number;
  /** `true`: as wide as the anchor. `"min"`: at least as wide as the anchor (a Select's options may be longer). */
  matchWidth?: boolean | "min";
  /** Full-width sheet under the trigger when the container is narrow (menus on phones, home.md §3.6). */
  sheetWhenNarrow?: boolean;
}

export interface Placed {
  side: "top" | "bottom" | "right";
  align: "start" | "end";
  left: number;
  top: number;
  width?: number;
  maxHeight: number;
}

/** Pure placement: anchor and container in the same CSS-pixel space. Flips above when there is more room there. */
export function place(anchor: AnchorBox, space: Space, o: PlaceOptions): Placed {
  const narrow = Boolean(o.sheetWhenNarrow) && space.width < OVERLAY_NARROW_MAX;
  if (o.placement.startsWith("right")) {
    const end = o.placement.endsWith("end");
    const left = anchor.left + anchor.width + o.gap;
    if (!narrow && left + o.floating.width <= space.width - o.pad) {
      const maxHeight = Math.max(0, space.height - o.pad * 2);
      const height = Math.min(o.floating.height, maxHeight);
      let top = end ? anchor.top + anchor.height - height : anchor.top;
      top = Math.max(o.pad, Math.min(top, space.height - o.pad - height));
      // The gap is in `left` here; the right-side CSS adds no margin.
      return { side: "right", align: end ? "end" : "start", left, top, maxHeight };
    }
    return place(anchor, space, { ...o, placement: end ? "top-start" : "bottom-start" });
  }
  const below = space.height - (anchor.top + anchor.height) - o.gap - o.pad;
  const above = anchor.top - o.gap - o.pad;
  const wantTop = o.placement.startsWith("top");
  let side: "top" | "bottom" = wantTop ? "top" : "bottom";
  if (side === "bottom" && o.floating.height > below && above > below) side = "top";
  else if (side === "top" && o.floating.height > above && below > above) side = "bottom";
  let maxHeight = Math.max(0, side === "bottom" ? below : above);
  if (narrow) maxHeight = Math.min(maxHeight, space.height * 0.6);
  const height = Math.min(o.floating.height, maxHeight);
  const top = side === "bottom" ? anchor.top + anchor.height : anchor.top - height;
  const align: "start" | "end" = o.placement.endsWith("end") ? "end" : "start";
  if (narrow) {
    return { side, align: "start", left: o.pad, top, width: Math.max(0, space.width - o.pad * 2), maxHeight };
  }
  const width = o.matchWidth === "min" ? Math.max(anchor.width, o.floating.width) : o.matchWidth ? anchor.width : o.floating.width;
  let left = align === "end" ? anchor.left + anchor.width - width : anchor.left;
  left = Math.min(left, space.width - o.pad - width);
  left = Math.max(o.pad, left);
  return { side, align, left, top, width: o.matchWidth ? width : undefined, maxHeight };
}

/**
 * Position `floating` next to `anchor` inside `container` (the OverlayRoot layer) or the viewport (container null).
 * Re-measures on resize and on any scroll. Returns the style to apply and the resolved side (for the motion origin).
 */
export function useAnchoredPosition(opts: {
  active: boolean;
  anchor: RefObject<HTMLElement | null>;
  floating: RefObject<HTMLElement | null>;
  container: HTMLElement | null;
  placement: Placement;
  matchWidth?: boolean | "min";
  sheetWhenNarrow?: boolean;
}) {
  const { active, anchor, floating, container, placement, matchWidth, sheetWhenNarrow } = opts;
  const [placed, setPlaced] = useState<Placed | null>(null);

  const measure = useCallback(() => {
    const a = anchor.current;
    const f = floating.current;
    if (!a || !f) return;
    const ar = a.getBoundingClientRect();
    let originX = 0;
    let originY = 0;
    let scale = 1;
    let space: Space = { width: document.documentElement.clientWidth, height: window.innerHeight };
    if (container) {
      const cr = container.getBoundingClientRect();
      space = { width: container.clientWidth, height: container.clientHeight };
      scale = space.width ? cr.width / space.width : 1;
      originX = cr.left;
      originY = cr.top;
    }
    const box: AnchorBox = {
      left: (ar.left - originX) / scale,
      top: (ar.top - originY) / scale,
      width: ar.width / scale,
      height: ar.height / scale,
    };
    const next = place(box, space, {
      placement,
      floating: { width: f.offsetWidth, height: f.scrollHeight },
      pad: cssPx(f, "--layout-gutter", 16),
      gap: cssPx(f, "--space-1", 4),
      matchWidth,
      sheetWhenNarrow,
    });
    setPlaced((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.side === next.side && prev.width === next.width && prev.maxHeight === next.maxHeight
        ? prev
        : next,
    );
  }, [anchor, floating, container, placement, matchWidth, sheetWhenNarrow]);

  useLayoutEffect(() => {
    if (!active) {
      setPlaced(null);
      return;
    }
    measure();
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro && floating.current) ro.observe(floating.current);
    if (ro && container) ro.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro?.disconnect();
    };
  }, [active, measure, floating, container]);

  const style: CSSProperties = placed
    ? { left: placed.left, top: placed.top, width: placed.width, maxHeight: placed.maxHeight }
    : { left: 0, top: 0, visibility: "hidden" };
  return { style, side: placed?.side ?? "bottom", align: placed?.align ?? "start", placed };
}

/** Close on a pointer press outside every given element (menus, popovers). */
export function useOutsidePress(active: boolean, refs: RefObject<HTMLElement | null>[], onOutside: () => void) {
  const cb = useRef(onOutside);
  useEffect(() => {
    cb.current = onOutside;
  });
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (refs.some((r) => r.current && target && r.current.contains(target))) return;
      cb.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // refs are stable ref objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
