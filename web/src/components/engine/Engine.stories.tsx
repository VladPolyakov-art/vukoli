import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, type ReactNode } from "react";
import { EnginePanel, type EnginePanelProps } from "../EnginePanel";
import type { EngineId, EngineLimits, OllamaModelsResponse, OllamaPull } from "../../lib/types";
import { EngineFixture, LIMITS, MODELS_WITHOUT_BIG, NONE_READY, PULL_DOWNLOADING, SETTINGS, makeEngines } from "./fixtures";

/* D78: Settings → AI engine is one view: the engine in use on top, the other engines under it, set up in place.
 * D81: Setup step 1 uses the same view (Pages/Setup). Fixture: no server; switching and saving change local state. */
const meta: Meta = { title: "Patterns/EnginePanel", parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj;

type Limits = Partial<Record<EngineId, EngineLimits>>;
interface Ollama { models?: OllamaModelsResponse; pull?: OllamaPull; startAnswer?: "ok" | "busy"; signIn?: "opened" | "closed" }
function Stage({ engines, settings, limits, ollama, children }: { engines: ReturnType<typeof makeEngines>; settings?: typeof SETTINGS; limits?: Limits; ollama?: Ollama; children: ReactNode }) {
  return (
    <EngineFixture engines={engines} settings={settings} limits={limits} {...ollama}>
      <div style={{ maxWidth: "calc(var(--layout-narrow) + var(--space-16))" }}>{children}</div>
    </EngineFixture>
  );
}
/** Story helper: presses "Sign in" once the panel is on screen, so the story shows the state after the press. */
function PressSignIn({ children }: { children: ReactNode }) {
  useEffect(() => {
    const id = window.setTimeout(() => document.querySelector<HTMLButtonElement>('[data-track="engine-sign-in"]')?.click(), 150);
    return () => window.clearTimeout(id);
  }, []);
  return <>{children}</>;
}
const panel = (engines: ReturnType<typeof makeEngines>, props: EnginePanelProps, settings?: typeof SETTINGS, limits?: Limits, ollama?: Ollama): Story => ({
  render: () => <Stage engines={engines} settings={settings} limits={limits} ollama={ollama}><EnginePanel {...props} /></Stage>,
});

export const SettingsOllama: Story = panel(makeEngines(), {}, { ...SETTINGS, ollama: { ...SETTINGS.ollama, model: "qwen3:8b" } });
/** The bigger model isn't on the computer: it is listed as "not downloaded"; picking it starts the download. */
export const SettingsOllamaNotDownloaded: Story = panel(makeEngines(), {}, undefined, undefined, { models: MODELS_WITHOUT_BIG });
/** A download is running (also what Settings shows when it is opened mid-download). */
export const SettingsOllamaDownloading: Story = panel(makeEngines(), {}, undefined, undefined, { models: MODELS_WITHOUT_BIG, pull: PULL_DOWNLOADING });
/** Pick the not-downloaded model while another download runs: the server's "busy" message appears. */
export const SettingsOllamaPullError: Story = panel(makeEngines(), {}, undefined, undefined, { models: MODELS_WITHOUT_BIG, startAnswer: "busy" });
/** D117: "Feedback after the call" set to an engine that is not ready (the server falls back to the conversation engine). */
export const SettingsDebriefOtherEngine: Story = panel(makeEngines({ claude_cli: "ready" }), {}, { ...SETTINGS, debrief_engine: "claude_cli" });
export const SettingsDebriefNotReady: Story = panel(makeEngines({ codex_cli: "not_installed" }), {}, { ...SETTINGS, debrief_engine: "codex_cli" });
export const SettingsNotReady: Story = panel(NONE_READY, {});
export const SettingsOllamaNotInstalled: Story = panel(makeEngines({ ollama: "not_installed" }), {});
export const SettingsOllamaNoModel: Story = panel(makeEngines({ ollama: "no_model" }), {});
export const SettingsGemini: Story = panel(makeEngines({ gemini_live: "ready" }, "gemini_live"), {});
export const SettingsSetUpOpenAi: Story = panel(makeEngines(), { initialPick: "openai_compatible" });
export const SettingsSetUpClaude: Story = panel(makeEngines({ claude_cli: "not_installed" }), { initialPick: "claude_cli" });
/** Claude Code is installed but signed out: "Sign in" is the primary action; the command stays under it as a fallback. */
export const SettingsClaudeSignedOut: Story = panel(makeEngines({ claude_cli: "signed_out" }), { initialPick: "claude_cli" });
/** Same, after pressing "Sign in": the terminal window opened. (The story presses it for you.) */
export const SettingsClaudeSignInOpened: Story = {
  render: () => (
    <Stage engines={makeEngines({ claude_cli: "signed_out" })} ollama={{ signIn: "opened" }}><PressSignIn><EnginePanel initialPick="claude_cli" /></PressSignIn></Stage>
  ),
};
/** Same, but no terminal could be opened: the command to copy. */
export const SettingsClaudeSignInNoTerminal: Story = {
  render: () => (
    <Stage engines={makeEngines({ claude_cli: "signed_out" })} ollama={{ signIn: "closed" }}><PressSignIn><EnginePanel initialPick="claude_cli" /></PressSignIn></Stage>
  ),
};
export const SettingsCodexSignedOut: Story = panel(makeEngines({ codex_cli: "signed_out" }), { initialPick: "codex_cli" });
export const SettingsDisconnected: Story = panel(makeEngines({ ollama: "disconnected" }), {});
export const SettingsSetUpGemini: Story = panel(makeEngines(), { initialPick: "gemini_live" });

/* D88: the plan's limit under the engine in use; every window and what the numbers mean under "Connection". */
export const LimitCodex: Story = panel(makeEngines({ codex_cli: "ready" }, "codex_cli"), {});
export const LimitClaude: Story = panel(makeEngines({ claude_cli: "ready" }, "claude_cli"), {});
export const LimitClaudeLow: Story = panel(makeEngines({ claude_cli: "ready" }, "claude_cli"), {}, undefined, { claude_cli: LIMITS.claudeLow });
export const LimitClaudeUsedUp: Story = panel(makeEngines({ claude_cli: "ready" }, "claude_cli"), {}, undefined, { claude_cli: LIMITS.claudeUsedUp });
export const LimitClaudePending: Story = panel(makeEngines({ claude_cli: "ready" }, "claude_cli"), {}, undefined, { claude_cli: LIMITS.claudePending });
export const LimitAntigravity: Story = panel(makeEngines({ antigravity_cli: "ready" }, "antigravity_cli"), {});
export const LimitGemini: Story = panel(makeEngines({ gemini_live: "ready" }, "gemini_live"), {});
