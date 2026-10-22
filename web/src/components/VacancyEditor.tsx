/* Add / edit a job (home.md §3.5). `VacancyEditorView` is the pure dialog (every state by props: paste, file, link,
 * saving, edit); `VacancyEditor` is the live wrapper (POST /api/vacancies). `DeleteJobDialog` is the confirm. */
import { useEffect, useRef, useState } from "react";
import { Button, Callout, Card, Dialog, FileDrop, Input, Segmented, Spinner, Textarea, TextShimmer } from "../ds";
import { t } from "../i18n";
import { api, fileToBase64 } from "../lib/api";
import { errorMessage } from "../lib/store";
import type { Vacancy } from "../lib/types";
import { extractCompanyRole, joinTitle, splitTitle } from "./vacancyTitle";
import s from "./VacancyEditor.module.css";

export type VacancySource = "paste" | "file" | "link";
export type LinkState = "idle" | "fetching" | "fetched" | "error";
export type FileState = "empty" | "reading" | "chosen" | "error";
export const MIN_CHARS = 80;
/** PDF, DOCX, TXT, MD or HTML up to 5 MB (home.md §3.5, 🟡). */
export const FILE_ACCEPT = ".pdf,.docx,.txt,.md,.html,.htm";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface VacancyEditorViewProps {
  open: boolean;
  mode?: "add" | "edit";
  /** Render the open dialog in the flow (stories). */
  inline?: boolean;
  source: VacancySource;
  onSourceChange?: (s: VacancySource) => void;
  text?: string;
  onTextChange?: (v: string) => void;
  company?: string;
  role?: string;
  onCompanyChange?: (v: string) => void;
  onRoleChange?: (v: string) => void;
  /** Company and role were filled in from the text: show the "we filled these in" hint. */
  extracted?: boolean;
  url?: string;
  onUrlChange?: (v: string) => void;
  link?: LinkState;
  /** First lines of the page, after a successful fetch. */
  linkPreview?: string;
  /** Without it the Fetch button is not drawn (the live app saves straight from the link). */
  onFetch?: () => void;
  file?: { name: string; size?: string } | null;
  fileState?: FileState;
  onFile?: (f: File) => void;
  onRemoveFile?: () => void;
  saving?: boolean;
  /** The API's message, shown in an error callout. */
  error?: string;
  /** "Save job" (default) or "Save and start". */
  saveLabel?: string;
  canSave?: boolean;
  onSave?: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onSwitchToPaste?: () => void;
}

