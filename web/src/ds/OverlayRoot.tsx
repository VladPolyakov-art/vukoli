/* OverlayRoot (ds/screens/_index.md §2.4): where Dialog, Drawer, Menu, Toast and Tooltip render.
 * - Inside an <OverlayRoot> (the review page wraps every frame in one) overlays portal into its layer and are
 *   positioned relative to it, so they stay inside the scaled frame. A modal Dialog then uses a plain scrim
 *   element instead of the top layer (showModal() would cover the whole review page).
 * - Without one (the real app) overlays portal into document.body — or into the open <dialog> that contains
 *   their trigger, so a menu inside a modal dialog is neither inert nor hidden under the top layer — and the
 *   Dialog keeps native showModal().
 * The layer is an inline-size container named `overlay`, so overlay CSS can adapt to the frame width. */
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./OverlayRoot.module.css";

interface OverlayCtx {
  /** True inside an <OverlayRoot>, even before its layer element exists. */
  inside: boolean;
  container: HTMLElement | null;
}

const OverlayContext = createContext<OverlayCtx>({ inside: false, container: null });

export interface OverlayRootProps {
  children: ReactNode;
  className?: string;
}

export function OverlayRoot({ children, className }: OverlayRootProps) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  return (
    <OverlayContext.Provider value={{ inside: true, container: layer }}>
      <div className={`${s.root} ${className ?? ""}`}>
        {children}
        <div ref={setLayer} className={s.layer} data-overlay-root="" />
      </div>
    </OverlayContext.Provider>
  );
}

/** The overlay context: `inside` an OverlayRoot or not, and its layer element once mounted. */
export function useOverlayRoot(): OverlayCtx {
  return useContext(OverlayContext);
}

export interface OverlayPortalProps {
  children: ReactNode;
  /** In the app (no OverlayRoot): portal here instead of document.body (e.g. the open dialog around the trigger). */
  host?: HTMLElement | null;
}

/** Portal into the OverlayRoot layer, else into `host` or document.body. Inside an OverlayRoot whose layer is not
 * mounted yet it renders nothing for one commit (never into the page body by mistake). */
export function OverlayPortal({ children, host }: OverlayPortalProps) {
  const { inside, container } = useContext(OverlayContext);
  if (inside) return container ? createPortal(children, container) : null;
  if (typeof document === "undefined") return null;
  return createPortal(children, host ?? document.body);
}
