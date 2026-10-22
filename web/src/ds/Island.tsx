/* Island (G21, ds/screens/_index.md §4.1, session.md §V2): the one floating control surface of the Session.
 * It replaces the v1 top bar + dock: status, voice, tools and exit live in one raised pill at the bottom of the stage.
 * - `shape`: `pill` (voice) or `box` (text mode: the `lead` row holds a Composer with `surface="none"`, a hairline
 *   separates it from the controls).
 * - `layout`: `inline` = one row; `stacked` (<560, phones) = two rows, each group says which `row` it goes in.
 * - Groups are separated by a hairline divider (`--color-border-subtle`, `--control-h-sm` high) inside a row.
 * - The set of controls is fixed: a control that can't act now is disabled, never hidden (the screen decides).
 * The island never positions itself: the screen places it (sticky bottom-centre) and plays the motion
 * (D5 `dock-in` in, `soft-out` out; docs/motion.md 3.7 "Island text-mode morph" via `morph`). */
import { Fragment, type ReactNode } from "react";
import s from "./Island.module.css";

export interface IslandGroup {
  id: string;
  /** Accessible name of the group ("Status", "Voice", "Tools", "Exit"). */
  label?: string;
  children: ReactNode;
  /** `stacked` layout only: which row the group sits in (default 1). */
  row?: 1 | 2;
  /** The group takes the free space of its row (the main action on phones, the spacer before End). */
  grow?: boolean;
  /** Anchor for review comments (`Session/Status`). */
  reviewId?: string;
}

export interface IslandProps {
  /** Accessible name of the whole island ("Session controls"). */
  label: string;
  shape?: "pill" | "box";
  layout?: "inline" | "stacked";
  /** Box only: the row above the controls (Composer `surface="none"`). */
  lead?: ReactNode;
  groups: IslandGroup[];
  /** Play the pill → box grow once (keyed by the screen on the mode change). */
  morph?: boolean;
  className?: string;
  reviewId?: string;
}

export function Island({ label, shape = "pill", layout = "inline", lead, groups, morph, className, reviewId = "Island" }: IslandProps) {
  const rows: IslandGroup[][] = layout === "stacked"
    ? [groups.filter((g) => (g.row ?? 1) === 1), groups.filter((g) => g.row === 2)].filter((r) => r.length)
    : [groups];
  const cls = [s.island, s[shape], layout === "stacked" ? s.stacked : "", morph ? s.morph : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div role="group" aria-label={label} className={cls} data-review-id={reviewId} data-shape={shape} data-layout={layout}>
      {lead ? <div className={s.lead}>{lead}</div> : null}
      {lead ? <div className={s.rule} aria-hidden="true" /> : null}
      {rows.map((row, ri) => (
        <div key={ri} className={s.row}>
          {row.map((g, i) => (
            <Fragment key={g.id}>
              {i > 0 ? <span className={s.divider} aria-hidden="true" /> : null}
              <div
                role={g.label ? "group" : undefined}
                aria-label={g.label}
                className={`${s.group} ${g.grow ? s.grow : ""}`}
                data-review-id={g.reviewId}
                data-review-section={g.reviewId ? g.reviewId.replace("/", " · ") : undefined}
                data-comment-target={g.reviewId ? true : undefined}
              >
                {g.children}
              </div>
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
