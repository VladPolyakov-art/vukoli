import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScaledStage } from "../frames";
import { Scene } from "./TalkScene";
import {
  negotiateAcceptedFirst, negotiateNoOffer, negotiateNotInWriting, negotiateStrong, toughModelFailed, toughNormal, toughOne, toughTwo,
} from "./fixtures";

/* Tough talk debriefs (ds/screens/tough-talk.md §5-§6): Negotiate salary (Your result · What moved the offer · Say it
 * better) and Tough questions (Summary · Questions). Fixtures in ./fixtures.ts; frames are the D109 islands with titles. */
const meta: Meta = { title: "Screens/Debrief tough talk", parameters: { layout: "padded" } };
export default meta;

type Story = StoryObj;
const desk = (props: Parameters<typeof Scene>[0], height = 1500): Story => ({ render: () => <ScaledStage width={1440} height={height}><Scene {...props} /></ScaledStage> });
const phone = (props: Parameters<typeof Scene>[0], height = 2400): Story => ({
  render: () => <ScaledStage width={375} height={height}><Scene {...props} /></ScaledStage>,
  parameters: { viewport: { defaultViewport: "mobile1" } },
});

/** Strong deal: a reasoned counter, then a step-up that is in the offer letter ("In the offer letter" with a check). */
export const NegotiateStrongDeal = desk({ record: negotiateStrong });
export const NegotiateStrongDealMobile = phone({ record: negotiateStrong });
/** The step-up was agreed in words only: "Not in writing" and the Say it better row that asks for it. */
export const NegotiateStepUpNotInWriting = desk({ record: negotiateNotInWriting });
/** Accepted the first offer: no deal line, no moves frame. */
export const NegotiateAcceptedFirstOffer = desk({ record: negotiateAcceptedFirst }, 1100);
/** Ended before any offer: a dash for the figure, an explanation and two tactic tiles. */
export const NegotiateNoOfferYet = desk({ record: negotiateNoOffer }, 1000);
export const NegotiateConversation = desk({ record: negotiateStrong, view: "conversation" }, 900);
export const NegotiateNotSaved = desk({ record: negotiateStrong, storageError: true });

/** Five answers: three calm, the one that hurt most linked from the summary, a personal question with the lawful note. */
export const ToughFiveAnswers = desk({ record: toughNormal });
export const ToughFiveAnswersMobile = phone({ record: toughNormal });
export const ToughQuestionTwo = desk({ record: toughNormal, q: 2 });
export const ToughPersonalQuestion = desk({ record: toughNormal, q: 4 });
/** The after-call check failed: code signals only (no quote), the answer shape and a quiet note. */
export const ToughModelFailed = desk({ record: toughModelFailed });
/** One or two answers: no counts. */
export const ToughTwoAnswers = desk({ record: toughTwo }, 1200);
export const ToughOneAnswer = desk({ record: toughOne }, 1100);
export const ToughConversation = desk({ record: toughNormal, view: "conversation" }, 1200);
