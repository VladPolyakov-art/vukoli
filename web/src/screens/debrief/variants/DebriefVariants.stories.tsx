import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ScoreKey } from "../../../lib/types";
import type { ScoreRowModel } from "../types";
import { verdictLine } from "../parts/verdictLine";
import { verdictFromRows } from "../verdictStep";
import { DebriefView } from "../DebriefView";
import { DEFAULT_OPEN, exampleSam, interviewLong, interviewS2 } from "../fixtures";
import { withQuestions } from "../moreQuestions";
import { STATIC_ACTIONS } from "../static";
import { FullStage } from "./shared";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import { LevelProgress, VariantD, levelProgress, type LevelLook } from "./VariantD";
import d from "./variantD.module.css";

/* Three ways to organise the Debrief view, for the owner to pick one (2026-10-27, ds/screens/debrief-variants.md).
 * Not wired into the app: the live DebriefView is unchanged ("Current" shows it in the same frame for comparison).
 * Each story is the page inside the full shell at a real width, grown to the page's height (full-page screenshots).
 * Data: the same fixtures as Screens/Debrief (Alex Morgan · Kestrel Pay; Sam Rivera example; the +30% stress set).
 * Light by default; dark from the toolbar. */
const meta: Meta = { title: "Debrief/Variants", parameters: { layout: "padded" } };
export default meta;

type Story = StoryObj;
const at = (width: number, node: React.ReactNode, route?: string): Story => ({
  render: () => <FullStage width={width} route={route}>{node}</FullStage>,
  ...(width < 600 ? { parameters: { viewport: { defaultViewport: "mobile1" } } } : {}),
});

const current = (
  <DebriefView {...STATIC_ACTIONS} variant="interview" state="ready" model={interviewS2} layerOrder="content-first" ui={{ view: "debrief", open: DEFAULT_OPEN.s2 }} />
);

/** Today's Debrief view, for comparison: verdict, three layer columns, plan, scorecard, question by question. */
export const Current = at(1440, current);
export const CurrentMobile = at(375, current);

/** A · One main focus: the top weak spot as one hero card (what you said → a stronger version, how it lands, how to fix,
 * the drill), the other two as a short ranked list, layers as tags, the scorecard folded into one line. */
export const A_OneFocus = at(1440, <VariantA model={interviewS2} selected={2} />);
export const A_OneFocusMobile = at(375, <VariantA model={interviewS2} selected={2} />);
/** A with the layer order set to delivery first (GR8): the delivery spot leads; a number has no "stronger version". */
export const A_DeliveryFirst = at(1440, <VariantA model={interviewS2} layerOrder="delivery-first" selected={2} />);
export const A_Example = at(1440, <VariantA model={exampleSam} variant="example" selected={3} />, "/sessions/example");
export const A_LongText = at(1440, <VariantA model={interviewLong} selected={2} />, "/sessions/s-long");

/** B · Skills, weakest first: one list of the seven scores; each row has its fix, the questions that lost points, and
 * (where a weak spot explains it) what you said and how it lands behind a fold. The plan and the drill sit next to the verdict. */
export const B_Skills = at(1440, <VariantB model={interviewS2} contentRow="result" selected={2} />);
export const B_SkillsMobile = at(375, <VariantB model={interviewS2} contentRow="result" selected={2} />);
export const B_Example = at(1440, <VariantB model={exampleSam} variant="example" selected={3} />, "/sessions/example");
export const B_LongText = at(1440, <VariantB model={interviewLong} contentRow="result" selected={2} />, "/sessions/s-long");

/** C · Question by question first: a short summary (verdict + drill, three takeaways, the scores as one strip), then
 * every question as an open card with its content, language and delivery notes in rows and the corrections inline. */
export const C_QuestionLed = at(1440, <VariantC model={interviewS2} />);
export const C_QuestionLedMobile = at(375, <VariantC model={interviewS2} />);
export const C_Example = at(1440, <VariantC model={exampleSam} variant="example" />, "/sessions/example");
export const C_LongText = at(1440, <VariantC model={interviewLong} />, "/sessions/s-long");

/** D · Question switcher (the owner's functional asks, 2026-10-27; v2 after his voice notes): a short summary with
 * "Your level" and one average score that opens the scorecard (hover = preview, click = pinned), the plan with the
 * drill in one block, then one question at a time behind a sticky switcher (1…N with the question's text, ←/→,
 * Previous / Next, `?q=n` in the URL). The body spans the header's width. */
