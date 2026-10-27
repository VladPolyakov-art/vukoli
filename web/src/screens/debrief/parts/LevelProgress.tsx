/* "Your level" as progress toward Ready (layout D, look "blocks", owner's pick 2026-10-27). The three steps stay named
 * (Not ready yet › Getting there › Ready) and below them is one cell per skill that counts for the next step, the ones
 * already there filled. Not a control: no hover, no pointer. The fill animates once on load (the cells in turn,
 * `--duration-base` `--ease-enter`; 0 under reduced motion, global.css). One sentence for screen readers.
 * 🟡 The position between two steps is derived from the scorecard (`levelProgress`), the same rule as the step itself. */
import { t } from "../../../i18n";
import type { ScaleStep, ScoreRowModel } from "../types";
import { CONTENT_ROWS } from "../verdictStep";
import s from "./levelProgress.module.css";

const LEVELS = ["debrief.scale.notReady", "debrief.scale.gettingThere", "debrief.scale.ready"] as const;

export interface LevelProgressData {
  step: ScaleStep;
  /** Skills already past the next step's bar, of the skills that count for it. */
  done: number;
  total: number;
}

/** Where the user stands between two steps, from the same rule as the step (D99, verdictStep.ts). Not ready yet → Getting
 * there: the answer rows (structure, your part, result, on the question) at 3/5 or more. Getting there → Ready: every
 * shown row at 4/5 or more. `total − done` is exactly the verdict's `gap`. No scored row: nothing to show. */
export function levelProgress(step: ScaleStep, rows: readonly Pick<ScoreRowModel, "key" | "score">[] | undefined): LevelProgressData | null {
  const shown = (rows ?? []).filter((r): r is { key: ScoreRowModel["key"]; score: number } => typeof r.score === "number");
  if (!shown.length) return null;
  if (step >= 2) return { step: 2, done: shown.length, total: shown.length };
  if (step === 1) return { step: 1, done: shown.filter((r) => r.score >= 4).length, total: shown.length };
  const pool = shown.filter((r) => CONTENT_ROWS.includes(r.key));
  return { step: 0, done: pool.filter((r) => r.score >= 3).length, total: pool.length };
}

function caption(data: LevelProgressData): string {
  const vars = { done: data.done, total: data.total };
  return t(data.step >= 2 ? "debrief.level.captionReady" : data.step === 1 ? "debrief.level.captionGettingThere" : "debrief.level.captionNotReady", vars);
}

export function LevelProgress({ data }: { data: LevelProgressData }) {
  const name = t(LEVELS[data.step]);
  const nextName = data.step < 2 ? t(LEVELS[data.step + 1]!) : null;
  const text = caption(data);
  const toGo = nextName ? t("debrief.level.toGo", { n: data.total - data.done, next: nextName }) : null;
  const sr = `${t("debrief.level.sr", { name, n: data.step + 1 })} ${text}${toGo ? `, ${toGo}` : ""}.`;
  const cells = Array.from({ length: data.total }, (_, i) => i < data.done);
  return (
    <div className={s.level} role="img" aria-label={sr} data-review-id="Debrief/Level">
      <div className={s.head} aria-hidden="true">
        <span className={s.label}>{t("debrief.level.label")}</span>
        <ol className={s.crumbs}>
          {LEVELS.map((key, i) => (
            <li key={key} className={`${s.stop} ${i < data.step ? s.passed : ""} ${i === data.step ? s.here : ""}`}>{t(key)}</li>
          ))}
        </ol>
      </div>
      <div className={s.cells} aria-hidden="true">
        {cells.map((on, i) => (
          <span key={i} className={on ? `${s.cell} ${s.cellOn}` : s.cell} style={on ? { animationDelay: `calc(var(--duration-stagger) * ${i})` } : undefined} />
        ))}
      </div>
      <p className={s.caption} aria-hidden="true">
        <span className={s.strong}>{text}</span>
        {toGo ? <span> · {toGo}</span> : null}
      </p>
    </div>
  );
}
