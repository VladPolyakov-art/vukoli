/* The running Ollama model download: progress bar, bytes line and Cancel. Shared by the "no model yet" card
 * (OllamaDownload) and the model dropdowns in Settings (OllamaModelPicker). */
import { Button, Callout, Progress } from "../../ds";
import { t } from "../../i18n";
import { formatBytes } from "../../lib/format";
import type { OllamaPull } from "../../lib/types";
import s from "./engine.module.css";

export function PullProgress({ pull, onCancel }: { pull: OllamaPull; onCancel: () => void }) {
  const share = pull.total ? pull.completed / pull.total : undefined;
  const line = pull.phase === "verify" ? t("engines.ollama.pull.verifying")
    : !pull.total ? t("engines.ollama.pull.preparing")
    : t("engines.ollama.pull.progress", { done: formatBytes(pull.completed) || "0 MB", total: formatBytes(pull.total),
      pct: Math.floor((share ?? 0) * 100) });
  return (
    <Callout tone="info" icon="download" title={t("engines.ollama.pull.downloading", { model: pull.model })}
      actions={<Button variant="ghost" size="sm" data-track="ollama-pull-cancel" onClick={onCancel}>{t("common.cancel")}</Button>}>
      <div className={s.pull}>
        <Progress label={t("engines.ollama.pull.label")} value={pull.phase === "verify" ? 1 : share} valueText={line} />
        <p className={s.pullLine}>{line}</p>
        <p className={s.note}>{t("engines.ollama.pull.keepsGoing")}</p>
      </div>
    </Callout>
  );
}
