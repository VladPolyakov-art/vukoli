/* Fixtures for stories and the review page: a store value that works without a server (switching and saving change
 * local state) plus a small fetch stub for the engine calls the forms make (model list, "Test the engine", "Connect").
 * The stub only answers those URLs and a few setup ones, and only after a fixture provider has rendered; everything else goes to fetch. */
import { useMemo, useState, type ReactNode } from "react";
import { AppStoreProvider, type AppStore } from "../../lib/store";
import type { EngineId, EngineInfo, EngineLimits, EngineStatus, EnginesResponse, OllamaModelsResponse, OllamaPull, Settings, SettingsPatch, StatusCode } from "../../lib/types";
import { OllamaPullPreview } from "./OllamaDownload";
import { LimitsOverride } from "./PlanLimit";

const status = (code: StatusCode, message = "", extra: Partial<EngineStatus> = {}): EngineStatus => ({
  code, ready: code === "ready", message, hint: "", hint_command: "", fix_url: "", model: "", warnings: [], ...extra,
});

const BASE: Record<EngineId, Omit<EngineInfo, "status" | "selected">> = {
  ollama: {
    id: "ollama", name: "Ollama (local)", kind: "text", local: true, cost: "Free. Runs on this computer.",
    data_line: "Your words stay on this computer: speech is recognised locally and the model runs in Ollama.",
    needs: [], terms_note: "", privacy_note: "", setup_url: "https://ollama.com/download",
  },
  openai_compatible: {
    id: "openai_compatible", name: "Other AI (OpenAI-compatible)", kind: "text", local: false,
    cost: "Depends on the service. Local servers (LM Studio, llama.cpp, Jan) are free.",
    data_line: "Your transcribed words go to the server you configure. Speech is still recognised on this computer.",
    needs: [], terms_note: "", privacy_note: "With a cloud service, its own privacy terms apply.", setup_url: "",
  },
  claude_cli: {
    id: "claude_cli", name: "Claude (your Claude Code CLI)", kind: "text", local: false, cost: "Uses your own Claude plan.",
    data_line: "Your transcribed words go to Anthropic through your Claude Code CLI. Speech is recognised on this computer.",
    needs: [], terms_note: "Uses your own Claude subscription via the Claude Code CLI; check Anthropic's terms.", privacy_note: "",
    setup_url: "https://docs.claude.com/en/docs/claude-code",
  },
  codex_cli: {
    id: "codex_cli", name: "Codex (your Codex CLI)", kind: "text", local: false, cost: "Uses your own ChatGPT plan.",
    data_line: "Your transcribed words go to OpenAI through your Codex CLI. Speech is recognised on this computer.",
    needs: [], terms_note: "Uses your own ChatGPT plan via the Codex CLI; check OpenAI's terms. Each request counts against your Codex limits.",
    privacy_note: "", setup_url: "https://github.com/openai/codex",
  },
  antigravity_cli: {
    id: "antigravity_cli", name: "Antigravity (your Antigravity CLI)", kind: "text", local: false,
    cost: "Uses your own Google AI plan or free quota.",
    data_line: "Your transcribed words go to Google through your Antigravity CLI. Speech is recognised on this computer.",
    needs: [], terms_note: "Uses your own Google account via the Antigravity CLI; check Google's terms. Each request counts against your Antigravity quota.",
    privacy_note: "", setup_url: "https://antigravity.google/docs/cli",
  },
  gemini_live: {
    id: "gemini_live", name: "Gemini Live", kind: "live", local: false, cost: "Free tier with your own API key; limits apply.",
    data_line: "Your voice and words go to Google's Gemini API.", needs: [], terms_note: "",
    privacy_note: "Your voice goes to Google while you speak. Don't say anything you wouldn't send to Google.",
    setup_url: "https://aistudio.google.com/apikey",
  },
};

export type EngineState =
  | "ready" | "not_installed" | "not_running" | "no_model" | "not_configured" | "disconnected"
  | "unverified" | "signed_out";

