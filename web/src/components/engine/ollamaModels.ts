/* Pure logic of the Ollama model dropdowns (Settings → AI engine): which models to list, and what to do with the
 * download the user started by picking one that isn't on the computer yet. */
import { t } from "../../i18n";
import { formatBytes } from "../../lib/format";
import type { OllamaModel, OllamaPull } from "../../lib/types";

export type ModelSlot = "model" | "voice_model";
/** The pick waiting for its download: the setting changes only once the model is on the computer. "" = Automatic. */
export interface PendingPick { slot: ModelSlot; value: string; model: string }

export interface ModelOption { value: string; label: string }

/** Models Mike knows how to download that aren't installed yet (plus the recommended one, even if the server left it out). */
export function missingModels(installed: OllamaModel[], pull: OllamaPull | null, recommended: string): { model: string; size_gb: number }[] {
  const have = new Set(installed.map((m) => m.name));
  const known = [...(pull?.options ?? [])];
  if (recommended && !known.some((o) => o.model === recommended)) known.push({ model: recommended, size_gb: 0 });
  return known.filter((o) => !have.has(o.model));
}

export function buildOptions(installed: OllamaModel[], pull: OllamaPull | null, auto: string): ModelOption[] {
  const missing = missingModels(installed, pull, auto);
  const autoMissing = missing.some((m) => m.model === auto);
  return [
    { value: "", label: t(autoMissing ? "engines.ollama.autoMissing" : "engines.ollama.auto", { model: auto }) },
    ...installed.map((m) => ({
      value: m.name,
      label: [m.name, formatBytes(m.size), m.thinking_only ? t("engines.ollama.thinkingOnly") : "",
        m.name === auto ? t("engines.ollama.recommended") : ""].filter(Boolean).join(" · "),
    })),
    ...missing.map((m) => ({
      value: m.model,
      label: [m.model, m.size_gb ? `${m.size_gb} GB` : "", t("engines.ollama.notDownloaded"),
        m.model === auto ? t("engines.ollama.recommended") : ""].filter(Boolean).join(" · "),
    })),
  ];
}

/** The model a pick needs on the computer, or "" when it is already there. */
export function modelToPull(value: string, installed: OllamaModel[], auto: string): string {
  const model = value || auto;
  return model && !installed.some((m) => m.name === model) ? model : "";
}

/** What a polled download state means for the waiting pick. */
export function settle(pull: OllamaPull, pending: PendingPick | null): "wait" | "save" | "fail" | "drop" {
  if (pull.state === "pulling") return "wait";
  if (!pending || pull.model !== pending.model) return "drop";
  return pull.state === "done" ? "save" : pull.state === "error" ? "fail" : "drop";
}
