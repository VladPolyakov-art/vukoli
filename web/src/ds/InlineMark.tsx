/* Inline mark (G20): a fragment marked inside the user's own sentence (P8 "a fix, not an error", R11 pattern).
 * - `fix`: the corrected words in "Say" — <mark> on --color-mark-fix + semibold. Never green, never a strikethrough.
 * - `heard`: the words the recogniser heard that the fix changes ("Heard as") — neutral grey dotted underline
 *   (--color-mark-heard). Not red, not struck through: it may simply be what the user said.
 * - `unsure`: a low-confidence word (the engine gave confidence, US-18 AC4) — grey dashed underline + an optional
 *   visible hint "(may be misheard)". Dashed vs dotted is the non-colour cue between the two neutral marks.
 * `srLabel` adds visually hidden context before the fragment for screen readers ("corrected:", "heard as:"). */
import type { ReactNode } from "react";
import s from "./InlineMark.module.css";

export interface InlineMarkProps {
  kind: "fix" | "heard" | "unsure";
  children: ReactNode;
  /** Visible hint after an `unsure` word, e.g. "(may be misheard)". */
  hint?: string;
  /** Visually hidden prefix for screen readers. */
  srLabel?: string;
}

export function InlineMark({ kind, children, hint, srLabel }: InlineMarkProps) {
  const sr = srLabel ? <span className="visually-hidden">{srLabel} </span> : null;
  if (kind === "fix") {
    return <mark className={s.fix} data-review-id="InlineMark/fix">{sr}{children}</mark>;
  }
  return (
    <>
      <span className={s[kind]} data-review-id={`InlineMark/${kind}`}>{sr}{children}</span>
      {kind === "unsure" && hint ? <span className={s.hint}> {hint}</span> : null}
    </>
  );
}