const STATUS: Record<EngineId, Record<EngineState, EngineStatus>> = {
  ollama: {
    ready: status("ready", "Ollama is ready with qwen3:8b.", { model: "qwen3:8b" }),
    not_installed: status("not_installed", "Ollama isn't installed."),
    not_running: status("not_running", "Ollama isn't running.", { hint_command: "ollama serve" }),
    no_model: status("no_model", "No model is downloaded yet.", { hint_command: "ollama pull qwen3:4b-instruct" }),
    not_configured: status("not_configured", "Set up Ollama."),
    disconnected: status("disconnected", "Disconnected in Vukoli."),
    unverified: status("not_configured"), signed_out: status("not_configured"),
  },
  openai_compatible: {
    ready: status("ready", "Connected.", { model: "qwen3-4b-instruct" }),
    not_installed: status("not_configured"), not_running: status("not_configured"), no_model: status("not_configured"),
    not_configured: status("not_configured", "Set the base URL of your AI server.", { hint: "For LM Studio use http://localhost:1234/v1; for OpenAI https://api.openai.com/v1" }),
    disconnected: status("not_configured"), unverified: status("not_configured"), signed_out: status("not_configured"),
  },
  claude_cli: {
    ready: status("ready", "Claude Code is signed in.", { model: "sonnet" }),
    not_installed: status("not_installed", "Claude Code wasn't found."),
    not_running: status("not_installed"), no_model: status("not_installed"), not_configured: status("not_installed"),
    disconnected: status("disconnected", "Disconnected in Vukoli."),
    unverified: status("unverified", "Claude Code was found. Connect checks that you're signed in."),
    signed_out: status("unauthorized", "Claude Code isn't signed in.", { hint_command: "claude" }),
  },
  codex_cli: {
    ready: status("ready", "Codex is signed in."),
    not_installed: status("not_installed", "The Codex CLI was not found on this computer.", { hint_command: "brew install --cask codex" }),
    not_running: status("not_installed"), no_model: status("not_installed"), not_configured: status("not_installed"),
    disconnected: status("disconnected", "Disconnected in Vukoli."),
    unverified: status("unverified", "Codex is signed in. Connect checks that it answers."),
    signed_out: status("unauthorized", "Codex isn't signed in.", { hint_command: "codex login" }),
  },
  antigravity_cli: {
    ready: status("ready", "Antigravity is signed in."),
    not_installed: status("not_installed", "The Antigravity CLI was not found on this computer.",
      { hint_command: "curl -fsSL https://antigravity.google/cli/install.sh | bash" }),
    not_running: status("not_installed"), no_model: status("not_installed"), not_configured: status("not_installed"),
    disconnected: status("disconnected", "Disconnected in Vukoli."),
    unverified: status("unverified", "Antigravity is signed in. Connect checks that it answers."),
    signed_out: status("unauthorized", "Antigravity isn't signed in.", { hint_command: "agy" }),
  },
  gemini_live: {
    ready: status("ready", "Gemini key works.", { model: "gemini-live" }),
    not_installed: status("not_configured"), not_running: status("not_configured"), no_model: status("not_configured"),
    not_configured: status("not_configured", "Add a Gemini API key.", { hint: "Create a free key in Google AI Studio." }),
    disconnected: status("not_configured"), unverified: status("not_configured"), signed_out: status("not_configured"),
  },
};

/** The six engines with a state each (default: only Ollama ready, the others not set up). */
export function makeEngines(states: Partial<Record<EngineId, EngineState>> = {}, selected: EngineId = "ollama"): EnginesResponse {
  const order: EngineId[] = ["ollama", "openai_compatible", "claude_cli", "codex_cli", "antigravity_cli", "gemini_live"];
  return {
    selected,
    engines: order.map((id) => ({ ...BASE[id], status: STATUS[id][states[id] ?? (id === "ollama" ? "ready" : "not_configured")], selected: id === selected })),
  };
}

export const NONE_READY = makeEngines({ ollama: "not_running", claude_cli: "not_installed" });

export const SETTINGS: Settings = {
  engine: "ollama",
  name: "",
  ollama: { url: "http://localhost:11434", model: "", voice_model: "" },
  openai_compatible: { base_url: "", model: "", has_api_key: false },
  claude_cli: { model: "" },
  codex_cli: { model: "" },
  antigravity_cli: { model: "" },
  gemini_live: { model: "", text_model: "", voice: "", has_api_key: false },
  voice: "", kokoro_speed: 1, stt: { backend: "auto", model: "" }, answer_suggester: true, telemetry_opt_in: false,
  obsidian_dir: "", layer_order: "content-first", level: "B2", strictness: 2, questions_per_session: 5,
};

