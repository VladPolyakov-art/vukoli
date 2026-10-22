/* Scenes of the Setup wizard (D81) for stories and the review page: each step inside SetupFrame, every state from props.
 * Fixtures: components/engine/fixtures.tsx (no server) and docs/ia.md §6 (Alex Morgan) — never the owner's data. */
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { EngineFixture, NONE_READY, PULL_CANCELLED, PULL_DOWNLOADING, PULL_FAILED, PULL_IDLE, SETTINGS, makeEngines } from "../../components/engine/fixtures";
import type { OllamaPull, Settings } from "../../lib/types";
import { AboutStep } from "./AboutStep";
import { CheckStep } from "./CheckStep";
import { EngineStep } from "./EngineStep";
import { SetupFrame } from "./SetupFrame";
import type { CheckState } from "./types";

const noop = () => {};
const withModel: Settings = { ...SETTINGS, ollama: { ...SETTINGS.ollama, model: "qwen3:8b" } };
const named: Settings = { ...withModel, name: "Alex", voice: "am_eric" };
const HEARD = "Hi Mike, can you hear me?";
const SAVE_ERROR = "The app server is not answering.";
const REPLY = "Loud and clear, Alex. Let's get you ready for that interview.";

type Engines = ReturnType<typeof makeEngines>;
interface SetupSceneSpec { engines?: Engines; settings?: Settings; pull?: OllamaPull; render: () => ReactNode }

const check = (initial: CheckState, level?: number, speaking?: boolean) => () =>
  <SetupFrame step="check"><CheckStep onNext={noop} onBack={noop} onEngine={noop} initial={initial} level={level} speaking={speaking} /></SetupFrame>;

export const SETUP_SCENES = {
  engineFirst: { render: () => <SetupFrame step="engine"><EngineStep onNext={noop} /></SetupFrame> },
  enginePicked: { render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame> },
  engineNoOllama: {
    engines: makeEngines({ ollama: "not_installed", claude_cli: "not_installed" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame>,
  },
  engineDisconnected: {
    engines: makeEngines({ ollama: "disconnected" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame>,
  },
  engineNoClaude: {
    engines: makeEngines({ ollama: "not_installed", claude_cli: "not_installed" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="claude_cli" /></SetupFrame>,
  },
  engineNoModel: {
    engines: makeEngines({ ollama: "no_model", claude_cli: "unverified" }), settings: SETTINGS, pull: PULL_IDLE,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame>,
  },
  engineDownloading: {
    engines: makeEngines({ ollama: "no_model", claude_cli: "unverified" }), settings: SETTINGS, pull: PULL_DOWNLOADING,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame>,
  },
  engineDownloadCancelled: {
    engines: makeEngines({ ollama: "no_model" }), settings: SETTINGS, pull: PULL_CANCELLED,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame>,
  },
  engineDownloadFailed: {
    engines: makeEngines({ ollama: "no_model" }), settings: SETTINGS, pull: PULL_FAILED,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame>,
  },
  engineClaudeConnect: {
    engines: makeEngines({ ollama: "no_model", claude_cli: "unverified" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="claude_cli" /></SetupFrame>,
  },
  engineClaudeSignedOut: {
    engines: makeEngines({ ollama: "no_model", claude_cli: "signed_out" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="claude_cli" /></SetupFrame>,
  },
  engineNoCodex: {
    engines: makeEngines({ ollama: "no_model", codex_cli: "not_installed" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="codex_cli" /></SetupFrame>,
  },
  engineCodexSignedOut: {
    engines: makeEngines({ ollama: "no_model", codex_cli: "signed_out" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="codex_cli" /></SetupFrame>,
  },
  engineCodexConnect: {
    engines: makeEngines({ ollama: "no_model", codex_cli: "unverified" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="codex_cli" /></SetupFrame>,
  },
  engineCodexReady: {
    engines: makeEngines({ ollama: "no_model", codex_cli: "ready" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="codex_cli" /></SetupFrame>,
  },
  engineNoAntigravity: {
    engines: makeEngines({ ollama: "no_model", antigravity_cli: "not_installed" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="antigravity_cli" /></SetupFrame>,
  },
  engineAntigravitySignedOut: {
    engines: makeEngines({ ollama: "no_model", antigravity_cli: "signed_out" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="antigravity_cli" /></SetupFrame>,
  },
  engineAntigravityConnect: {
    engines: makeEngines({ ollama: "no_model", antigravity_cli: "unverified" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="antigravity_cli" /></SetupFrame>,
  },
  engineAntigravityReady: {
    engines: makeEngines({ ollama: "no_model", antigravity_cli: "ready" }), settings: SETTINGS,
    render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="antigravity_cli" /></SetupFrame>,
  },
  /** Nothing is ready on this computer: nothing is picked, Continue waits for a pick. */
  engineNoneReady: { engines: NONE_READY, settings: SETTINGS, render: () => <SetupFrame step="engine"><EngineStep onNext={noop} /></SetupFrame> },
  engineNotRunning: { engines: NONE_READY, settings: SETTINGS, render: () => <SetupFrame step="engine"><EngineStep onNext={noop} initialPick="ollama" /></SetupFrame> },
  checkIdle: { render: check({ phase: "idle" }) },
  checkListening: { render: check({ phase: "listening" }, 0.55) },
  checkThinking: { render: check({ phase: "thinking", heard: HEARD }) },
  checkDone: { render: check({ phase: "done", heard: HEARD, reply: REPLY, audio: "fixture" }, undefined, true) },
  checkMicDenied: { render: check({ phase: "error", code: "mic_denied" }) },
  checkNotHeard: { render: check({ phase: "error", code: "not_heard" }) },
  checkEngine: { render: check({ phase: "error", code: "engine", heard: HEARD, message: "Ollama isn't running." }) },
  /** Q8: changing the voice failed — the same error callout as Settings, above the rows. */
  checkSaveError: {
    render: () => <SetupFrame step="check"><CheckStep onNext={noop} onBack={noop} onEngine={noop} initial={{ phase: "idle" }} initialSaveError={SAVE_ERROR} /></SetupFrame>,
  },
  about: { settings: { ...named, name: "" }, render: () => <SetupFrame step="about"><AboutStep onBack={noop} /></SetupFrame> },
  /** Q8: the name could not be saved — Start stays on the step once, the typed name stays in the field. */
  aboutSaveError: {
    settings: { ...named, name: "" },
    render: () => <SetupFrame step="about"><AboutStep onBack={noop} initialSaveError={SAVE_ERROR} /></SetupFrame>,
  },
  aboutFilled: { settings: named, render: () => <SetupFrame step="about"><AboutStep onBack={noop} initialJob="Product Designer · Lumen" /></SetupFrame> },
} satisfies Record<string, SetupSceneSpec>;
export type SetupSceneId = keyof typeof SETUP_SCENES;

export function SetupScene({ id }: { id: SetupSceneId }) {
  const spec: SetupSceneSpec = SETUP_SCENES[id];
  return (
    <EngineFixture engines={spec.engines ?? makeEngines()} settings={spec.settings ?? named} pull={spec.pull}>
      <MemoryRouter initialEntries={["/setup"]}>{spec.render()}</MemoryRouter>
    </EngineFixture>
  );
}
