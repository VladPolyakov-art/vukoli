/* Composer (G1, R6 Ollama / R2 ChatGPT, P3): one rounded input (--radius-lg) with everything inside it.
 * Slots, top to bottom: `attachment` (a ComposerAttachment card or a Skeleton row while loading) · the field
 * (a borderless textarea that grows 2 → `maxRows`) · toolbar (`toolbarStart` / `toolbarEnd`: outlined sm buttons)
 * + the round send button. Without a toolbar the send button sits inline, bottom-right of the field (chat row, R6).
 * Focus: the whole composer is the input: keyboard focus draws the ring on the box, never on the inner textarea
 * (review v1, D47a: an inner ring made the button look outside the input).
 * `surface: none` (v2): no border / shadow / radius / fill of its own: the composer sits inside the Session island.
 * `send.variant`: `action` = black / white (Session), `quiet` = outlined (Home, so Start stays the only primary: DS-6).
 * The send button appears with a short rise when it becomes visible (D6); a new `send.icon` fades in (D52: the Home
 * start button morphs mic → arrow once there is text, like the Gemini input). `send.title` = a tooltip other than the
 * label (the quick start's "General questions · Unseen mix · 5 questions"); `send.busy` = a spinner in place of the icon.
 * `onFiles` (D89): the composer also takes files: pasted (Cmd+V of a copied file) or dropped on it, with a drop
 * highlight while a file is over it. Without `onFiles` a file isn't taken here (the app-wide guard stops the browser
 * from opening it in place of the app).
 * `leading` (D90): a control on the left of the field in the one-line chat row (the + of the chat with Mike), so the
 * row reads [+] [text] [mic / send] like a messenger.
 * Narrow parents: the toolbar wraps and the
 * end group drops to its own line (container query on the composer). */
