/* Shared parts of the three debrief variants (exploration for the owner, 2026-10-27; ds/screens/debrief-variants.md).
 * Not wired into the live app: the live DebriefView is unchanged. Each variant keeps the page header, the view switch
 * and "Practise again" exactly as they are, and swaps only the body of the Debrief view.
 * Built from the DS (`app/web/src/ds`) and the existing debrief parts (read-only reuse); local layout only. */
import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppShellView } from "../../../components/AppShell";
import { pageStyles } from "../../../components/Page";
import { Badge, Segmented, scrollBehavior } from "../../../ds";
import { OverlayRoot } from "../../../ds/OverlayRoot";
import { t } from "../../../i18n";
import type { LayerOrder, ScoreKey } from "../../../lib/types";
import { SHELL_ENGINE, SHELL_RECENT } from "../frames";
import { Header } from "../parts/Header";
import type { RowContext } from "../parts/Layers";
import { QuestionCard } from "../parts/QuestionCard";
import { PractiseAgain, SectionHead } from "../parts/Sections";
import { ExampleBanner } from "../parts/States";
import { STATIC_ACTIONS } from "../static";
import { layerSequence, type DebriefModel, type DebriefVariant, type Layer, type ScoreRowModel, type WeakSpotModel } from "../types";
import dv from "../DebriefView.module.css";
import sc from "../parts/scorecard.module.css";
import { questionHeadingId, weakestFirst } from "../parts/debriefShared";
import { ROW_LAYER } from "./copy";
import s from "./shared.module.css";

/* ------------------------------------------------------------------ frame ---- */

/** The page inside the full app shell at a real width, grown to the height of its content (so a full-page screenshot
 * shows everything), scaled down only when the canvas is narrower than the frame. */
