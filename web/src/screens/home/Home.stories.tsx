import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomeScene, ScaledStage } from "./frames";
import type { HomeSceneId } from "./states";

/* Home v2 (ds/screens/home.md v2 §5): the start screen and the scripted setup chat. Fixture: docs/ia.md §6 (Alex
 * Morgan, Product Designer; Kestrel Pay / Lumen Health / Fieldnote). Each story is a frame of a real width, scaled to
 * fit, with its own OverlayRoot — the same set-up as the review page — and stays playable. Dark with the toolbar. */
const meta: Meta = { title: "Screens/Home", parameters: { layout: "padded" } };
export default meta;

const desktop = (id: HomeSceneId): StoryObj => ({
  render: () => <ScaledStage width={1440} height={900}><HomeScene id={id} /></ScaledStage>,
});
const mobile = (id: HomeSceneId): StoryObj => ({
  render: () => <ScaledStage width={375} height={812}><HomeScene id={id} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/* ---- start screen (§3) ---- */
export const StartReturning = desktop("returning");
export const StartReturningMobile = mobile("returning");
export const StartFirstVisit = desktop("firstVisit");
/** D73: after End — Home with the saving toast, then the "saved · Open debrief" toast. */
export const AfterEndSaving = desktop("afterEndSaving");
export const AfterEndSaved = desktop("afterEndSaved");
export const StartNoName = desktop("noName");
export const StartEnglish = desktop("english");
export const StartModeMenu = desktop("modeMenu");
export const StartTyped = desktop("typed");
export const StartPasted = desktop("pasted");
export const StartFileAttached = desktop("fileAttached");
export const StartLoading = desktop("loading");
export const StartEngineNotRunning = desktop("engineDown");
export const StartBrowserUnsupported = desktop("browserUnsupported");
export const StartStorageUnreadable = desktop("storageError");
export const StartOverflow = desktop("overflowStart");
export const StartOverflowMobile = mobile("overflowStart");
/* Quick start (D51 item 1, Gemini layout D52/D53): the round mic at the composer's end — on StartReturning (Kestrel Pay ·
 * Behavioural) and StartFirstVisit (General questions · Unseen mix); text or a file turns it into Send (StartTyped,
 * StartFileAttached); typing → keyboard icon; disabled on StartLoading / StartEngineNotRunning; none in StartEnglish. */
export const QuickStartTextMode = desktop("quickTextMode");
export const QuickStartPressed = desktop("quickStarting");
/* QA-02: the remembered job's questions are still being written: the mic is off until they are ready. */
export const QuickStartWaiting = desktop("quickWaiting");

/* ---- setup chat (§4) ---- */
export const SetupJobReading = desktop("jobReading");
export const SetupJobPasted = desktop("jobPasted");
export const SetupLinkFetching = desktop("linkFetching");
export const SetupLinkError = desktop("linkError");
export const SetupFileReading = desktop("fileReading");
export const SetupFileError = desktop("fileError");
export const SetupAskJob = desktop("askJob");
export const SetupAskJobMobile = mobile("askJob");
export const SetupSavedJobPicked = desktop("savedJobPicked");
export const SetupKeywordMatch = desktop("keywordMatch");
export const SetupAskRound = desktop("askRound");
export const SetupAskAnything = desktop("askAnything");
/* D89: a file in the chat: + / paste / drop on the composer. At T3 it is the CV, at T1 the job. */
export const SetupAskAnythingNoCv = desktop("askAnythingNoCv");
export const SetupCvAttached = desktop("cvAttached");
export const SetupCvAttachedMobile = mobile("cvAttached");
export const SetupCvReading = desktop("cvReading");
export const SetupCvAdded = desktop("cvAdded");
export const SetupCvError = desktop("cvError");
export const SetupJobFileInChat = desktop("jobFileInChat");
export const SetupDictating = desktop("dictating");
export const SetupDictatingMobile = mobile("dictating");
export const SetupDictationError = desktop("dictationError");
export const SetupRoundNotCaught = desktop("roundNotCaught");
export const SetupFreeTextNote = desktop("freeTextNote");
export const SetupPlan = desktop("plan");
export const SetupPlanMobile = mobile("plan");
/* QA-02: "Preparing questions…" — Start interview and Type instead are off, the note says when they unlock. */
export const SetupPlanPreparing = desktop("planPreparing");
export const SetupPlanPreparingMobile = mobile("planPreparing");
export const SetupPlanPrepError = desktop("planPrepError");
export const SetupPlanNoCv = desktop("planNoCv");
export const SetupPlanEngineDown = desktop("planEngineDown");
export const SetupPlanTextMode = desktop("planTextMode");
export const SetupPlanChangeOpen = desktop("planChangeOpen");
export const SetupSkipped = desktop("skipped");
export const SetupAgain = desktop("again");
export const SetupDrill = desktop("drill");
export const SetupDrillPlan = desktop("drillPlan");
export const SetupExample = desktop("example");
export const SetupEnglishLevel = desktop("englishLevel");
export const SetupEnglishPhrases = desktop("englishPhrases");
export const SetupEnglishPlan = desktop("englishPlan");
export const SetupStarting = desktop("starting");
export const SetupOverflow = desktop("overflowSetup");
export const SetupOverflowMobile = mobile("overflowSetup");
