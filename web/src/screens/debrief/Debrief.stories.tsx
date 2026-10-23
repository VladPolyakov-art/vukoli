import type { Meta, StoryObj } from "@storybook/react-vite";
import { DebriefScene, ScaledStage, type DebriefSceneId } from "./frames";

/* Fixture: docs/ia.md §6 (Alex Morgan, Product Designer; S2 Kestrel Pay, S3 English; example = Sam Rivera, Brightline).
 * Each story is a frame of a real width, scaled to fit, with its own OverlayRoot — the set-up of the review page.
 * Light; dark with the toolbar. Spec: ds/screens/debrief.md §3 and §5. */
const meta: Meta = { title: "Screens/Debrief", parameters: { layout: "padded" } };
export default meta;

const desktop = (id: DebriefSceneId): StoryObj => ({
  render: () => <ScaledStage width={1440} height={900}><DebriefScene id={id} /></ScaledStage>,
});
const mobile = (id: DebriefSceneId): StoryObj => ({
  render: () => <ScaledStage width={375} height={812}><DebriefScene id={id} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/** §3.1–3.5: verdict, weak spots, actions, five cards; Q2 open with its stronger answer. */
export const InterviewFull = desktop("interviewFull");
export const InterviewFullMobile = mobile("interviewFull");
/** D80: the verdict bar above the conversation, opened. */
export const InterviewVerdictOpen = desktop("interviewVerdictOpen");
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
/** Stress fixture: +30% text, a very long title and token, one card without feedback. */
export const LongText = desktop("longText");
export const LongTextMobile = mobile("longText");
