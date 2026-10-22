/* List row (G16, components.md §4; debrief.md §4, home.md §3.1): one session in History, Trash and the rail "Recent".
 * `density="default"`: <li>, 40px lead disc with the track icon, title (1 line + ellipsis + Tooltip when cut; 2 lines
 * when the page column is narrow), meta line, result text (never coloured), actions. The whole row is the title link
 * (stretched ::after); actions sit above it and show on hover / focus-within (always on touch). Under 560px of page
 * column, `actions` give way to `compactActions` (one `more` button → Menu).
 * `density="compact"`: the rail row, icon sm + one-line title, `--control-h-sm` (44px on touch).
 * `rename`: the title swaps for InlineRename (size md). Motion (docs/motion.md 3.7, N10): `enterIndex` → `row-in`
 * with a 40ms stagger, `leaving` → `row-out`. */
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { InlineRename, type InlineRenameProps } from "./InlineRename";
import { PlainLink, type LinkComponent } from "./NavRow";
import { Tooltip } from "./Tooltip";
import s from "./ListRow.module.css";

export interface ListRowProps {
  title: string;
  href: string;
  icon?: IconName;
  density?: "default" | "compact";
  /** One quiet line right under the title (default density), e.g. the first question asked (D69). Truncates. */
  sub?: ReactNode;
  /** Meta line under the title (default density): badges, round, date, length. */
  meta?: ReactNode;
  /** Result text on the right: verdict word, "5 corrections". */
  result?: ReactNode;
  /** Row actions at wide / medium page width (IconButtons). */
  actions?: ReactNode;
  /** Row actions under 560px of page column (one `more` IconButton opening a Menu). */
  compactActions?: ReactNode;
  /** The row is the page being shown (compact rows in the rail). */
  current?: boolean;
  /** Renaming in place: the title becomes InlineRename. */
  rename?: Omit<InlineRenameProps, "size">;
  /** Enter motion on first load: the row's index in the list (stagger 40ms each). */
  enterIndex?: number;
  /** Delete motion: plays `row-out`; the caller removes the row after `--duration-exit`. */
  leaving?: boolean;
  linkAs?: LinkComponent;
  /** Force the truncation tooltip open (review states). */
  tooltipOpen?: boolean;
  className?: string;
  /** User-test label on the row's link (`data-track`, kebab-case, never the title: titles hold company names). */
  track?: string;
}

export function ListRow({
  title,
  href,
  icon = "briefcase",
  density = "default",
  sub,
  meta,
  result,
  actions,
  compactActions,
  current,
  rename,
  enterIndex,
  leaving,
  linkAs: LinkAs = PlainLink,
  tooltipOpen,
  className,
  track,
}: ListRowProps) {
  const compact = density === "compact";
  const motion = leaving ? "motion-row-out" : enterIndex !== undefined ? "motion-row" : "";
  // Stagger: half of --duration-stagger (40ms) per row (docs/motion.md 3.7 "Nav / list rows").
  const style: CSSProperties | undefined =
    enterIndex !== undefined && !leaving ? { animationDelay: `calc(var(--duration-stagger) / 2 * ${enterIndex})` } : undefined;
  const cls = [s.row, compact ? s.compact : s.default, rename ? s.renaming : "", motion, className ?? ""].filter(Boolean).join(" ");
  const state = rename ? "renaming" : current ? "current" : "default";

  if (rename) {
    return (
      <li className={cls} style={style} data-review-id={`ListRow/${density}/${state}`}>
        {compact ? null : <Lead icon={icon} />}
        <InlineRename {...rename} size="md" />
      </li>
    );
  }

  if (compact) {
    return (
      <li className={cls} style={style} data-review-id={`ListRow/compact/${state}`}>
        <Tooltip content={title} onlyWhenTruncated block placement="bottom-start" open={tooltipOpen} inline={tooltipOpen}>
          <LinkAs href={href} className={s.compactLink} aria-current={current ? "page" : undefined} data-track={track}>
            <Icon name={icon} size="sm" />
            <span className={s.compactTitle} data-truncate="">{title}</span>
          </LinkAs>
        </Tooltip>
      </li>
    );
  }

  return (
    <li className={cls} style={style} data-review-id={`ListRow/default/${state}`}>
      <Lead icon={icon} />
      <div className={s.body}>
        <Tooltip content={title} onlyWhenTruncated block placement="top-start" open={tooltipOpen} inline={tooltipOpen}>
          <LinkAs href={href} className={s.link} aria-current={current ? "page" : undefined} data-track={track}>
            <span className={s.title} data-truncate="">{title}</span>
          </LinkAs>
        </Tooltip>
        {sub ? <span className={s.sub}>{sub}</span> : null}
        {meta ? <div className={s.meta}>{meta}</div> : null}
      </div>
      {result ? <span className={s.result}>{result}</span> : null}
      {actions ? <div className={s.actions}>{actions}</div> : null}
      {compactActions ? <div className={s.compactActions}>{compactActions}</div> : null}
    </li>
  );
}

function Lead({ icon }: { icon: IconName }) {
  return (
    <span className={s.lead} aria-hidden="true">
      <Icon name={icon} />
    </span>
  );
}

/** The list around rows: a plain <ul> with the row rhythm (`--space-1` default, none compact). */
export function ListRows({ children, density = "default", label, className }: { children: ReactNode; density?: "default" | "compact"; label?: string; className?: string }) {
  return (
    <ul className={`${s.list} ${density === "compact" ? s.listCompact : ""} ${className ?? ""}`} aria-label={label}>
      {children}
    </ul>
  );
}