export function VacancyEditorView(p: VacancyEditorViewProps) {
  const {
    open, mode = "add", inline, source, text = "", company = "", role = "", url = "", link = "idle", file = null, fileState = "empty",
    saving, error, saveLabel, extracted,
  } = p;
  const short = source === "paste" && text.trim().length > 0 && text.trim().length < MIN_CHARS;
  const canSave = p.canSave ?? (source === "paste" ? text.trim().length > 0 : source === "link" ? url.trim().length > 0 : Boolean(file) && fileState === "chosen");
  const showPair = source === "paste" || (source === "file" && fileState === "chosen") || (source === "link" && link === "fetched");

  return (
    <Dialog
      open={open}
      inline={inline}
      onClose={p.onClose}
      title={mode === "edit" ? t("vacancy.editTitle") : t("vacancy.title")}
      actionsStart={mode === "edit" ? <Button variant="ghost" icon="trash" data-track="job-delete" onClick={p.onDelete}>{t("vacancy.delete")}</Button> : undefined}
      actions={(
        <>
          <Button variant="ghost" data-track="job-cancel" onClick={p.onClose}>{t("common.cancel")}</Button>
          {/* F-13-11: the button stays where it was and says what it is doing. */}
          <Button variant="primary" data-track="job-save" disabled={!canSave} loading={saving} onClick={p.onSave}>{saving ? t("vacancy.saving") : saveLabel ?? t("vacancy.save")}</Button>
        </>
      )}
    >
      <form className={s.form} data-review-id="VacancyEditor" onSubmit={(e) => { e.preventDefault(); if (canSave && !saving) p.onSave?.(); }}>
        <Segmented<VacancySource>
          track="job-source"
          label={t("vacancy.tabs")}
          hideLabel
          fullWidth
          value={source}
          onChange={(v) => p.onSourceChange?.(v)}
          options={[
            { value: "paste", label: t("vacancy.paste"), icon: "file" },
            { value: "file", label: t("vacancy.file"), icon: "upload" },
            { value: "link", label: t("vacancy.link"), icon: "link" },
          ]}
        />

        {source === "paste" ? (
          <Textarea
            label={t("vacancy.text")}
            placeholder={t("vacancy.textPlaceholder")}
            value={text}
            rows={8}
            showCount
            onChange={(e) => p.onTextChange?.(e.target.value)}
          />
        ) : null}
        {short ? <Callout tone="info">{t("vacancy.short")}</Callout> : null}

        {source === "file" ? (
          <FileDrop
            label={t("vacancy.fileZone")}
            privacy={t("vacancy.filePrivacy")}
            prompt={t("vacancy.drop")}
            browseLabel={t("vacancy.browse")}
            hint={t("vacancy.fileHint")}
            accept={FILE_ACCEPT}
            state={fileState}
            file={file ?? undefined}
            readingLabel={t("vacancy.reading")}
            removeLabel={t("vacancy.fileRemove")}
            error={{
              title: t("vacancy.fileErrorTitle"),
              body: error || t("vacancy.fileError"),
              action: <Button variant="secondary" size="sm" data-track="job-to-paste" onClick={p.onSwitchToPaste}>{t("vacancy.toPaste")}</Button>,
            }}
            onFile={p.onFile}
            onRemove={p.onRemoveFile}
          />
        ) : null}

        {source === "link" ? (
          <>
            <div className={s.linkRow}>
              <Input
                label={t("vacancy.url")}
                hint={t("vacancy.urlHint")}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={url}
                onChange={(e) => p.onUrlChange?.(e.target.value)}
              />
              {p.onFetch ? (
                <Button variant="secondary" data-track="job-fetch" disabled={!url.trim() || link === "fetching"} onClick={p.onFetch}>{t("vacancy.fetch")}</Button>
              ) : null}
            </div>
            {link === "fetching" ? (
              <p className={s.fetching}><Spinner size="sm" /><TextShimmer status>{t("vacancy.fetching")}</TextShimmer></p>
            ) : null}
            {link === "fetched" && p.linkPreview ? <Card tone="subtle" padding="md"><p className={s.preview}>{p.linkPreview}</p></Card> : null}
            {link === "error" ? (
              <Callout
                tone="error"
                live="alert"
                title={t("vacancy.linkErrorTitle")}
                actions={<Button variant="secondary" size="sm" data-track="job-to-paste" onClick={p.onSwitchToPaste}>{t("vacancy.toPaste")}</Button>}
              >
                {error || t("vacancy.linkError")}
              </Callout>
            ) : null}
          </>
        ) : null}

        {showPair ? (
          <div className={s.pair}>
            <Input label={t("vacancy.company")} value={company} onChange={(e) => p.onCompanyChange?.(e.target.value)} maxLength={120} />
            <Input label={t("vacancy.role")} value={role} onChange={(e) => p.onRoleChange?.(e.target.value)} maxLength={120} />
            {extracted ? <p className={s.pairHint}>{t("vacancy.extracted")}</p> : null}
          </div>
        ) : null}

        {error && source !== "link" && source !== "file" ? <Callout tone="error" live="alert" title={t("vacancy.error")}>{error}</Callout> : null}
        {error && source === "link" && link !== "error" ? <Callout tone="error" live="alert" title={t("vacancy.error")}>{error}</Callout> : null}
      </form>
    </Dialog>
  );
}

/** Confirm before deleting a job (CONTRACT §2.4: red only for permanent loss; the sessions stay in History). */
export function DeleteJobDialog({ open, name, inline, onCancel, onConfirm }: {
  open: boolean; name: string; inline?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      inline={inline}
      onClose={onCancel}
      title={t("vacancy.deleteTitle", { name })}
      actions={(
        <>
          <Button variant="ghost" data-track="job-delete-cancel" onClick={onCancel}>{t("common.cancel")}</Button>
          <Button variant="danger" data-track="job-delete-confirm" onClick={onConfirm}>{t("vacancy.delete")}</Button>
        </>
      )}
    >
      <p>{t("vacancy.deleteBody")}</p>
    </Dialog>
  );
}

