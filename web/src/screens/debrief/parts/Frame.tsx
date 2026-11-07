/* A framed block of the debrief page (D109, 2026-11-07): one meaning = one white island (DS `Card`) with a visible title,
 * an optional one-line hint under it and an optional aside on the title row (a score, a primary action). The card's own
 * `--note-fill` fallback turns plaques and rows inside it grey, so nothing becomes a frame inside a frame. */
import type { HTMLAttributes, ReactNode, Ref } from "react";
import { Card } from "../../../ds";
import s from "./frame.module.css";

export interface FrameProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  id: string;
  title: ReactNode;
  /** One line under the title (tertiary). */
  hint?: ReactNode;
  /** Right end of the title row. */
  aside?: ReactNode;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

export function Frame({ id, title, hint, aside, children, className, ...rest }: FrameProps) {
  return (
    <Card as="section" padding="sm" className={className} aria-labelledby={id} {...rest}>
      <div className={s.inner}>
        <header className={s.head}>
          <div className={s.titles}>
            <h2 id={id} className={s.title}>{title}</h2>
            {hint ? <p className={s.hint}>{hint}</p> : null}
          </div>
          {aside ? <div className={s.aside}>{aside}</div> : null}
        </header>
        {children}
      </div>
    </Card>
  );
}
