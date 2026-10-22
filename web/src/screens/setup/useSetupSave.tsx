/* Setup saves of the name and the voice (Q8). Like Settings (useSave): no "Saved" message, only a failure shows —
 * an error callout above the step's rows, `settings.saveError`. `initialError` is for stories and the review page. */
import { useState, type ReactNode } from "react";
import { Callout } from "../../ds";
import { t } from "../../i18n";
import { errorMessage, useApp } from "../../lib/store";
import type { SettingsPatch } from "../../lib/types";

export function useSetupSave(initialError = ""): { save: (patch: SettingsPatch) => Promise<boolean>; failed: boolean; view: ReactNode } {
  const { updateSettings } = useApp();
  const [error, setError] = useState(initialError);
  const save = (patch: SettingsPatch) => {
    setError("");
    return updateSettings(patch).then(() => true, (e: unknown) => { setError(errorMessage(e)); return false; });
  };
  const view = error ? <Callout tone="error" live="alert">{t("settings.saveError", { message: error })}</Callout> : null;
  return { save, failed: Boolean(error), view };
}
