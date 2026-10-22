/* Setup → AI engine (D82, was D81). A choice of the four engines; on the first run nothing is picked for you (people should be
 * given a choice). Picking one that isn't ready opens its setup under it — Ollama not installed →
 * "Download Ollama", not running → how to start it (US-02 AC5). Continue switches to the picked engine once it is
 * Ready; there is no text-mode way out here (the engine writes Mike's questions). Run again from Settings → About,
 * the engine in use is picked when it is Ready. */
import { useState } from "react";
import { Button, Callout, IconButton } from "../../ds";
import { t } from "../../i18n";
import { EngineChoice } from "../../components/engine/EngineChoice";
import { RECOMMENDED, engineName } from "../../components/engine/meta";
import { prefs } from "../../lib/prefs";
import { errorMessage, useApp } from "../../lib/store";
import type { EngineId } from "../../lib/types";
import { StepFooter, StepHead, type HeadingRef } from "./SetupFrame";
import s from "./Setup.module.css";

export interface EngineStepProps {
  headingRef?: HeadingRef;
  onNext: () => void;
  /** Review and stories: start with this engine picked. */
  initialPick?: EngineId;
}

export function EngineStep({ headingRef, onNext, initialPick }: EngineStepProps) {
  const { engines, updateSettings, refreshEngines, enginesLoading } = useApp();
  const inUse = engines?.engines.find((e) => e.id === engines.selected && e.status.ready) ?? null;
  const [pick, setPick] = useState<EngineId | null>(initialPick ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A rerun (setup done before) starts on the engine in use; the first run starts on the recommended one when it is
  // ready (QA-06), otherwise on nothing: the user chooses, and Continue waits.
  const recommended = engines?.engines.find((e) => e.id === RECOMMENDED && e.status.ready) ?? null;
  const value = pick ?? (prefs.setupDone() && inUse ? inUse.id : recommended ? recommended.id : null);
  const picked = engines?.engines.find((e) => e.id === value) ?? null;
  const ready = Boolean(picked?.status.ready);

  const next = async () => {
    if (!picked) return;
    setError("");
    if (picked.id !== engines?.selected) {
      setBusy(true);
      try {
        await updateSettings({ engine: picked.id });
      } catch (e) {
        setError(errorMessage(e));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onNext();
  };

  return (
    <>
      <StepHead headingRef={headingRef} title={t("setup.engine.title")} />
      <div data-review-id="Setup/Engine" data-review-section="Setup · AI engine" data-comment-target>
        <EngineChoice value={value} onChange={setPick} />
      </div>
      {error ? <Callout tone="error" live="alert">{error}</Callout> : null}
      {/* 13b: "Check again" sits in the footer, so nothing stands alone above the list. */}
      <StepFooter back={engines ? <IconButton icon="refresh" label={t("common.checkAgain")} data-track="engine-recheck" disabled={enginesLoading} onClick={() => void refreshEngines()} /> : undefined}>
        <span className={s.note} aria-live="polite">
          {!picked ? t("setup.engine.pickFirst") : !ready ? t("setup.engine.waiting", { name: engineName(picked) }) : t("setup.engine.later")}
        </span>
        <Button variant="primary" iconRight="arrowRight" data-track="setup-continue" disabled={!ready || busy} loading={busy} onClick={() => void next()}>{t("common.continue")}</Button>
      </StepFooter>
    </>
  );
}
