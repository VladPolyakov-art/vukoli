/* Which layout the Session is in, measured on its own root (a container, not the viewport): review frames and the
 * real window use the same code. Thresholds are the `session` container widths of ds/screens/session.md §0 and
 * the same ones the CSS `@container session` queries use. Only the pieces that CSS can't swap (the panel becoming a
 * Drawer, the island's two rows) read this; every other layout rule stays in CSS. */
import { useLayoutEffect, useState, type RefObject } from "react";

export type SessionLayout = "wide" | "mid" | "narrow";

export const SESSION_WIDE = 1024;
export const SESSION_MID = 768;

export function layoutFor(width: number): SessionLayout {
  return width >= SESSION_WIDE ? "wide" : width >= SESSION_MID ? "mid" : "narrow";
}

/** Below this width the island goes to two rows (DS Island `layout: stacked`, session.md §V2.7). */
export const ISLAND_STACKED = 560;

/** Below this width (a phone) the text-mode island keeps End next to the status and moves the tools to the second row:
 * one row of status + three icons + End has no air at 375 and clips at 320 (13, QA-10). */
export const ISLAND_COMPACT = 420;

export function useSessionLayout(ref: RefObject<HTMLElement | null>): { layout: SessionLayout; stacked: boolean; compact: boolean } {
  const [width, setWidth] = useState<number>(SESSION_WIDE);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentBoxSize?.[0]?.inlineSize ?? el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return { layout: layoutFor(width), stacked: width < ISLAND_STACKED, compact: width < ISLAND_COMPACT };
}

/** UT-3: the one-row island also goes to two rows as soon as its row doesn't fit the space it has (between 560 and
 * ~800 px of Session the groups ran into each other and the divider lay over Send now). Measured on the island box
 * while the island is one row; the width it needed is kept, so it comes back to one row only once that width is there. */
export function useIslandOverflow(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [need, setNeed] = useState(0);
  const [space, setSpace] = useState(Number.POSITIVE_INFINITY);
  const stacked = enabled && need > 0 && space < need;
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || !enabled) return;
    const measure = () => {
      setSpace(box.clientWidth);
      if (stacked) return;
      const island = box.querySelector<HTMLElement>('[data-layout="inline"]');
      const row = island?.lastElementChild as HTMLElement | null | undefined;
      if (!island || !row || row.scrollWidth <= row.clientWidth + 1) return;
      setNeed(Math.ceil(row.scrollWidth + island.offsetWidth - row.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  });
  return stacked;
}
