/* InlineRename (G16 sub-part, components.md §4; debrief.md §3.1 item 4 and §4): rename a title in place.
 * Input (label hidden, value selected), counter "37 / 80" (tertiary), IconButton check "Save title" + x "Cancel".
 * Enter saves, Esc cancels; an empty title shows the error and keeps the field (US-21 AC2). Used by ListRow
 * (`size="md"`) and the Debrief H1 (`size="lg"`). The swap in/out of the title is the caller's `Swap` (`fast`). */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { t } from "../i18n";
import { IconButton } from "./Button";
import { Input } from "./Field";
import s from "./InlineRename.module.css";

export const RENAME_MAX = 80;

export interface InlineRenameProps {
  value: string;
  onSave: (title: string) => void;
  onCancel: () => void;
  size?: "md" | "lg";
  /** Accessible name of the field (default "Session title"). */
  label?: string;
  max?: number;
  /** Focus and select the text on mount (default true; stories pass false so the page does not jump). */
  autoFocus?: boolean;
  /** Show the empty-title error from the start (stories, review). */
  initialError?: boolean;
  className?: string;
}

export function InlineRename({
  value,
  onSave,
  onCancel,
  size = "md",
  label = t("rename.label"),
  max = RENAME_MAX,
  autoFocus = true,
  initialError = false,
  className,
}: InlineRenameProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(initialError);
  const input = useRef<HTMLInputElement>(null);
  const counterId = useId();

  useEffect(() => {
    if (!autoFocus) return;
    input.current?.focus();
    input.current?.select();
  }, [autoFocus]);

  const save = () => {
    const title = draft.trim();
    if (!title) {
      setError(true);
      input.current?.focus();
      return;
    }
    onSave(title);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className={`${s.rename} ${size === "lg" ? s.lg : ""} ${className ?? ""}`} data-review-id={`InlineRename/${size}`}>
      <div className={s.field}>
        <Input
          ref={input}
          label={label}
          hideLabel
          data-track="rename-input"
          value={draft}
          maxLength={max}
          className={s.input}
          error={error ? t("rename.empty") : undefined}
          aria-describedby={error ? undefined : counterId}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error && e.target.value.trim()) setError(false);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <span id={counterId} className={s.counter} aria-live="off">
        {t("rename.counter", { n: draft.length, max })}
      </span>
      <div className={s.actions}>
        <IconButton icon="check" label={t("rename.save")} size="sm" data-track="rename-save" onClick={save} />
        <IconButton icon="x" label={t("common.cancel")} size="sm" data-track="rename-cancel" onClick={onCancel} />
      </div>
    </div>
  );
}
