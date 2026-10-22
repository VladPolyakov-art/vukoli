import { useId, type ReactNode } from "react";
import s from "./SettingRow.module.css";

export interface SettingRowProps {
  /** The setting's name. The control keeps its own accessible name (`hideLabel`), so this text is not a <label>. */
  label: ReactNode;
  description?: ReactNode;
  /** The control: a toggle, select, segmented control or button(s). */
  children: ReactNode;
  /** `inline` (default): text left, control right. `stack`: the control under the text, full width (CV text, a path). */
  layout?: "inline" | "stack";
  /** Anchor for settings search and deep links (`/settings/voice#voice-speed`). */
  id?: string;
  className?: string;
}

/** One settings row (owner, D76): name and an optional description on the left, the control on the right, the same
 * for every kind of control. Rows in a list are split by a hairline; on a narrow container the control drops under the
 * text. */
export function SettingRow({ label, description, children, layout = "inline", id, className }: SettingRowProps) {
  return (
    <div id={id} className={`${s.row} ${layout === "stack" ? s.stack : ""} ${className ?? ""}`} data-setting-row="">
      <div className={s.text}>
        <span className={s.label}>{label}</span>
        {description ? <span className={s.desc}>{description}</span> : null}
      </div>
      <div className={s.control}>{children}</div>
    </div>
  );
}

export interface SettingGroupProps {
  title: ReactNode;
  /** One line under the title. */
  description?: ReactNode;
  /** Id of the heading (deep links and `aria-labelledby`); generated when left out. */
  id?: string;
  /** Right of the title, e.g. a "Check again" button. */
  action?: ReactNode;
  /** Usually SettingRows; anything else (a Callout) sits in the box with the same side padding. */
  children: ReactNode;
  /** No side padding in the box: a table or list that draws its own cells edge to edge. */
  flush?: boolean;
  /** Level of the title: 3 under a section heading (Settings), 2 straight under the page's h1 (Setup steps). */
  headingLevel?: 2 | 3;
  /** The title is only for screen readers: the box already says what it is (13b, Setup: no label repeating the row). */
  hideTitle?: boolean;
  className?: string;
}

/** A titled group of setting rows (D78): the title above, the rows in one rounded box with hairlines between them,
 * so where one group ends and the next begins is plain to see. */
export function SettingGroup({ title, description, id, action, children, flush, headingLevel = 3, hideTitle, className }: SettingGroupProps) {
  const auto = useId();
  const headingId = id ?? auto;
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={`${s.groupSection} ${className ?? ""}`} aria-labelledby={headingId}>
      {hideTitle ? <H id={headingId} className="visually-hidden">{title}</H> : null}
      {hideTitle && !description && !action ? null : (
        <div className={s.groupHead}>
          <div className={s.groupHeadText}>
            {hideTitle ? null : <H id={headingId} className={s.groupTitle}>{title}</H>}
            {description ? <p className={s.groupDesc}>{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className={`${s.group} ${flush ? s.flush : ""}`}>{children}</div>
    </section>
  );
}
