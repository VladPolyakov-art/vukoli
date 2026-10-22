/* Text shimmer (G13, docs/motion.md 3.5 L4 + 3.7): a grey gradient clipped to the text for "preparing…" lines
 * ("One moment…", "Thinking", "Preparing feedback for question 2…", "Reading the file…").
 * Wraps the single global `.shimmer-text` class (global.css), so the keyframe and the reduced-motion / quiet-mode
 * rules stay in one place: paused while the user speaks ([data-motion-quiet]), plain secondary text under
 * reduced motion. `status` makes it a polite live region with aria-busy (a waiting line that matters). */
import type { ReactNode } from "react";
import s from "./TextShimmer.module.css";

export interface TextShimmerProps {
  children: ReactNode;
  /** `span` (default, inline) or `p` (its own line). */
  as?: "span" | "p";
  /** false = the same text, static secondary (e.g. the wait is over but the line stays). Default true. */
  active?: boolean;
  /** Announce politely: role="status" + aria-busy while active. */
  status?: boolean;
  /** Text size: `sm` (14, default) or `md` (16). */
  size?: "sm" | "md";
  className?: string;
}

export function TextShimmer({ children, as: Tag = "span", active = true, status, size = "sm", className }: TextShimmerProps) {
  const cls = [s.text, s[size], active ? "shimmer-text" : s.still, className ?? ""].filter(Boolean).join(" ");
  return (
    <Tag
      className={cls}
      role={status ? "status" : undefined}
      aria-busy={status && active ? true : undefined}
      data-review-id={`TextShimmer/${active ? "active" : "still"}`}
    >
      {children}
    </Tag>
  );
}