export interface VacancyEditorProps {
  open: boolean;
  onClose: () => void;
  /** The created job (for an edit: the new copy that replaced the old one). */
  onSaved: (v: Vacancy) => void;
  /** Open on this tab with this content (a pasted text or link from the composer, the File button). */
  initial?: { source?: VacancySource; text?: string; url?: string };
  /** Edit this job. The server has no update call: Save creates the new version and moves the old one to Trash. */
  editId?: string | null;
  /** "Save and start" (Start pressed with unsaved text). */
  saveLabel?: string;
  onDeleted?: (id: string) => void;
}

export function VacancyEditor({ open, onClose, onSaved, initial, editId, saveLabel, onDeleted }: VacancyEditorProps) {
  const [source, setSource] = useState<VacancySource>("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ name: string; size?: string; data?: string } | null>(null);
  const [fileState, setFileState] = useState<FileState>("empty");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [typed, setTyped] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const wasOpen = useRef(false);

  // Each opening starts from `initial` (or from the job being edited).
  useEffect(() => {
    if (!open || wasOpen.current) {
      wasOpen.current = open;
      return;
    }
    wasOpen.current = true;
    setSource(initial?.source ?? "paste");
    setText(initial?.text ?? "");
    setUrl(initial?.url ?? "");
    setFile(null);
    setFileState("empty");
    setCompany("");
    setRole("");
    setTyped(false);
    setExtracted(false);
    setError("");
    setSaving(false);
    setAskDelete(false);
    const guess = initial?.text ? extractCompanyRole(initial.text) : null;
    if (guess) {
      setCompany(guess.company);
      setRole(guess.role);
      setExtracted(true);
    }
    if (editId) {
      void api.vacancy(editId).then((v) => {
        const parts = splitTitle(v.title);
        setText(v.text);
        setCompany(parts.company);
        setRole(parts.role);
        setTyped(true);
      }).catch(() => {});
    }
  }, [open, initial, editId]);

  const changeText = (v: string) => {
    setText(v);
    if (typed) return;
    const guess = extractCompanyRole(v);
    setCompany(guess?.company ?? "");
    setRole(guess?.role ?? "");
    setExtracted(Boolean(guess));
  };

  const pick = async (f: File) => {
    setError("");
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (f.size > MAX_FILE_BYTES || !FILE_ACCEPT.split(",").includes(ext)) {
      setFile(null);
      setFileState("error");
      return;
    }
    setFile({ name: f.name, size: formatSize(f.size) });
    setFileState("reading");
    try {
      const data = await fileToBase64(f);
      setFile({ name: f.name, size: formatSize(f.size), data });
      setFileState("chosen");
    } catch {
      setFile(null);
      setFileState("error");
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Parameters<typeof api.createVacancy>[0] = { title: joinTitle({ company, role }) };
      if (source === "paste") body.text = text.trim();
      else if (source === "link") body.url = url.trim();
      else if (file?.data) body.file = { name: file.name, data: file.data };
      const vacancy = await api.createVacancy(body);
      if (editId) {
        await api.deleteVacancy(editId).catch(() => {});
        onDeleted?.(editId);
      }
      onSaved(vacancy);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    await api.deleteVacancy(editId);
    setAskDelete(false);
    onDeleted?.(editId);
    onClose();
  };

  return (
    <>
      <VacancyEditorView
        open={open && !askDelete}
        mode={editId ? "edit" : "add"}
        source={source}
        onSourceChange={(v) => { setSource(v); setError(""); }}
        text={text}
        onTextChange={changeText}
        company={company}
        role={role}
        onCompanyChange={(v) => { setCompany(v); setTyped(true); setExtracted(false); }}
        onRoleChange={(v) => { setRole(v); setTyped(true); setExtracted(false); }}
        extracted={extracted}
        url={url}
        onUrlChange={setUrl}
        link={error && source === "link" ? "error" : "idle"}
        file={file}
        fileState={fileState}
        onFile={(f) => void pick(f)}
        onRemoveFile={() => { setFile(null); setFileState("empty"); }}
        saving={saving}
        error={error}
        saveLabel={saveLabel}
        onSave={() => void save()}
        onClose={onClose}
        onDelete={() => setAskDelete(true)}
        onSwitchToPaste={() => { setSource("paste"); setError(""); }}
      />
      <DeleteJobDialog
        open={open && askDelete}
        name={company || t("vacancy.title")}
        onCancel={() => setAskDelete(false)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
