/* ChatMessage (G22, ds/screens/_index.md §4.1, home.md §4): one message in Mike's setup chat.
 * - Mike: no bubble, plain text (`--text-md`, relaxed leading); a small "Mike" name on the first message of a turn.
 * - User: an end-aligned `--color-subtle` bubble (`--radius-lg`), max 80% of the log (88% when the log is narrow).
 * - `state`: `final`, `pending` (a TextShimmer line, only while real work runs: reading a file, opening a link),
 *   `error` (an alert icon before the text; no status colour, the words carry it), `interim` (the user's words still
 *   being recognised, Session D49: the bubble gets a thin --color-mic-live outline; the words update in place).
 * - Slots: `attachment` (a pasted job, a file) above the text, `actions` (quick replies, a link) under it.
 * - `onPress` (D71, the Debrief chat): the user's bubble is a toggle button (`aria-pressed`) that shows its breakdown;
 *   hover and pressed only deepen the fill, no outline.
 * Messages sit in a ChatLog (`role="log"`, polite), so new ones are announced without moving focus. ChatLog
 * `size="lg"` is the Session transcript (text-lg, md in a narrow log); `live={false}` drops the announcements where the
 * words are already heard (Mike's TTS, the user's own voice).
 * Motion (docs/motion.md 3.7 "Setup message"): `rise-in` `slow` when `animate`; quiet and reduced-motion rules apply. */
import type { ReactNode } from "react";
import { Icon } from "./icons";
import { TextShimmer } from "./TextShimmer";
import s from "./ChatMessage.module.css";

export interface ChatMessageProps {
  speaker: "mike" | "user";
  state?: "final" | "pending" | "error" | "interim";
  /** Speaker name shown above the message ("Mike"): first message of a turn only. */
  name?: string;
  /** Pending line ("Reading the job…"). */
  pendingLabel?: string;
  attachment?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Play the entrance (new message). Off for messages restored on load. */
  animate?: boolean;
  className?: string;
  reviewId?: string;
  /** The bubble is a button (user messages only). */
  onPress?: () => void;
  pressed?: boolean;
}

export function ChatMessage({
  speaker, state = "final", name, pendingLabel, attachment, actions, children, animate, className, reviewId, onPress, pressed,
}: ChatMessageProps) {
  const cls = [s.message, s[speaker], state === "interim" ? s.interim : "", animate ? "motion-rise" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div className={cls} data-review-id={reviewId ?? `ChatMessage/${speaker}-${state}`} data-state={state}>
      {name ? <span className={s.name}>{name}</span> : null}
      {attachment ? <div className={s.attachment}>{attachment}</div> : null}
      {state === "pending" ? (
        <TextShimmer as="p" size="md" status>{pendingLabel ?? children}</TextShimmer>
      ) : children && onPress && speaker === "user" ? (
        <button type="button" data-track="answer-bubble" className={`${s.bubble} ${s.press}`} aria-pressed={pressed ?? false} onClick={onPress}>
          <span className={s.body}>{children}</span>
        </button>
      ) : children ? (
        <div className={speaker === "user" ? s.bubble : s.text}>
          {state === "error" ? <span className={s.errorIcon}><Icon name="alert" size="sm" /></span> : null}
          <div className={s.body}>{children}</div>
        </div>
      ) : null}
      {actions ? <div className={s.actions}>{actions}</div> : null}
    </div>
  );
}

export interface ChatLogProps {
  /** Accessible name ("Setup with Mike"). */
  label: string;
  children: ReactNode;
  /** Text size: `md` (setup chat) or `lg` (the Session transcript; md when the log is narrow). */
  size?: "md" | "lg";
  /** Announce new messages (polite). Off where the words are already heard (the Session: Mike's voice, your own). */
  live?: boolean;
  className?: string;
}

/** The message list: `role="log"`, polite; adapts the bubble width to its own box (container query). */
export function ChatLog({ label, children, size = "md", live = true, className }: ChatLogProps) {
  return (
    <div role="log" aria-live={live ? "polite" : "off"} aria-label={label} className={`${s.log} ${size === "lg" ? s.lg : ""} ${className ?? ""}`} data-review-id={size === "lg" ? "ChatLog/lg" : "ChatLog"}>
      {children}
    </div>
  );
}
