/* Engine facts shared by the chooser (A), the connection view (B) and the summary card (C). */
import { t, tMaybe } from "../../i18n";
import type { EngineId, EngineInfo, Settings } from "../../lib/types";

export const DEFAULT_PULL = "ollama pull qwen3:4b-instruct";
export const RECOMMENDED: EngineId = "ollama";

export const PRESETS = [
  { id: "lmstudio", url: "http://localhost:1234/v1" },
  { id: "jan", url: "http://localhost:1337/v1" },
  { id: "openrouter", url: "https://openrouter.ai/api/v1" },
  { id: "openai", url: "https://api.openai.com/v1" },
] as const;

/** i18n key segment: engines.<key>.name / tagline / pick. */
export function engineKey(id: EngineId) {
  return id === "openai_compatible" ? "openai" : id === "claude_cli" ? "claude" : id === "codex_cli" ? "codex"
    : id === "antigravity_cli" ? "antigravity"
    : id === "gemini_live" ? "gemini" : "ollama";
}

export const engineName = (e: Pick<EngineInfo, "id" | "name">) => tMaybe(`engines.${engineKey(e.id)}.name`, e.name);
/** Compact, for the sidebar's account row: "Antigravity (CLI)". */
export const engineShort = (e: Pick<EngineInfo, "id" | "name">) => tMaybe(`engines.${engineKey(e.id)}.short`, engineName(e));
export const engineLine = (id: EngineId) => t(`engines.${engineKey(id)}.pick`);

/** Engines that run a CLI the user signed in to themselves (D85, D86, D87): signed in, not a key. */
export const isCli = (id: EngineId) => id === "claude_cli" || id === "codex_cli" || id === "antigravity_cli";
/** Their copy: engines.claude.* / engines.codex.* / engines.antigravity.*. */
export const cliKey = (id: EngineId) =>
  (id === "codex_cli" ? "codex" : id === "antigravity_cli" ? "antigravity" : "claude") as "claude" | "codex" | "antigravity";

/** The model Mike would use right now: the status model when ready, else the saved setting (if any). */
export function engineModel(e: EngineInfo, settings: Settings | null): string {
  if (e.status.ready && e.status.model) return e.status.model;
  if (e.id === "ollama") return settings?.ollama.model ?? "";
  if (e.id === "openai_compatible") return settings?.openai_compatible.model ?? "";
  return "";
}
