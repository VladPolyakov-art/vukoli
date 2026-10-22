/* Tooltip (G6, components.md §4): the full text of a truncated title (Recent rows, History rows, the Session top-bar
 * context, a 2-line H1 clamp) and short labels. Replaces `title` attributes. Hover and keyboard focus show it, Esc
 * hides it, the pointer can move onto it (WCAG 1.4.13). With `onlyWhenTruncated` it appears only when the text is
 * actually cut (the element marked `data-truncate`, else the anchor itself) and adds no description, because the
 * accessible name already has the full text. Otherwise it describes the focusable element inside (aria-describedby).
 * Motion (docs/motion.md 3.7): show delay `--duration-slow` on hover (0 on focus), `fade-in` `fast`, hides at once. */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { durationMs } from "./motion";
import { OverlayPortal, useOverlayRoot } from "./OverlayRoot";
import { dialogHost, FOCUSABLE, useAnchoredPosition, type Placement } from "./overlay";
import s from "./Tooltip.module.css";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Show only when the text inside is truncated (ellipsis or line clamp). */
  onlyWhenTruncated?: boolean;
  placement?: Placement;
  /** Anchor box layout: inline (default) or block (fills the row, so ellipsis works inside). */
  block?: boolean;
  /** Force it visible (review states). With `inline` it renders under the anchor in the flow. */
  open?: boolean;
  inline?: boolean;
  className?: string;
  /** Never show (and hide at once): the rail's collapsed account button while its menu is open. */
  disabled?: boolean;
  /** `lg`: a message the user must notice (D75: the muted-speech tip over the mic) — larger text, rounded. */
  size?: "sm" | "lg";
}

function isTruncated(anchor: HTMLElement): boolean {
  const el = anchor.querySelector<HTMLElement>("[data-truncate]") ?? anchor;
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

export function Tooltip({ content, children, onlyWhenTruncated, placement = "top-start", block, open: forced, inline, className, disabled, size = "sm" }: TooltipProps) {
  const [shown, setShown] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const { container } = useOverlayRoot();
  const id = useId();
  const visible = (forced ?? shown) && !disabled;

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback((delayed: boolean) => {
    const anchor = anchorRef.current;
    if (!anchor || disabled || (onlyWhenTruncated && !isTruncated(anchor))) return;
    clear();
    const go = () => {
      setHost(dialogHost(anchor));
      setShown(true);
    };
    const delay = delayed ? durationMs("--duration-slow") : 0;
    if (delay > 0) timer.current = window.setTimeout(go, delay);
    else go();
  }, [onlyWhenTruncated, disabled]);
  const hide = useCallback(() => {
    clear();
    setShown(false);
  }, []);
  useEffect(() => clear, []);

  // Describe the focusable element inside (not when it only repeats a truncated name).
  useEffect(() => {
    if (onlyWhenTruncated) return;
    const target = anchorRef.current?.matches(FOCUSABLE) ? anchorRef.current : anchorRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    if (!target) return;
    if (visible) target.setAttribute("aria-describedby", id);
    else if (target.getAttribute("aria-describedby") === id) target.removeAttribute("aria-describedby");
  }, [visible, id, onlyWhenTruncated]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown, hide]);

  const positioned = useAnchoredPosition({
    active: visible && !inline,
    anchor: anchorRef,
    floating: tipRef,
    container,
    placement,
  });

  const tip = visible ? (
    <div
      ref={tipRef}
      id={id}
      role="tooltip"
      className={`${s.tip} ${size === "lg" ? s.lg : ""} ${inline ? s.inline : s.floating} ${positioned.side === "top" ? s.top : s.bottom}`}
      style={inline ? undefined : positioned.style}
      onPointerEnter={clear}
      onPointerLeave={forced === undefined ? hide : undefined}
    >
      {content}
    </div>
  ) : null;

  return (
    <span
      ref={anchorRef}
      className={`${block ? s.anchorBlock : s.anchor} ${inline ? s.inlineWrap : ""} ${className ?? ""}`}
      onPointerEnter={(e) => { if (e.pointerType !== "touch") show(true); }}
      onPointerLeave={(e) => {
        const to = e.relatedTarget as Node | null;
        if (to && tipRef.current?.contains(to)) return;
        if (forced === undefined) hide();
      }}
      onFocus={(e) => { if ((e.target as HTMLElement).matches(":focus-visible")) show(false); }}
      onBlur={() => { if (forced === undefined) hide(); }}
    >
      {children}
      {tip && (inline ? tip : <OverlayPortal host={host}>{tip}</OverlayPortal>)}
    </span>
  );
}
