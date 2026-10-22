/* Your CV (D78, D79): the files themselves — drop several, replace or remove each — and, under a disclosure, text
 * about yourself the files don't say. Mike reads the text and every file together. No "Saved" toast: the list shows it.
 * Used by Settings → General and Setup → About you (D81). */
import { useState } from "react";
import { Button, Callout, Disclosure, FileDrop, FileRow, Skeleton, Textarea } from "../ds";
import { t } from "../i18n";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useLoad } from "../lib/hooks";
import { errorMessage } from "../lib/store";
import type { Profile } from "../lib/types";
import s from "./ProfileEditor.module.css";

export const PROFILE_MAX_FILES = 10;
export const CV_ACCEPT = ".pdf,.docx,.txt,.md";

export function ProfileEditor({ id }: { id?: string }) {
  const profile = useLoad(() => api.profile());
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reading, setReading] = useState<string[]>([]);
  const [error, setError] = useState("");
  const data = profile.data;
  if (!data) return profile.error ? <Callout tone="error">{errorMessage(profile.error)}</Callout> : <Skeleton lines={3} />;
  const files = data.files;
  const room = PROFILE_MAX_FILES - files.length;
  const value = note ?? data.note;
  const run = async (key: string, fn: () => Promise<Profile>) => {
    setBusy(key);
    setError("");
    try {
      profile.setData(await fn());
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };
  // Several files go up one after another; each shows as "reading" until the server has its text.
  const add = async (picked: File[]) => {
    const take = picked.slice(0, Math.max(room, 0));
    setReading(take.map((f) => f.name));
    setError(picked.length > take.length ? t("settings.profile.full", { n: PROFILE_MAX_FILES }) : "");
    for (const f of take) {
      setBusy("add");
      try {
        profile.setData(await api.uploadProfile(f));
      } catch (e) {
        setError(`${f.name}: ${errorMessage(e)}`);
      }
      setReading((names) => names.filter((n) => n !== f.name));
    }
    setBusy(null);
  };
  return (
    <>
      <div id={id} className={s.files}>
        {files.map((f) => (
          <FileRow key={f.id} name={f.name} meta={t("settings.profile.added", { date: formatDateTime(f.added) })}
            accept={CV_ACCEPT} replaceLabel={t("settings.profile.replace")} replaceName={t("settings.profile.replaceName", { name: f.name })}
            onReplace={(file) => void run(f.id, () => api.uploadProfile(file, f.id))}
            removeLabel={t("settings.profile.remove", { name: f.name })} onRemove={() => void run(f.id, () => api.deleteProfileFile(f.id))}
            reading={busy === f.id} readingLabel={t("common.checking")} disabled={busy !== null} />
        ))}
        {reading.map((name) => <FileRow key={`r-${name}`} name={name} reading readingLabel={t("common.checking")} />)}
        {room > 0 ? (
          <FileDrop
            label={t("settings.profile.fileLabel")}
            prompt={files.length ? t("settings.profile.dropMore") : t("settings.profile.drop")}
            browseLabel={t("settings.profile.browse")}
            hint={t("settings.profile.fileHint", { n: PROFILE_MAX_FILES })}
            accept={CV_ACCEPT}
            multiple
            compact={files.length > 0 || reading.length > 0}
            onFiles={(picked) => void add(picked)}
            disabled={busy !== null}
          />
        ) : <p className={s.note}>{t("settings.profile.full", { n: PROFILE_MAX_FILES })}</p>}
        {error ? <Callout tone="error" live="alert">{error}</Callout> : null}
      </div>
      <div className={s.text}>
        <Disclosure surface="plain" defaultOpen={Boolean(data.note) && !files.length}
          track="profile-note-toggle"
          title={data.note ? t("settings.profile.text") : files.length ? t("settings.profile.moreText") : t("settings.profile.asText")}>
          <div className={s.textBody}>
            <p className={s.hint}>{t("settings.profile.textHint")}</p>
            <Textarea label={t("settings.profile.text")} hideLabel placeholder={t("settings.profile.textPlaceholder")} rows={8} value={value}
              onChange={(e) => setNote(e.target.value)} showCount />
            <div className={s.actions}>
              <Button variant="primary" data-track="profile-note-save" loading={busy === "note"} disabled={note === null || note === data.note || busy !== null}
                onClick={() => void run("note", () => api.saveProfile(value, "paste")).then((ok) => { if (ok) setNote(null); })}>{t("common.save")}</Button>
            </div>
          </div>
        </Disclosure>
      </div>
    </>
  );
}
