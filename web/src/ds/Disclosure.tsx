/* Disclosure (G19, debrief.md §6): a header button that shows / hides a region. Debrief question cards (5 per
 * screen), "Show full answer", "Show a stronger answer"; later the Session transcript.
 * Anatomy: header <button aria-expanded aria-controls> with slots `leading` · `title` · `meta` (second line) ·
 * chevron at the end; region role="region" labelled by the header. Optional heading wrapper (`headingLevel`)
 * so card titles stay in the document outline (accordion pattern).
 * Motion (docs/motion.md 3.7 "Disclosure", D76): chevron rotates (base); the region grows open and folds shut (height
 * via grid rows 0fr ↔ 1fr, with opacity, --duration-base) so what is below slides instead of jumping; kept mounted by
 * usePresence until it has folded. Content is clipped only while it moves (focus rings stay whole once open).
 * Controlled (`open` + `onOpenChange`, for "Open all" and evidence-link jumps) or uncontrolled (`defaultOpen`). */
import { useEffect, useId, useState, type ReactNode, type TransitionEvent } from "react";
import { Icon } from "./icons";
import { durationMs, usePresence } from "./motion";
import s from "./Disclosure.module.css";

export interface DisclosureProps {
  title: ReactNode;
  /** Second line of the header: badges, durations ("2:20 · 1 follow-up"). */
  meta?: ReactNode;
  /** Before the title: a number disc, an icon. */
  leading?: ReactNode;
  children: ReactNode;
  /** `card` (default): a card whose header is the button · `plain`: a text-like toggle inside other content. */
  surface?: "card" | "plain";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  chevron?: "end" | "none";
  disabled?: boolean;
  /** Wrap the header button in h2–h4 (debrief question cards: 3). */
  headingLevel?: 2 | 3 | 4;
  /** Root element: `li` inside an <ol> of question cards. */
  as?: "div" | "li" | "section";
  /** Id of the header button (evidence links focus it). */
  id?: string;
  className?: string;
  /** User-test label on the header button (`data-track`, kebab-case, never user data). */
  track?: string;
}

export function Disclosure({
  title, meta, leading, children, surface = "card", open: openProp, defaultOpen = false, onOpenChange,
  chevron = "end", disabled, headingLevel, as: Root = "div", id, className, track,
}: DisclosureProps) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const auto = useId();
  const headerId = id ?? `${auto}h`;
  const regionId = `${auto}r`;
  const { mounted, leaving } = usePresence(open, "--duration-base");
  // Open and done growing: stop clipping. Without motion there is no transition to wait for.
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (!open) setSettled(false);
    else if (durationMs("--duration-base") <= 0) setSettled(true);
  }, [open]);
  const onGrown = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === "grid-template-rows" && open) setSettled(true);
  };

  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setOwn(next);
    onOpenChange?.(next);
  };

  const button = (
    <button
      id={headerId}
      type="button"
      className={s.header}
      aria-expanded={open}
      aria-controls={regionId}
      data-track={track}
      disabled={disabled}
      onClick={toggle}
    >
      {leading ? <span className={s.leading}>{leading}</span> : null}
      <span className={s.text}>
        <span className={s.title}>{title}</span>
        {meta ? <span className={s.meta}>{meta}</span> : null}
      </span>
      {chevron === "end" ? <span className={`${s.chevron} ${open ? s.chevronOpen : ""}`} aria-hidden="true"><Icon name="chevronDown" /></span> : null}
    </button>
  );
  const Heading = headingLevel ? (`h${headingLevel}` as const) : null;

  return (
    <Root
      className={`${s.root} ${s[surface]} ${open ? s.isOpen : ""} ${className ?? ""}`}
      data-review-id={`Disclosure/${surface}`}
    >
      {Heading ? <Heading className={s.heading}>{button}</Heading> : button}
      <div
        id={regionId}
        role="region"
        aria-labelledby={headerId}
        className={`${s.region} ${leaving ? s.folding : ""} ${settled && !leaving ? s.settled : ""}`}
        hidden={!mounted}
        onTransitionEnd={onGrown}
      >
        <div className={s.clip}>
          <div className={s.body}>{mounted ? children : null}</div>
        </div>
      </div>
    </Root>
  );
}
