/* Setup → About you (D81). Everything optional (US-02 AC3): the name Mike calls you by (D80), the CV files (D79, the
 * same editor as Settings → General), the job, voice or keyboard — then the first round starts right here. */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon, Input, Segmented, SettingGroup, SettingRow } from "../../ds";
import { t } from "../../i18n";
import { ProfileEditor } from "../../components/ProfileEditor";
import { VacancyEditor } from "../../components/VacancyEditor";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/hooks";
import { prefs } from "../../lib/prefs";
import { useApp } from "../../lib/store";
import type { InputMode } from "../../lib/types";
import { buildSessionConfig } from "../../session/startConfig";
import { StepFooter, StepHead, type HeadingRef } from "./SetupFrame";
import { useSetupSave } from "./useSetupSave";
import s from "./Setup.module.css";

const NAME_MAX = 60;
type Answer = Exclude<InputMode, "browser_stt">;

export interface AboutStepProps {
  headingRef?: HeadingRef;
  onBack: () => void;
  /** Review and stories: a job already added. */
  initialJob?: string;
  /** Review and stories: a failed save of the name (Q8). */
  initialSaveError?: string;
}

export function AboutStep({ headingRef, onBack, initialJob = "", initialSaveError }: AboutStepProps) {
  const navigate = useNavigate();
  const { settings } = useApp();
  const { save, view: saveView } = useSetupSave(initialSaveError);
  const blocked = useRef(false);
  const stt = useLoad(() => api.stt());
  const [name, setName] = useState<string | null>(null);
  const [job, setJob] = useState(initialJob);
  const [editor, setEditor] = useState(false);
  const [answer, setAnswer] = useState<Answer>(prefs.input() === "text" ? "text" : "voice");
  const value = name ?? settings?.name ?? "";

  /** Resolves `false` when the save failed: the typed name stays in the field and the error shows above the rows. */
  const saveName = async () => {
    if (name === null) return true;
    const next = name.split(/\s+/).filter(Boolean).join(" ").slice(0, NAME_MAX);
    if (next === (settings?.name ?? "")) { setName(null); return true; }
    const ok = await save({ name: next });
    if (ok) setName(null);
    return ok;
  };
  const finish = async (start: boolean) => {
    // A failed save keeps the step open once so the error can be read; pressing again goes on without the name.
    if (!(await saveName()) && !blocked.current) { blocked.current = true; return; }
    prefs.setSetupDone(true);
    prefs.setInput(answer);
    if (!start) {
      navigate("/", { replace: true });
      return;
    }
    const vacancyId = prefs.vacancy() || undefined;
    const config = buildSessionConfig({ mode: "interview", answer, roundType: "mix", vacancyId }, settings, stt.data);
    navigate("/session", { replace: true, state: { config, title: t("setup.about.roundTitle") } });
  };

  return (
    <>
      <StepHead headingRef={headingRef} title={t("setup.about.title")} sub={t("setup.about.subtitle")} />
      {saveView}
      <div className={s.body}>
        <div data-review-id="Setup/About/Name" data-review-section="Setup · About you · Name" data-comment-target>
          <SettingGroup title={t("setup.about.nameGroup")} hideTitle headingLevel={2}>
            <SettingRow id="setup-name" label={t("setup.about.name")}>
              <Input label={t("setup.about.name")} hideLabel className={s.nameInput} value={value} maxLength={NAME_MAX}
                placeholder={t("setup.about.namePlaceholder")} autoComplete="given-name" spellCheck={false}
                onChange={(e) => setName(e.target.value)} onBlur={() => void saveName()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveName(); } }} />
            </SettingRow>
          </SettingGroup>
        </div>
        <div data-review-id="Setup/About/CV" data-review-section="Setup · About you · CV" data-comment-target>
          <SettingGroup title={t("setup.about.cv")} headingLevel={2}>
            <ProfileEditor id="setup-cv" />
          </SettingGroup>
        </div>
        <div data-review-id="Setup/About/Job" data-review-section="Setup · About you · Job and round" data-comment-target>
          <SettingGroup title={t("setup.about.job")} hideTitle headingLevel={2}>
            <SettingRow id="setup-job" label={job ? <span className={s.job}><Icon name="briefcase" size="sm" /><span className={s.jobTitle}>{job}</span></span> : t("setup.about.job")}>
              <Button size="sm" variant="secondary" icon={job ? undefined : "plus"} data-track={job ? "setup-job-change" : "setup-job-add"} onClick={() => setEditor(true)}>
                {job ? t("setup.about.jobChange") : t("setup.about.jobAdd")}
              </Button>
            </SettingRow>
            <SettingRow id="setup-answer" label={t("setup.about.how")} description={t("setup.about.roundHint")}>
              <Segmented label={t("setup.about.how")} hideLabel value={answer} onChange={setAnswer}
                options={[{ value: "voice", label: t("home.voice"), icon: "mic", track: "setup-answer-voice" }, { value: "text", label: t("home.keyboard"), icon: "keyboard", track: "setup-answer-text" }]} />
            </SettingRow>
          </SettingGroup>
        </div>
      </div>
      <StepFooter back={<Button variant="ghost" icon="chevronLeft" data-track="setup-back" onClick={onBack}>{t("common.back")}</Button>}>
        <Button variant="ghost" data-track="setup-skip" onClick={() => void finish(false)}>{t("setup.about.later")}</Button>
        <Button variant="primary" icon={answer === "voice" ? "mic" : "keyboard"} data-track="setup-start-round" onClick={() => void finish(true)}>{t("setup.about.start")}</Button>
      </StepFooter>
      <VacancyEditor open={editor} onClose={() => setEditor(false)}
        onSaved={(v) => { setEditor(false); setJob(v.title); prefs.setVacancy(v.id); void api.vacancyQuestions(v.id).catch(() => {}); }} />
    </>
  );
}