export const D_Switcher = at(1440, <VariantD model={interviewS2} selected={1} />);
export const D_SwitcherMobile = at(375, <VariantD model={interviewS2} selected={1} />);
export const D_Example = at(1440, <VariantD model={exampleSam} variant="example" selected={3} />, "/sessions/example");
export const D_LongText = at(1440, <VariantD model={interviewLong} selected={2} />, "/sessions/s-long");
export const D_DeliveryFirst = at(1440, <VariantD model={interviewS2} layerOrder="delivery-first" selected={4} />);
/** D opened from a link with `?q=4`: the viewer starts on question 4 (a reload or a shared link keeps the question). */
export const D_OpenedFromLink = at(1440, <VariantD model={interviewS2} />, "/sessions/s2?view=debrief&q=4");

const ten = withQuestions(interviewS2, 10);
const twelve = withQuestions(interviewS2, 12);

/** D with 10 questions (the server's maximum): the labels no longer fit at 1440, so the switcher shows numbers only,
 * with Previous / Next at its ends. */
export const D_TenQuestions = at(1440, <VariantD model={ten} selected={7} />, "/sessions/s2?view=debrief&q=7");
/** D with 12 questions (past the cap, the degrade case): numbers only, still one row at 1440. */
export const D_TwelveQuestions = at(1440, <VariantD model={twelve} selected={12} />, "/sessions/s2?view=debrief&q=12");
/** 12 questions at 375: the numbers scroll sideways with an edge fade; the selected one is scrolled into view. */
export const D_TwelveQuestionsMobile = at(375, <VariantD model={twelve} selected={9} />, "/sessions/s2?view=debrief&q=9");
/** D at 1024 (rail + content): five labelled tabs still fit. */
export const D_SwitcherTablet = at(1024, <VariantD model={interviewS2} selected={1} />);

/* "Your level" as progress (owner, v3: "a nice progress bar"): three looks on the same four states, for the owner to
 * pick. C (blocks) is the owner's pick and the D default; A/B are kept here for the record. The position between two steps is derived from the scorecard (🟡, `levelProgress`). */
const row = (key: ScoreKey, score: number | null): ScoreRowModel => ({ key, score, answers: score === null ? 0 : 5, lost: [] });
const LEVEL_STATES: { note: string; rows: ScoreRowModel[]; sentence: string }[] = [
  {
    note: "Not ready yet · 2 of 4 answer skills at 3/5",
    rows: [row("structure", 2), row("own_part", 3), row("result", 2), row("relevance", 4), row("reflection", 2), row("language", 3), row("delivery", 3)],
    sentence: "Two answers stop before you say what you did.",
  },
  { note: "Getting there · Alex Morgan (3 of 7)", rows: interviewS2.scorecard ?? [], sentence: "Clear stories, but 3 of 5 answers end before the result." },
  { note: "Getting there · Sam Rivera example (5 of 6; English not asked)", rows: exampleSam.scorecard ?? [], sentence: "Strong stories; say more about your own part." },
  {
    note: "Ready",
    rows: [row("structure", 4), row("own_part", 5), row("result", 4), row("relevance", 5), row("reflection", 4), row("language", 4), row("delivery", null)],
    sentence: "Every answer had a result and a lesson.",
  },
];
function LevelSheet({ look, title }: { look: LevelLook; title: string }) {
  return (
    <div style={{ width: 1120, padding: "var(--space-10)", background: "var(--color-canvas)", color: "var(--color-text-primary)", display: "grid", gap: "var(--space-10)" }} data-level-sheet="">
      <p className={d.levelLabel} style={{ margin: 0, fontSize: "var(--text-md)" }}>{title}</p>
      {LEVEL_STATES.map((s) => {
        const v = verdictFromRows(s.rows, s.sentence, "Clear structure in every answer.");
        const data = levelProgress(v.step ?? 0, s.rows);
        const next = verdictLine(v);
        return (
          <section key={s.note} className={d.verdict} style={{ maxWidth: "48rem" }}>
            <p className={d.levelCaption} style={{ margin: 0 }}>{s.note}</p>
            <p className={d.headline}>{v.headline}</p>
            <p className={d.line}>{v.line}</p>
            {data ? <LevelProgress data={data} look={look} /> : null}
            {next ? <p className={d.next}>{next}</p> : null}
          </section>
        );
      })}
    </div>
  );
}
/** A · Track: one rail, a notch at "Getting there", a ring marker at the user's place, names under the stops. */
export const D_Level_A = { render: () => <LevelSheet look="track" title="A · Track with a marker" /> } satisfies Story;
/** B · Journey: three stops as discs on a thin line (passed = check, current = ring), the line fills toward the next. */
export const D_Level_B = { render: () => <LevelSheet look="journey" title="B · Journey with stops" /> } satisfies Story;
/** C · Blocks: the steps as one line of names, then one cell per skill that counts for the next step. */
export const D_Level_C = { render: () => <LevelSheet look="blocks" title="C · Skills as blocks" /> } satisfies Story;