const MODELS: OllamaModelsResponse = {
  models: [
    { name: "qwen3:8b", size: 5_200_000_000, thinking_only: false },
    { name: "qwen3:4b-instruct", size: 2_500_000_000, thinking_only: false },
    { name: "gemma3:4b", size: 3_300_000_000, thinking_only: false },
  ],
  recommended: "qwen3:8b", recommended_voice: "qwen3:4b-instruct", ram_gb: 16,
};

/** The Ollama model download (D85): not started, halfway, failed. */
const PULL_BASE: OllamaPull = {
  model: "", state: "idle", phase: "", error: "", completed: 0, total: 0, recommended: "qwen3:8b",
  options: [{ model: "qwen3:4b-instruct", size_gb: 2.5 }, { model: "qwen3:8b", size_gb: 5.2 }],
};
export const PULL_IDLE = PULL_BASE;
export const PULL_DOWNLOADING: OllamaPull = { ...PULL_BASE, model: "qwen3:8b", state: "pulling", phase: "download", completed: 2_180_000_000, total: 5_225_000_000 };
export const PULL_CANCELLED: OllamaPull = { ...PULL_BASE, model: "qwen3:4b-instruct", state: "cancelled" };
export const PULL_FAILED: OllamaPull = { ...PULL_BASE, model: "qwen3:8b", state: "error", error: "no space left on device" };

/** Plan limits (D88), fictional: what each plan reports, or Vukoli's own count where Google publishes no number. */
export const LIMITS = {
  codex: { engine: "codex_cli", kind: "percent", plan: "free", as_of: "2026-10-21T09:00:00Z",
    windows: [{ id: "month", used_percent: 2, resets_at: "2026-11-20T09:00:00Z", stale: false }],
    estimate: { sessions: 98, at_least: true, window: "month" } },
  claude: { engine: "claude_cli", kind: "percent", plan: "", as_of: "2026-10-21T09:00:00Z", windows: [
    { id: "five_hour", used_percent: 28, resets_at: "2026-10-21T13:00:00Z", stale: false },
    { id: "seven_day", used_percent: 4, resets_at: "2026-10-25T08:00:00Z", stale: false }],
  estimate: { sessions: 24, at_least: false, window: "five_hour" } },
  claudeLow: { engine: "claude_cli", kind: "percent", plan: "", as_of: "2026-10-21T09:00:00Z", windows: [
    { id: "five_hour", used_percent: 86, resets_at: "2026-10-21T13:00:00Z", stale: false },
    { id: "seven_day", used_percent: 31, resets_at: "2026-10-25T08:00:00Z", stale: false }],
  estimate: { sessions: 4, at_least: false, window: "five_hour" } },
  claudeUsedUp: { engine: "claude_cli", kind: "percent", plan: "", as_of: "2026-10-21T09:00:00Z", windows: [
    { id: "five_hour", used_percent: 100, resets_at: "2026-10-21T13:00:00Z", stale: false }], estimate: { sessions: 0, at_least: false, window: "five_hour" } },
  claudePending: { engine: "claude_cli", kind: "pending" },
  antigravity: { engine: "antigravity_cli", kind: "count", period: "week", requests: 46 },
  gemini: { engine: "gemini_live", kind: "count", period: "day", requests: 12, resets_at: "2026-10-22T07:00:00Z" },
} satisfies Record<string, EngineLimits>;

const DEFAULT_LIMITS: Partial<Record<EngineId, EngineLimits>> = {
  codex_cli: LIMITS.codex, claude_cli: LIMITS.claude, antigravity_cli: LIMITS.antigravity, gemini_live: LIMITS.gemini,
};