import {
  forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ClipboardEvent, type CSSProperties, type DragEvent,
  type InputEvent, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "./icons";
import { Spinner } from "./Spinner";
import s from "./Composer.module.css";

export interface ComposerSend {
  /** Accessible name and tooltip ("Send", "Add this job"). */
  label: string;
  icon?: IconName;
  variant?: "action" | "quiet";
  disabled?: boolean;
  /** Hide the button (Home shows it only when there is text). */
  hidden?: boolean;
  /** Tooltip, when it should say more than `label` (D52). Defaults to `label`. */
  title?: string;
  /** The action is running: a spinner replaces the icon, aria-busy (D52 quick start). */
  busy?: boolean;
  /** User-test label (`data-track`, kebab-case, never user data); read by tools/dashboard/tracker/track.js. */
  track?: string;
  onSend?: () => void;
}

export interface ComposerProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> {
  /** Accessible label of the field (visually hidden): "Your answer", "Paste a job description or a link". */
  label: string;
  attachment?: ReactNode;
  /** On the left of the field, in the chat row (no toolbar): the + (D90). */
  leading?: ReactNode;
  toolbarStart?: ReactNode;
  toolbarEnd?: ReactNode;
  send?: ComposerSend;
  /** Enter sends, Shift+Enter adds a line (Session text mode). Off by default (pasting a job keeps Enter). */
  submitOnEnter?: boolean;
  /** Visible rows when empty (default 2) and the most it grows to before scrolling (default 8). */
  minRows?: number;
  maxRows?: number;
  /** Line under the composer: shortcut hint ("Enter to send · Shift+Enter for a new line"). */
  hint?: ReactNode;
  /** Error under the composer (role="alert"). */
  error?: string;
  /** Loading: aria-busy on the composer (pair with a Skeleton row in `attachment`). */
  busy?: boolean;
  /** `own` (default): the composer draws its own box (border, radius, shadow). `none` (v2): no own surface, it
   * lives inside another one (the Session island in text mode); the keyboard ring stays on the field area. */
  surface?: "own" | "none";
  /** Files pasted into the field or dropped on the composer (D89). */
  onFiles?: (files: File[]) => void;
  className?: string;
}

/** A drag that carries files (not text or a link dragged from the page). */
export const carriesFiles = (e: { dataTransfer: DataTransfer | null }) => Boolean(e.dataTransfer?.types.includes("Files"));

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  {
    label, attachment, leading, toolbarStart, toolbarEnd, send, submitOnEnter, minRows = 2, maxRows = 8, hint, error, busy,
    surface = "own", onFiles, className, id, onKeyDown, onInput, onPaste, disabled, value, ...rest
  },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const field = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => field.current as HTMLTextAreaElement);

  // Auto-grow: CSS `field-sizing: content` where supported; otherwise measure scrollHeight (bounded by maxRows in CSS).
  useEffect(() => {
    if (field.current) grow(field.current);
  }, [value]);

  const sendVariant = send?.variant ?? "action";
  const canSend = Boolean(send && !send.hidden && !send.disabled && !disabled);
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !submitOnEnter) return;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend && !send?.busy) send?.onSend?.();
    }
  };
  const [dropping, setDropping] = useState(false);
  const takesFiles = Boolean(onFiles) && !disabled;
  const paste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    onPaste?.(e);
    const files = Array.from(e.clipboardData?.files ?? []);
    if (e.defaultPrevented || !takesFiles || !files.length) return;
    e.preventDefault();
    onFiles?.(files);
  };
  const dragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!takesFiles || !carriesFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropping(true);
  };
  const dragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
  };
  const drop = (e: DragEvent<HTMLDivElement>) => {
    setDropping(false);
    if (!takesFiles || !carriesFiles(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles?.(files);
  };
  const describedBy = [hint ? `${fieldId}-h` : "", error ? `${fieldId}-e` : ""].filter(Boolean).join(" ") || undefined;

  const sendIcon: IconName = send?.icon ?? (sendVariant === "quiet" ? "arrowRight" : "send");
  const sendButton = send && !send.hidden ? (
    <button
      type="button"
      className={`${s.send} ${s[sendVariant]} motion-rise-base`}
      aria-label={send.label}
      title={send.title ?? send.label}
      aria-busy={send.busy || undefined}
      data-track={send.track}
      disabled={send.disabled || disabled}
      onClick={send.busy ? undefined : send.onSend}
    >
      {send.busy ? <Spinner size="sm" /> : (
        <span key={sendIcon} className={s.sendIcon}><Icon name={sendIcon} /></span>
      )}
    </button>
  ) : null;
  const hasToolbar = Boolean(toolbarStart || toolbarEnd);

  return (
    <div className={`${s.root} ${className ?? ""}`} data-review-id={`Composer/${sendVariant}${surface === "none" ? "-bare" : ""}`}>
      <div
        className={`${s.box} ${surface === "none" ? s.bare : ""} ${disabled ? s.disabled : ""} ${error ? s.invalid : ""} ${dropping ? s.dropping : ""}`}
        aria-busy={busy || undefined}
        onDragEnter={takesFiles ? dragOver : undefined}
        onDragOver={takesFiles ? dragOver : undefined}
        onDragLeave={takesFiles ? dragLeave : undefined}
        onDrop={takesFiles ? drop : undefined}
      >
        {attachment ? <div className={s.attachment}>{attachment}</div> : null}
        <label htmlFor={fieldId} className="visually-hidden">{label}</label>
        <div className={s.row}>
          {leading && !hasToolbar ? <div className={s.leading}>{leading}</div> : null}
          <textarea
            ref={field}
            id={fieldId}
            className={s.field}
            rows={minRows}
            style={{ "--min-rows": minRows, "--max-rows": maxRows } as CSSProperties}
            disabled={disabled}
            value={value}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onKeyDown={keyDown}
            onPaste={paste}
            onInput={(e: InputEvent<HTMLTextAreaElement>) => {
              grow(e.currentTarget);
              onInput?.(e);
            }}
            {...rest}
          />
          {hasToolbar ? null : sendButton}
        </div>
        {hasToolbar ? (
          <div className={s.toolbar}>
            <div className={s.start}>{toolbarStart}</div>
            <div className={s.end}>
              {toolbarEnd}
              {sendButton}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p id={`${fieldId}-e`} className={s.error} role="alert"><Icon name="alert" size="sm" />{error}</p> : null}
      {hint ? <p id={`${fieldId}-h`} className={s.hint}>{hint}</p> : null}
    </div>
  );
});

export interface ComposerAttachmentProps {
  icon?: IconName;
  /** "Kestrel Pay" (2-line clamp, full text in the tooltip). */
  title: string;
  /** "Senior Product Designer · Added Oct 18" (2-line clamp). */
  meta?: string;
  /** One-line preview of the content (clamped). */
  preview?: string;
  /** Status line: "12 questions from this job" or a TextShimmer ("Preparing questions…"). */
  status?: ReactNode;
  /** IconButtons at the end (options menu, remove). */
  actions?: ReactNode;
}

/** The attached job card inside the composer (`attachment` slot). */
export function ComposerAttachment({ icon = "briefcase", title, meta, preview, status, actions }: ComposerAttachmentProps) {
  return (
    <div className={s.card} data-review-id="Composer/attachment">
      <span className={s.tile}><Icon name={icon} /></span>
      <span className={s.cardText}>
        <span className={s.cardTitle} title={title}>{title}</span>
        {meta ? <span className={s.cardMeta} title={meta}>{meta}</span> : null}
        {preview ? <span className={s.cardPreview}>{preview}</span> : null}
        {status ? <span className={s.cardStatus}>{status}</span> : null}
      </span>
      {actions ? <span className={s.cardActions}>{actions}</span> : null}
    </div>
  );
}

/** Fallback auto-grow for browsers without `field-sizing`: the height follows the content, CSS caps it at max rows. */
function grow(el: HTMLTextAreaElement) {
  if (supportsFieldSizing()) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

let fieldSizing: boolean | undefined;
function supportsFieldSizing() {
  if (fieldSizing === undefined) {
    fieldSizing = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");
  }
  return fieldSizing;
}