export function FullStage({ width, route = "/sessions/s2", children }: { width: number; route?: string; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(900);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  useLayoutEffect(() => {
    const box = inner.current;
    const main = box?.querySelector("main");
    const page = main?.firstElementChild;
    if (!box || !main || !page) return;
    const measure = () => {
      const top = main.offsetTop;
      const need = Math.ceil(top + (page as HTMLElement).offsetHeight);
      setHeight((h) => (Math.abs(h - need) > 1 ? Math.max(need, 640) : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className={s.stageOuter} style={{ maxWidth: width, height: height * scale }} data-stage-width={width}>
      <div ref={inner} className={s.stageInner} style={{ width, height, transform: `scale(${scale})` }}>
        <OverlayRoot>
          <MemoryRouter initialEntries={[route]}>
            <AppShellView current={null} currentSessionId={route.split("?")[0]?.split("/").pop()} recent={SHELL_RECENT} engine={SHELL_ENGINE}>
              {children}
            </AppShellView>
          </MemoryRouter>
        </OverlayRoot>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page ---- */

export interface PageCtx {
  model: DebriefModel;
  variant: DebriefVariant;
  example: boolean;
  seq: Layer[];
  uid: string;
  /** Show question `n` in the per-question part and bring it into view (evidence and lost-points links). */
  jump: (n: number) => void;
  picked: number | undefined;
  setPicked: (n: number) => void;
  detail: RefObject<HTMLElement | null>;
}

export interface VariantPageProps {
  model: DebriefModel;
  variant?: DebriefVariant;
  layerOrder?: LayerOrder;
  /** The question open in the per-question part at start. */
  selected?: number;
  reviewId: string;
  /** Extra class on the body column (D: the body spans the header's width instead of the reading column). */
  bodyClassName?: string;
  children: (ctx: PageCtx) => ReactNode;
}

/** The debrief page as it is today down to the toolbar (banner, title, meta, "Debrief | Conversation", Practise again),
 * then the variant's body in the reading column. */
export function VariantPage({ model, variant = "interview", layerOrder = "content-first", selected, reviewId, bodyClassName, children }: VariantPageProps) {
  const uid = useId();
  const [picked, setPicked] = useState<number | undefined>(selected ?? model.questions[0]?.n);
  const detail = useRef<HTMLElement>(null);
  const example = variant === "example";
  const jump = (n: number) => {
    setPicked(n);
    window.requestAnimationFrame(() => {
      const target = detail.current?.querySelector<HTMLElement>(`[data-question="${n}"]`) ?? detail.current;
      target?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      document.getElementById(questionHeadingId(uid, n))?.focus({ preventScroll: true });
    });
  };
  return (
    <div className={`${pageStyles.page} ${dv.page} ${dv.fluid}`} data-review-id={reviewId} data-variant={variant}>
      {example ? <ExampleBanner onStart={STATIC_ACTIONS.onStartFirst} /> : null}
      <Header
        title={model.title}
        meta={model.meta}
        example={example}
        obsidian={model.obsidian}
        renaming={false}
        focusRename={false}
        onRenameStart={example ? undefined : () => {}}
        onRenameSave={() => {}}
        onRenameCancel={() => {}}
        onExport={STATIC_ACTIONS.onExport}
        onDownload={STATIC_ACTIONS.onDownload}
        onArchive={STATIC_ACTIONS.onArchive}
        onTrash={STATIC_ACTIONS.onTrash}
        toolbar={(
          <>
            <Segmented
              label={t("debrief.view.label")}
              hideLabel
              options={[
                { value: "debrief", label: t("debrief.view.debrief") },
                { value: "conversation", label: t("debrief.view.conversation") },
              ]}
              value="debrief"
              onChange={() => {}}
            />
            <PractiseAgain variant={variant} onPractise={STATIC_ACTIONS.onPractise} />
          </>
        )}
      />
      <div className={bodyClassName ? `${dv.debrief} ${bodyClassName}` : dv.debrief}>
        {children({ model, variant, example, seq: layerSequence(layerOrder), uid, jump, picked, setPicked, detail })}
      </div>
    </div>
  );
}

export { LayerTag, orderedPlan, orderedSpots, questionHeadingId, rowLabel, rowsLostIn, weakestFirst } from "../parts/debriefShared";

/* ------------------------------------------------------------------ question by question (today's part) ---- */

/** Static handlers for correction rows: everything is offered, nothing leaves the story. */
export const STATIC_ROWS: RowContext = {
  isDismissed: (_id, base) => Boolean(base),
  isLeaving: () => false,
  editing: null,
  focusEditor: false,
  onEdit: () => {},
  onDismiss: () => {},
  onRestore: () => {},
  onSave: () => {},
  onCancel: () => {},
};

/** "Question by question" as it is today: a number picker and one open breakdown (used by A and B unchanged). */
export function QuestionPicker({ ctx }: { ctx: PageCtx }) {
  const { model, seq, picked, setPicked, detail, uid } = ctx;
  const [stronger, setStronger] = useState(false);
  const current = model.questions.find((q) => q.n === picked) ?? model.questions[0];
  if (!current) return null;
  const id = `${uid}-questions`;
  return (
    <section className={dv.questions} aria-labelledby={id} data-review-id="DebriefVariant/Questions">
      <SectionHead id={id} title={t("debrief.qSection")} />
      <div ref={detail as RefObject<HTMLDivElement | null>} className={dv.detail} role="region" aria-label={t("debrief.convo.breakdown")}>
        {model.questions.length > 1 ? (
          <Segmented
            label={t("debrief.convo.pick")}
            hideLabel
            options={model.questions.map((q) => ({ value: String(q.n), label: String(q.n), title: q.question }))}
            value={String(current.n)}
            onChange={(v) => setPicked(Number(v))}
          />
        ) : null}
        <QuestionCard
          key={current.n}
          fixed
          q={current}
          order={seq}
          headerId={questionHeadingId(uid, current.n)}
          open
          onOpenChange={() => {}}
          strongerOpen={stronger}
          onStrongerOpenChange={setStronger}
          rows={STATIC_ROWS}
          rechecking={false}
          answerEditing={false}
          onEditAnswer={() => {}}
          focusEditor={false}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ small shared pieces ---- */

const SCALE = [
  { step: 0, key: "debrief.scale.notReady" },
  { step: 1, key: "debrief.scale.gettingThere" },
  { step: 2, key: "debrief.scale.ready" },
] as const;

/** The three-step scale as today (Badge live + check on the current step). Decorative; the headline carries the step for AT. */
export function ScaleBadges({ step }: { step: number }) {
  return (
    <ol className={s.scale} aria-hidden="true">
      {SCALE.map(({ step: n, key }) => (
        <li key={n}>{n === step ? <Badge tone="live" icon="check">{t(key)}</Badge> : <Badge tone="outline">{t(key)}</Badge>}</li>
      ))}
    </ol>
  );
}

/** Five segments and "3/5", the scorecard's own grammar (parts/scorecard.module.css). Spoken: "3 out of 5". */
export function ScoreMeter({ score, compact }: { score: number; compact?: boolean }) {
  return (
    <span className={sc.score}>
      <span className={`${sc.meter} ${compact ? s.meterCompact : ""}`} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= score ? `${sc.seg} ${sc.on}` : sc.seg} />)}
      </span>
      <span className={sc.num} aria-hidden="true">{t("debrief.score.value", { score })}</span>
      <span className="visually-hidden">{t("debrief.score.sr", { score })}</span>
    </span>
  );
}

/** Which scorecard row a weak spot explains. Language and delivery have one row each. A content spot goes to the
 * lowest content row that lost points in all of its questions (ties: scorecard order), unless the caller knows better
 * (`contentRow`): 🟡 the server knows the rubric tag (`no_result` → Structure and Result) and should send the row. */
export function spotRow(spot: WeakSpotModel, rows: readonly ScoreRowModel[], contentRow?: ScoreKey): ScoreKey | undefined {
  if (spot.layer !== "content") return spot.layer;
  if (contentRow) return contentRow;
  const ids = spot.evidence?.ids ?? [];
  const fits = weakestFirst(rows).filter((r) => ROW_LAYER[r.key] === "content" && ids.every((n) => r.lost.includes(n)));
  return fits[0]?.key;
}
