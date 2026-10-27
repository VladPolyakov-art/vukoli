/* Small helpers of the interview Debrief view (ds/screens/debrief.md, layout "D", 2026-10-27), shared by the summary,
 * the plan, the skills card and the question viewer. Pure: no state. */
import { Badge } from "../../../ds";
import { t } from "../../../i18n";
import type { ScoreKey } from "../../../lib/types";
import type { Layer, ScoreRowModel, WeakSpotModel } from "../types";

/** A layer as a small tag (icon + name on the layer's tint, debrief only; CONTRACT §2.6). */
export function LayerTag({ layer }: { layer: Layer }) {
  return <Badge tone={layer} tinted icon={layer}>{t(`feedback.layer.${layer}`)}</Badge>;
}

export const rowLabel = (key: ScoreKey) => t(`debrief.score.row.${key}`);

export const questionHeadingId = (uid: string, n: number) => `${uid}q${n}`;

/** Scored rows, weakest first; ties keep the scorecard's order (the same rule as the D99 gap, rubric §9.4). */
export function weakestFirst(rows: readonly ScoreRowModel[]): (ScoreRowModel & { score: number })[] {
  const order = rows.map((r) => r.key);
  return rows
    .filter((r): r is ScoreRowModel & { score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || order.indexOf(a.key) - order.indexOf(b.key));
}

/** The weak spots in the configured layer order (GR8); the plan has the same order (rubric §9.3). */
export function orderedSpots(spots: readonly WeakSpotModel[], seq: readonly Layer[]): WeakSpotModel[] {
  return [...spots].sort((a, b) => seq.indexOf(a.layer) - seq.indexOf(b.layer));
}

/** The plan in the configured layer order too (rubric §9.3 builds it in that order; the fixtures are content-first). */
export function orderedPlan<T extends { layer: Layer }>(plan: readonly T[] | undefined, seq: readonly Layer[]): T[] {
  return [...(plan ?? [])].sort((a, b) => seq.indexOf(a.layer) - seq.indexOf(b.layer));
}

/** The scorecard rows that lost points in question `n`. */
export function rowsLostIn(rows: readonly ScoreRowModel[] | undefined, n: number): ScoreKey[] {
  return (rows ?? []).filter((r) => r.score !== null && r.lost.includes(n)).map((r) => r.key);
}

/** The one final score: the plain average of the scored rows (rubric §9.1), one decimal. "Not asked" rows are left
 * out; no scored row, no score. 🟡 Derived in the client: not in the server's rubric yet. */
export function averageScore(rows: readonly ScoreRowModel[] | undefined): { value: string; n: number } | null {
  const scored = (rows ?? []).flatMap((r) => (r.score !== null ? [r.score] : []));
  if (!scored.length) return null;
  const mean = scored.reduce((a, b) => a + b, 0) / scored.length;
  return { value: (Math.round(mean * 10) / 10).toFixed(1), n: scored.length };
}
