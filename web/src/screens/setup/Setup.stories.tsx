import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScaledStage } from "../debrief/frames";
import { SetupScene, type SetupSceneId } from "./frames";

/* Setup wizard (D81): AI engine → Check → About you. Fixtures: components/engine/fixtures.tsx, docs/ia.md §6. Each story
 * is a frame of a real width, scaled to fit. Light; dark with the toolbar. */
const meta: Meta = { title: "Screens/Setup", parameters: { layout: "padded" } };
export default meta;

const desktop = (id: SetupSceneId): StoryObj => ({
  render: () => <ScaledStage width={1440} height={900}><SetupScene id={id} /></ScaledStage>,
});
const mobile = (id: SetupSceneId): StoryObj => ({
  render: () => <ScaledStage width={375} height={812}><SetupScene id={id} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/** First run, Ollama is Ready: it is picked for you (it is the recommended one) and Continue is enabled. */
export const EngineFirst = desktop("engineFirst");
export const EngineFirstMobile = mobile("engineFirst");
/** First run, nothing is Ready: nothing is picked and Continue waits for a pick. */
export const EngineNoneReady = desktop("engineNoneReady");
export const EngineNoneReadyMobile = mobile("engineNoneReady");
/** Ollama picked and Ready. */
export const EnginePicked = desktop("enginePicked");
/** Ollama picked but not installed: "Download Ollama" right under it. */
export const EngineNoOllama = desktop("engineNoOllama");
export const EngineNoOllamaMobile = mobile("engineNoOllama");
/** Ollama picked, installed but not running: how to start it. */
export const EngineNotRunning = desktop("engineNotRunning");
export const EngineNoClaude = desktop("engineNoClaude");
export const EngineDisconnected = desktop("engineDisconnected");
export const EngineDisconnectedMobile = mobile("engineDisconnected");
export const EngineNoClaudeMobile = mobile("engineNoClaude");
export const EngineNoModel = desktop("engineNoModel");
export const EngineDownloading = desktop("engineDownloading");
export const EngineDownloadingMobile = mobile("engineDownloading");
export const EngineDownloadCancelled = desktop("engineDownloadCancelled");
export const EngineDownloadFailed = desktop("engineDownloadFailed");
export const EngineClaudeConnect = desktop("engineClaudeConnect");
export const EngineClaudeSignedOut = desktop("engineClaudeSignedOut");
export const EngineClaudeSignedOutMobile = mobile("engineClaudeSignedOut");
export const EngineNoCodex = desktop("engineNoCodex");
export const EngineCodexSignedOut = desktop("engineCodexSignedOut");
export const EngineCodexConnect = desktop("engineCodexConnect");
export const EngineCodexConnectMobile = mobile("engineCodexConnect");
export const EngineCodexReady = desktop("engineCodexReady");
export const EngineNoAntigravity = desktop("engineNoAntigravity");
export const EngineAntigravitySignedOut = desktop("engineAntigravitySignedOut");
export const EngineAntigravitySignedOutMobile = mobile("engineAntigravitySignedOut");
export const EngineAntigravityConnect = desktop("engineAntigravityConnect");
export const EngineAntigravityReady = desktop("engineAntigravityReady");
export const CheckIdle = desktop("checkIdle");
export const CheckIdleMobile = mobile("checkIdle");
export const CheckListening = desktop("checkListening");
export const CheckListeningMobile = mobile("checkListening");
export const CheckThinking = desktop("checkThinking");
/** One exchange done: what was heard, Mike's answer in the chosen voice, telemetry unticked, "It works". */
export const CheckDone = desktop("checkDone");
export const CheckDoneMobile = mobile("checkDone");
export const CheckMicDenied = desktop("checkMicDenied");
export const CheckNotHeard = desktop("checkNotHeard");
export const CheckEngineError = desktop("checkEngine");
/** Q8: changing the voice failed: "Couldn't save: …" above the rows, like Settings. */
export const CheckSaveError = desktop("checkSaveError");
export const CheckSaveErrorMobile = mobile("checkSaveError");
export const About = desktop("about");
/** Q8: the name could not be saved: the error shows above the rows. */
export const AboutSaveError = desktop("aboutSaveError");
export const AboutFilled = desktop("aboutFilled");
export const AboutFilledMobile = mobile("aboutFilled");
