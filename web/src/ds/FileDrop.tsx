/* File drop zone (G9): drop a file or browse. SetupProfile CV, VacancyEditor "File" tab.
 * The privacy line comes first, above the zone (GR7, US-09 AC5): "The file stays on this computer."
 * States: empty · drag-over (border + fill, fast) · reading (text shimmer) · chosen (file row + Remove) ·
 * error (Callout error, role="alert", with the caller's next action, e.g. "Switch to Paste").
 * D78: a chosen file can be replaced — a "Replace" button (with `replaceLabel`) or a new file dropped on its row.
 * D79: `multiple` takes several files at once (`onFiles`); a list of files is FileRows under an always-empty zone.
 * The zone itself is not a button (no nested controls): "browse" is a link-style Button that opens the native
 * picker, so keyboard and screen-reader users get the same path. Validation (type, size) is the caller's. */
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Button, IconButton } from "./Button";
import { Callout } from "./Callout";
import { Icon } from "./icons";
import { TextShimmer } from "./TextShimmer";
import s from "./FileDrop.module.css";

export interface FileDropProps {
  /** Accessible name of the zone ("Job description file"). */
  label: string;
  /** Privacy line shown above the zone. */
  privacy?: ReactNode;
  /** "Drop a file here or" */
  prompt: string;
  /** "browse" */
  browseLabel: string;
  /** "PDF, DOCX, TXT, MD or HTML · up to 5 MB" */
  hint?: ReactNode;
  accept?: string;
  state?: "empty" | "reading" | "chosen" | "error";
  /** Chosen / reading file: name and a size line ("184 KB"). */
  file?: { name: string; size?: string };
  /** "Reading the file…" */
  readingLabel?: string;
  /** "Remove file" (the Remove button shows only with both `removeLabel` and `onRemove`). */
  removeLabel?: string;
  /** "Replace": a button on the chosen file's row that picks another file (D78). */
  replaceLabel?: string;
  error?: { title?: string; body: ReactNode; action?: ReactNode };
  onFile?: (file: File) => void;
  /** With `multiple`: every dropped or picked file (D79). */
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** D80: one low row (icon left, prompt and hint in a line) under a list of files, instead of the tall zone. */
  compact?: boolean;
  className?: string;
}

export function FileDrop({
  label, privacy, prompt, browseLabel, hint, accept, state = "empty", file, readingLabel, removeLabel, replaceLabel,
  error, onFile, multiple, onFiles, onRemove, disabled, compact, className,
}: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const id = useId();

  const take = (files: FileList | null | undefined) => {
    if (!files?.length || disabled) return;
    if (multiple) onFiles?.(Array.from(files));
    else if (files[0]) onFile?.(files[0]);
  };
  const onDragOver = (e: DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!over) setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };

  const showZone = state === "empty" || state === "error";
  return (
    <div className={`${s.root} ${className ?? ""}`} data-review-id={`FileDrop/${state}`}>
      {privacy ? <p className={s.privacy}><Icon name="lock" size="sm" />{privacy}</p> : null}
      {showZone ? (
        <div
          role="group"
          aria-labelledby={`${id}p`}
          aria-describedby={hint ? `${id}h` : undefined}
          className={`${s.zone} ${compact ? s.compact : ""} ${over ? s.over : ""} ${disabled ? s.disabled : ""}`}
          onDragEnter={onDragOver}
          onDragOver={onDragOver}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <span className={s.icon}><Icon name="upload" size={compact ? "md" : "lg"} /></span>
          <p id={`${id}p`} className={s.prompt}>
            <span className="visually-hidden">{label}. </span>
            {prompt}{" "}
            <Button variant="link" data-track="file-browse" onClick={() => input.current?.click()} disabled={disabled}>{browseLabel}</Button>
          </p>
          {hint ? <p id={`${id}h`} className={s.hint}>{hint}</p> : null}
        </div>
      ) : (
        <FileRow
          name={file?.name ?? ""}
          meta={file?.size}
          reading={state === "reading"}
          readingLabel={readingLabel}
          accept={accept}
          replaceLabel={replaceLabel}
          onReplace={onFile}
          removeLabel={removeLabel}
          onRemove={onRemove}
          disabled={disabled}
        />
      )}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(e) => {
          take(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
      {state === "error" && error ? (
        <div className="motion-fade">
          <Callout tone="error" live="alert" title={error.title} actions={error.action}>{error.body}</Callout>
        </div>
      ) : null}
    </div>
  );
}

export interface FileRowProps {
  name: string;
  /** Second line: a size or "Updated …". */
  meta?: ReactNode;
  /** Reading the file: the second line shimmers with `readingLabel`. */
  reading?: boolean;
  readingLabel?: string;
  accept?: string;
  /** "Replace": picks another file (or one dropped on the row) for this one. */
  replaceLabel?: string;
  /** Accessible name of Replace when several rows show it ("Replace cv.pdf"). */
  replaceName?: string;
  onReplace?: (file: File) => void;
  removeLabel?: string;
  onRemove?: () => void;
  disabled?: boolean;
}

/** One chosen file: icon, name, a second line, Replace and Remove (D78, D79: also one row of a list of files). */
export function FileRow({ name, meta, reading, readingLabel, accept, replaceLabel, replaceName, onReplace, removeLabel, onRemove, disabled }: FileRowProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const canReplace = Boolean(onReplace) && !reading && !disabled;
  const onDragOver = (e: DragEvent) => {
    if (!canReplace) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!over) setOver(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && canReplace) onReplace?.(f);
  };
  return (
    <div className={`${s.file} ${over ? s.over : ""} motion-fade`} onDragEnter={onDragOver} onDragOver={onDragOver}
      onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <span className={s.fileIcon}><Icon name="file" /></span>
      <span className={s.fileText}>
        <span className={s.fileName} title={name}>{name}</span>
        {reading ? <TextShimmer status>{readingLabel}</TextShimmer> : meta ? <span className={s.fileSize}>{meta}</span> : null}
      </span>
      {!reading && replaceLabel && onReplace ? (
        <>
          <Button size="sm" aria-label={replaceName} data-track="file-replace" onClick={() => input.current?.click()} disabled={disabled}>{replaceLabel}</Button>
          <input ref={input} type="file" accept={accept} className="visually-hidden" tabIndex={-1} aria-hidden="true" disabled={disabled}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (f) onReplace(f);
            }} />
        </>
      ) : null}
      {!reading && onRemove && removeLabel ? <IconButton icon="trash" size="sm" label={removeLabel} data-track="file-remove" onClick={onRemove} disabled={disabled} /> : null}
    </div>
  );
}
