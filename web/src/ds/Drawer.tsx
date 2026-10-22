/* Drawer / side sheet (G5, components.md §4): a modal panel from an edge.
 * - left: the rail below 1024 (AppShell top bar → menu button), `--layout-rail` wide, sidebar surface.
 * - right: the Session feedback panel at mid width (`--layout-panel`).
 * - bottom: the Session feedback sheet on a phone (top radius `--radius-xl`, max height under the top bar).
 * Modal: role="dialog" + aria-modal, focus moves in and is trapped, Esc and a scrim click close it, focus returns
 * to the opener. Renders into the OverlayRoot layer when there is one (review frames), else into document.body.
 * Motion (docs/motion.md 3.7): slide from the edge `slow` `--ease-standard`, exit `exit`, scrim plain fade, no blur. */
import { useId, useRef, type ReactNode } from "react";
import { t } from "../i18n";
import { IconButton } from "./Button";
import { usePresence } from "./motion";
import { OverlayPortal } from "./OverlayRoot";
import { useScrollFocusable } from "./scrollFocus";
import { trapTab, useOverlayFocus } from "./overlay";
import s from "./Drawer.module.css";

export type DrawerSide = "left" | "right" | "bottom";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  /** Accessible name. Shown as the header title when `title` is not given and `showHeader` is true. */
  label: string;
  /** Visible header title (h2). With a title, the header also has a close button. */
  title?: ReactNode;
  /** Close button label in the header (default "Close"), e.g. "Hide feedback". */
  closeLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
  /** Surface: raised (default for right / bottom) or sidebar (default for left: the rail). */
  tone?: "raised" | "sidebar";
  /** Entrance duration: `slow` (default) or `slower` (the Session feedback panel, session.md §5). */
  duration?: "slow" | "slower";
  /** Render the open panel in the flow (no portal, no scrim, no focus move): stories and the review gallery. */
  inline?: boolean;
}

export function Drawer({
  open, onClose, side = "right", label, title, closeLabel, footer, children, tone, duration = "slow", inline,
}: DrawerProps) {
  const { mounted, leaving } = usePresence(open && !inline);
  const panel = useRef<HTMLDivElement>(null);
  // QA-09: a sheet that scrolls and holds no control stays reachable by keyboard.
  const bodyFocus = useScrollFocusable(typeof title === "string" ? title : label);
  const id = useId();
  useOverlayFocus(panel, open && !inline && mounted);
  const surface = tone ?? (side === "left" ? "sidebar" : "raised");

  const body = (
    <div
      ref={panel}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-label={title ? undefined : label}
      aria-labelledby={title ? `${id}-t` : undefined}
      tabIndex={-1}
      data-side={side}
      className={[
        s.panel, s[side], s[surface], duration === "slower" ? s.slower : "", inline ? s.inline : "", leaving ? s.out : "",
      ].filter(Boolean).join(" ")}
      onKeyDown={(e) => {
        if (inline) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        trapTab(e, panel.current);
      }}
    >
      {title ? (
        <div className={s.header}>
          <h2 id={`${id}-t`} className={s.title}>{title}</h2>
          <IconButton icon="x" size="sm" label={closeLabel ?? t("common.close")} data-track="drawer-close" onClick={onClose} />
        </div>
      ) : null}
      <div className={s.body} {...bodyFocus}>{children}</div>
      {footer ? <div className={s.footer}>{footer}</div> : null}
    </div>
  );

  if (inline) return open ? body : null;
  if (!mounted) return null;
  return (
    <OverlayPortal>
      <div className={s.root}>
        <div className={`${s.scrim} ${leaving ? s.scrimOut : ""}`} aria-hidden="true" onClick={onClose} />
        {body}
      </div>
    </OverlayPortal>
  );
}
