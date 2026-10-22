import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { EnginePanel, type EnginePanelProps } from "../EnginePanel";
import type { EngineId, EngineLimits } from "../../lib/types";
import { EngineFixture, LIMITS, NONE_READY, SETTINGS, makeEngines } from "./fixtures";

/* D78: Settings → AI engine is one view: the engine in use on top, the other engines under it, set up in place.
 * D81: Setup step 1 uses the same view (Pages/Setup). Fixture: no server; switching and saving change local state. */
const meta: Meta = { title: "Patterns/EnginePanel", parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj;

type Limits = Partial<Record<EngineId, EngineLimits>>;
function Stage({ engines, settings, limits, children }: { engines: ReturnType<typeof makeEngines>; settings?: typeof SETTINGS; limits?: Limits; children: ReactNode }) {
  return (
    <EngineFixture engines={engines} settings={settings} limits={limits}>
      <div style={{ maxWidth: "calc(var(--layout-narrow) + var(--space-16))" }}>{children}</div>
    </EngineFixture>
  );
}
const panel = (engines: ReturnType<typeof makeEngines>, props: EnginePanelProps, settings?: typeof SETTINGS, limits?: Limits): Story => ({
  render: () => <Stage engines={engines} settings={settings} limits={limits}><EnginePanel {...props} /></Stage>,
});

export const SettingsOllama: Story = panel(makeEngines(), {}, { ...SETTINGS, ollama: { ...SETTINGS.ollama, model: "qwen3:8b" } });
export const SettingsNotReady: Story = panel(NONE_READY, {});
export const SettingsOllamaNotInstalled: Story = panel(makeEngines({ ollama: "not_installed" }), {});
export const SettingsOllamaNoModel: Story = panel(makeEngines({ ollama: "no_model" }), {});
export const SettingsGemini: Story = panel(makeEngines({ gemini_live: "ready" }, "gemini_live"), {});
export const SettingsSetUpOpenAi: Story = panel(makeEngines(), { initialPick: "openai_compatible" });
export const SettingsSetUpClaude: Story = panel(makeEngines({ claude_cli: "not_installed" }), { initialPick: "claude_cli" });
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
