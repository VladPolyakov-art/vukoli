/* Content swap with an exit (docs/motion.md 3.1: mode switch, route change).
 * The outgoing content keeps its React instance (same key), so it does not remount or refetch while it fades;
 * it is inert and hidden from assistive tech, and it is removed on a timer (rule 5: exits never block).
 * If focus was inside the outgoing content, it moves to `focusTarget` (or the incoming content) at once. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { durationMs, EXIT_SLACK_MS } from "./motion";
import s from "./Swap.module.css";

export interface SwapProps {
  /** A new key swaps the content. */
  swapKey: string;
  children: ReactNode;
  /** Class for the incoming content after a swap (not on first mount). */
  enterClass?: string;
  /** Class for the outgoing content. */
  exitClass?: string;
  className?: string;
  /** Where focus goes when it was inside the outgoing content. Defaults to the incoming content. */
  focusTarget?: () => HTMLElement | null;
}

interface Layer { key: string; node: ReactNode }

export function Swap({ swapKey, children, enterClass = "motion-rise-base", exitClass = "motion-soft-out", className, focusTarget }: SwapProps) {
  const [current, setCurrent] = useState(swapKey);
  const [prev, setPrev] = useState<Layer | null>(null);
  const [swapped, setSwapped] = useState(false);
  const lastNode = useRef<ReactNode>(children);
  const outRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLDivElement>(null);

  // A new key: keep the last rendered content of the old key as the outgoing layer (state update during render).
  if (swapKey !== current) {
    setPrev(durationMs("--duration-exit") > 0 ? { key: current, node: lastNode.current } : null);
    setCurrent(swapKey);
    setSwapped(true);
  }

  useEffect(() => {
    lastNode.current = children;
  });

  useLayoutEffect(() => {
    if (!prev) return;
    const active = document.activeElement;
    if (active && outRef.current?.contains(active)) {
      const target = focusTarget?.() ?? inRef.current;
      target?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev]);

  useEffect(() => {
    if (!prev) return;
    const id = window.setTimeout(() => setPrev(null), durationMs("--duration-exit") + EXIT_SLACK_MS);
    return () => window.clearTimeout(id);
  }, [prev]);

  return (
    <div className={`${s.swap} ${className ?? ""}`}>
      {prev ? (
        <div key={`swap-${prev.key}`} ref={outRef} className={`${s.out} ${exitClass}`} aria-hidden="true" inert>
          {prev.node}
        </div>
      ) : null}
      <div key={`swap-${current}`} ref={inRef} className={swapped ? enterClass : undefined} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
