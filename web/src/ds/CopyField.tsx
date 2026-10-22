import { useEffect, useId, useState } from "react";
import { IconButton } from "./Button";
import s from "./CopyField.module.css";

export interface CopyFieldProps {
  value: string;
  copyLabel: string;
  copiedLabel: string;
  /** Accessible name of the code block, e.g. "Command". */
  label?: string;
}

/** A one-line command with a copy button (clipboard API, falls back to selecting the text). */
export function CopyField({ value, copyLabel, copiedLabel, label }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  // QA-09: a valid, unique id (the value has spaces and slashes and can appear twice on one page).
  const codeId = `copy-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      const sel = window.getSelection();
      const node = document.getElementById(codeId);
      if (sel && node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };
  return (
    <div className={s.row}>
      {/* QA-09: the box scrolls sideways, so the keyboard must be able to reach it; role + name make the focus stop meaningful. */}
      <code id={codeId} className={s.code} tabIndex={0} role="group" aria-label={label ?? copyLabel}>{value}</code>
      <span aria-live="polite" className={s.done}>{copied ? copiedLabel : ""}</span>
      <IconButton icon={copied ? "check" : "copy"} label={copyLabel} size="sm" data-track="copy-command" onClick={() => void copy()} />
    </div>
  );
}
