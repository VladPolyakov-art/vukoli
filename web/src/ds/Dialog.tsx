import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import { IconButton } from "./Button";
import { durationMs, runExit, usePresence } from "./motion";
import { OverlayPortal, useOverlayRoot } from "./OverlayRoot";
import { trapTab, useOverlayFocus } from "./overlay";
import s from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  /** End-aligned actions (the primary last). On a narrow dialog they stack, primary on top. A `lg` panel may have none. */
  actions?: ReactNode;
  /** Start-aligned actions, e.g. "Delete job" in the vacancy editor (edit mode). */
  actionsStart?: ReactNode;
  onClose: () => void;
  /** A × button in the header with this label: for help and info dialogs that are not a decision (D66). */
  closeLabel?: string;
  /** Render open in the document flow: no portal, no scrim, no focus move. For stories and the review gallery. */
  inline?: boolean;
  /** `md` (default): a decision. `lg` (D76): a tall panel with its own layout in the body, e.g. Settings; full screen on a phone. */
  size?: "md" | "lg";
  /** A press outside the box closes it (D78: Settings). Off for decisions, where a stray click must not cancel. */
  closeOnBackdrop?: boolean;
}

/** Modal decision. Three render modes, one look:
 * - **modal** (the app): native <dialog> + showModal(): focus trap, Esc and inert background come from the platform.
 * - **contained** (inside an OverlayRoot, i.e. a review frame): non-modal <dialog open> in the frame's layer with a
 *   plain scrim element; Esc, a Tab trap and focus return are done here. It never escapes the scaled frame.
 * - **inline**: the open dialog box in the flow, for the gallery.
 * Motion (docs/motion.md 3.3 D11, 3.7): `dialog-in` and a plain scrim fade (no blur). On close the modal leaves the top
 * layer at once — the page is interactive again and focus returns immediately — while a non-interactive copy of its box
 * plays `dialog-out` (rule 5: the exit never blocks, it ends on a timer even if `animationend` never fires). */
export function Dialog(props: DialogProps) {
  const { inside } = useOverlayRoot();
  if (props.inline) return props.open ? <DialogBox {...props} mode="inline" /> : null;
  if (inside) return <ContainedDialog {...props} />;
  return <ModalDialog {...props} />;
}

interface BoxProps extends DialogProps {
  mode: "inline" | "contained";
  className?: string;
  ref?: Ref<HTMLDialogElement>;
}

function DialogBox({ title, children, actions, actionsStart, onClose, closeLabel, mode, open, className, ref, size }: BoxProps) {
  const id = useId();
  return (
    <dialog
      ref={ref}
      open
      className={`${s.dialog} ${mode === "inline" ? s.inline : s.contained} ${size === "lg" ? s.lg : ""} ${className ?? ""}`}
      aria-labelledby={`${id}-t`}
      aria-modal={mode === "contained" ? true : undefined}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
          return;
        }
        if (mode === "contained") trapTab(e, e.currentTarget);
      }}
    >
      <Inner id={id} title={title} actions={actions} actionsStart={actionsStart} onClose={onClose} closeLabel={closeLabel}>{children}</Inner>
    </dialog>
  );
}

function Inner({ id, title, children, actions, actionsStart, onClose, closeLabel }: {
  id: string; title: ReactNode; children?: ReactNode; actions?: ReactNode; actionsStart?: ReactNode;
  onClose: () => void; closeLabel?: string;
}) {
  return (
    <div className={s.inner}>
      <div className={s.head}>
        <h2 id={`${id}-t`} className={s.title}>{title}</h2>
        {closeLabel ? <IconButton icon="x" size="sm" label={closeLabel} className={s.close} data-track="dialog-close" onClick={onClose} /> : null}
      </div>
      {children ? <div className={s.body}>{children}</div> : null}
      {actions || actionsStart ? (
        <div className={s.actionsRow}>
          {actionsStart ? <div className={s.actionsStart}>{actionsStart}</div> : null}
          <div className={s.actions}>{actions}</div>
        </div>
      ) : null}
    </div>
  );
}

function ContainedDialog(props: DialogProps) {
  const { open } = props;
  const { mounted, leaving } = usePresence(open);
  const box = useRef<HTMLDialogElement>(null);
  useOverlayFocus(box, open && mounted);
  if (!mounted) return null;
  return (
    <OverlayPortal>
      <div className={s.containedRoot}>
        <div className={`${s.scrim} ${leaving ? s.scrimOut : ""}`} aria-hidden="true"
          onClick={props.closeOnBackdrop && open ? props.onClose : undefined} />
        <DialogBox {...props} open={open && !leaving} mode="contained" ref={box} className={leaving ? s.leaving : undefined} />
      </div>
    </OverlayPortal>
  );
}

function ModalDialog({ open, title, children, actions, actionsStart, onClose, closeLabel, size, closeOnBackdrop }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // A backdrop press is a press on the <dialog> itself, outside its inner box. It must start there too, so a text
  // selection dragged out of the box does not close it.
  const downOnBackdrop = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const cancelExit = useRef<(() => void) | null>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      cancelExit.current?.();
      cancelExit.current = null;
      el.inert = false;
      if (!el.open) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        el.showModal();
      }
      return;
    }
    if (!el.open) return;
    el.close();
    // Browsers restore focus on close; do it ourselves where they don't.
    const back = opener.current;
    if (back && back.isConnected && (document.activeElement === document.body || el.contains(document.activeElement))) {
      back.focus({ preventScroll: true });
    }
    el.inert = true; // the fading copy is never reachable by Tab
    cancelExit.current = runExit(el, {
      className: s.closing ?? "closing",
      durationMs: durationMs("--duration-exit"),
      onDone: () => { el.inert = false; },
    });
  }, [open]);
  useEffect(() => () => cancelExit.current?.(), []);
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${s.modal} ${size === "lg" ? s.lg : ""}`}
      aria-labelledby={`${id}-t`}
      onClose={() => { if (open) onClose(); }}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onPointerDown={closeOnBackdrop ? (e) => { downOnBackdrop.current = e.target === e.currentTarget; } : undefined}
      onClick={closeOnBackdrop ? (e) => {
        if (open && downOnBackdrop.current && e.target === e.currentTarget && outsideBox(e.currentTarget, e.clientX, e.clientY)) onClose();
        downOnBackdrop.current = false;
      } : undefined}
    >
      <Inner id={id} title={title} actions={actions} actionsStart={actionsStart} onClose={onClose} closeLabel={closeLabel}>{children}</Inner>
    </dialog>
  );
}

/** The click lies outside the dialog's box (its border box; a click on the dialog's own padding is inside). */
function outsideBox(el: HTMLElement, x: number, y: number) {
  const r = el.getBoundingClientRect();
  return x < r.left || x > r.right || y < r.top || y > r.bottom;
}
