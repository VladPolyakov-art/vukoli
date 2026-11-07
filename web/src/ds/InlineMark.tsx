/* Inline mark (G20, D110): a fragment marked inside the user's own sentence, as a rectangle behind the text (like <mark>).
 * - `heard`: the words the recogniser heard / the user said wrongly ("Heard as") — red rectangle (--color-bg-mark-wrong).
 * - `fix`: the corrected words, the right answer ("Say") — <mark> on a green rectangle (--color-bg-mark-right) + semibold.
 *   No underline and no strikethrough on either (D110 replaces P8 "never red / green / struck through").
 * - `unsure`: a low-confidence word (the engine gave confidence, US-18 AC4) — stays neutral: grey dashed underline + an
 *   optional visible hint "(may be misheard)". It is not the user's error, so it is not red.
 * Colour is not the only cue: `srLabel` adds visually hidden context before the fragment for screen readers
 * ("heard as:", "corrected:"); in the debrief the Heard as / Say labels are visible too. */
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
