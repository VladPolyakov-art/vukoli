import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent } from "storybook/test";
import { DebriefScene, ScaledStage, type DebriefSceneId } from "./frames";

/* Fixture: docs/ia.md §6 (Alex Morgan, Product Designer; S2 Kestrel Pay, S3 English; example = Sam Rivera, Brightline).
 * Each story is a frame of a real width, scaled to fit, with its own OverlayRoot — the set-up of the review page.
 * Light; dark with the toolbar. Spec: ds/screens/debrief.md §3 and §5; the Debrief view is layout D (2026-10-27, debrief-variants.md). */
const meta: Meta = { title: "Screens/Debrief", parameters: { layout: "padded" } };
export default meta;

const desktop = (id: DebriefSceneId): StoryObj => ({
  render: () => <ScaledStage width={1440} height={900}><DebriefScene id={id} /></ScaledStage>,
});
const mobile = (id: DebriefSceneId): StoryObj => ({
  render: () => <ScaledStage width={375} height={812}><DebriefScene id={id} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/** The second view of a saved session (the first, Debrief, is the default; D101): the conversation across the whole main area, "Debrief | Conversation" and "Practise again" under the title, the jump between questions on top of the chat. */
export const InterviewConversation = desktop("interviewConversation");
export const InterviewConversationMobile = mobile("interviewConversation");
/** The Debrief view (the default, layout D): verdict and level with the one score, the plan with Drill, the sticky question switcher, then Q2 with its feedback list and its stronger answer. */
export const InterviewFull = desktop("interviewFull");
export const InterviewFullMobile = mobile("interviewFull");
/** The Debrief view, the verdict first. */
export const InterviewVerdictOpen = desktop("interviewVerdictOpen");
/** Opened from a link with `?q=4`: the viewer starts on question 4. */
export const InterviewOpenedOnQuestion4 = desktop("interviewQ4");
export const InterviewOpenedOnQuestion4Mobile = mobile("interviewQ4");
/** The score "3.3/5 · Average of 7 skills" with its skills card open to the left (it opens on hover or focus, as a sheet on a phone). */
export const SkillsCardOpen: StoryObj = {
  render: () => <ScaledStage width={1440} height={900}><DebriefScene id="interviewVerdictOpen" /></ScaledStage>,
  play: async ({ canvasElement }) => {
    const score = canvasElement.querySelector<HTMLElement>('[data-review-id="Debrief/Score"]');
    if (score) await userEvent.hover(score);
  },
};
/** D98 (US-20 AC6-AC8): "Not asked this time" skills appear under the card's list, never as rows with a score. */
export const ScorecardNullRows = desktop("interviewNullRows");
/** D98: a weak spot with no verified fragment leaves out "What you said". Delivery spots show a number instead of a quote. */
export const WeakSpotWithoutQuote = desktop("interviewNoQuote");
/** D98: an older debrief has no scorecard and no plan: no score, no "Lost points on", the weak spots stand in the plan block. */
export const NoPlan = desktop("interviewNoPlan");
/** A verdict with no step (written before the steps existed): the level is derived from the scorecard, the headline stays the model's sentence. */
export const VerdictWithoutStep = desktop("interviewNoStep");
/** D98: one weak spot, one plan step. */
export const OnePlanStep = desktop("interviewOnePlanStep");
/** Ten questions (the server's maximum): the switcher shows numbers only with ‹ › at 1440. */
export const TenQuestions = desktop("interviewTen");
/** Twelve questions (past the cap): numbers only, still one row. */
export const TwelveQuestions = desktop("interviewTwelve");
/** Twelve questions at 375: the numbers scroll sideways with an edge fade; the selected one stays in view. */
export const TwelveQuestionsMobile = mobile("interviewTwelve");
/** The same debrief with the layer order from Settings set to delivery first (GR8). */
export const InterviewDeliveryFirst = desktop("interviewDeliveryFirst");
/** The title is being renamed in place (US-23 AC2). */
export const InterviewRename = desktop("interviewRename");
/** Q2: the "Not what you said?" editor on the first correction. */
export const InterviewRecheck = desktop("interviewRecheck");
/** Q2 after Save and check again: shimmer line and skeleton, the rest unchanged. */
export const InterviewRechecking = desktop("interviewRechecking");
/** Q2 checked again from the corrected text: "Edited by you" on the card. */
export const InterviewEdited = desktop("interviewEdited");
/** The check failed (engine slow or down): nothing changed, a callout says why. */
export const InterviewRecheckFailed = desktop("interviewRecheckFailed");
/** §3.6: summary, corrections in order with their turn, phrases to review. */
export const English = desktop("english");
export const EnglishMobile = mobile("english");
/** A clean English session: no phrases to review, so the action is a plain "Practise again" without a hint. */
export const EnglishNoPhrases = desktop("englishNoPhrases");
/** F-13-7: no corrections: "No corrections this time." instead of an empty Corrections heading. */
export const EnglishNoCorrections = desktop("englishNoCorrections");
/** QA-14: a typed talk: rows say "You typed" and the subtitle does not explain "Heard as". */
export const EnglishTyped = desktop("englishTyped");
/** §3.7: a fictional debrief (Sam Rivera) with the banner; Q3 open. */
export const Example = desktop("exampleContentFirst");
export const ExampleDeliveryFirst = desktop("exampleDeliveryFirst");
export const ExampleMobile = mobile("exampleContentFirst");
/** US-20 AC4: under 3 answers there is no verdict and no weak spots. */
export const Partial = desktop("partial");
export const PartialMobile = mobile("partial");
export const Loading = desktop("loading");
export const LoadingMobile = mobile("loading");
/** Right after a session: "Writing your debrief…" above the skeleton. */
export const Preparing = desktop("preparing");
/** D96: feedback is made after the call; "Preparing feedback · 2 of 5 answers" above the skeleton. */
export const PreparingFeedback = desktop("preparingFeedback");
/** US-23 AC4: the warning comes first, Download is the primary action, Drill steps back. */
export const StorageNotWritable = desktop("storageNotWritable");
export const NotFound = desktop("notFound");
export const Error = desktop("error");
/** Stress fixture: +30% text, a very long title and token, one question without feedback. */
export const LongText = desktop("longText");
export const LongTextMobile = mobile("longText");
/** Stress fixture, the Conversation view: the chat with a very long title and a long token. */
export const LongTextConversation = desktop("longTextConversation");
export const LongTextConversationMobile = mobile("longTextConversation");