let stubbed = false;
function installStub() {
  if (stubbed || typeof window === "undefined") return;
  stubbed = true;
  const real = window.fetch.bind(window);
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/engines/ollama/models")) return json(MODELS);
    if (url.endsWith("/api/engines/ollama/pull")) return json(PULL_IDLE);
    // "Disconnect" in stories: the server answers; the fixture list stays as it is.
    if (/\/api\/engines\/[a-z_]+\/disconnect$/.test(url)) return json({ status: status("disconnected", "") });
    // "Connect" in stories: still not found, so the story shows the follow-up hint.
    const connect = /\/api\/engines\/([a-z_]+)\/connect$/.exec(url);
    if (connect) return json({ started: false, status: status(connect[1] === "claude_cli" || connect[1] === "codex_cli" || connect[1] === "antigravity_cli" ? "not_installed" : "not_running", "") });
    if (/\/api\/engines\/[a-z_]+\/test$/.test(url)) return json({ ok: true, latency_ms: 840, status: STATUS.ollama.ready });
    // Settings sections (D76 review frames): fictional voices, speech and data, no server.
    if (url.endsWith("/api/voices")) return json({ default: "am_eric", tts: { available: true }, voices: [
      { id: "am_eric", label: "Eric · US, male", locale: "en-US", gender: "m" },
      { id: "af_heart", label: "Heart · US, female", locale: "en-US", gender: "f" },
    ] });
    if (url.endsWith("/api/stt")) return json({ available: true, backend: "mlx" });
    if (url.endsWith("/api/telemetry")) return json({ opt_in: false, events: 0, file: "", remote: false, what: "" });
    if (url.endsWith("/api/sessions/trash")) return json({ items: [] });
    if (url.endsWith("/api/health")) return json({ ok: true, data_dir: "~/Library/Application Support/Vukoli" });
    // A fictional profile (D78/D79 General frames): two files and no note; never the owner's.
    if (url.endsWith("/api/profile") && (!init?.method || init.method === "GET")) return json({
      text: "## alex-morgan-cv.pdf\nAlex Morgan, product designer. 6 years in B2B SaaS: onboarding, billing, design systems.\n\n## portfolio-notes.md\nCheckout redesign that cut drop-off; design system for three product teams.",
      source: "files", updated: "2026-10-14T10:20:00Z", note: "",
      files: [
        { id: "f1", name: "alex-morgan-cv.pdf", chars: 4820, added: "2026-10-14T10:20:00Z" },
        { id: "f2", name: "portfolio-notes.md", chars: 1260, added: "2026-10-15T09:05:00Z" },
      ],
    });
    return real(input, init);
  };
}

/** Wraps a story / review state: live-looking store without a server. Switching and saving change local state only. */
export function EngineFixture({ engines, settings = SETTINGS, pull, limits, children }: {
  engines: EnginesResponse; settings?: Settings; pull?: OllamaPull; limits?: Partial<Record<EngineId, EngineLimits>>; children: ReactNode;
}) {
  installStub();
  const [list, setList] = useState(engines);
  const [cfg, setCfg] = useState(settings);
  const value = useMemo<AppStore>(() => {
    const selectedEngine = list.engines.find((e) => e.id === list.selected) ?? null;
    return {
      settings: cfg,
      engines: list,
      enginesLoading: false,
      selectedEngine,
      refreshEngines: async () => list,
      reloadSettings: async () => {},
      updateSettings: async (patch: SettingsPatch) => {
        const next: Settings = {
          ...cfg,
          ...(patch.engine ? { engine: patch.engine } : {}),
          ...(patch.voice !== undefined ? { voice: patch.voice } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ollama: { ...cfg.ollama, ...patch.ollama },
          openai_compatible: { ...cfg.openai_compatible, base_url: patch.openai_compatible?.base_url ?? cfg.openai_compatible.base_url, model: patch.openai_compatible?.model ?? cfg.openai_compatible.model },
          gemini_live: { ...cfg.gemini_live, has_api_key: patch.gemini_live?.api_key ? true : cfg.gemini_live.has_api_key },
        };
        setCfg(next);
        setList((cur) => ({
          selected: patch.engine ?? cur.selected,
          engines: cur.engines.map((e) => ({
            ...e,
            selected: e.id === (patch.engine ?? cur.selected),
            // Saving a base URL / a key turns those engines Ready, so the story can walk the whole flow.
            status: e.id === "openai_compatible" && patch.openai_compatible?.base_url ? STATUS.openai_compatible.ready
              : e.id === "gemini_live" && patch.gemini_live?.api_key ? STATUS.gemini_live.ready : e.status,
          })),
        }));
        return next;
      },
    };
  }, [list, cfg]);
  return (
    <AppStoreProvider value={value}>
      <OllamaPullPreview.Provider value={pull ?? null}>
        <LimitsOverride.Provider value={{ ...DEFAULT_LIMITS, ...limits }}>{children}</LimitsOverride.Provider>
      </OllamaPullPreview.Provider>
    </AppStoreProvider>
  );
}
