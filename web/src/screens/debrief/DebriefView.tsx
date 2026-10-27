/* Debrief of a saved session (ds/screens/debrief.md; variants interview · english · example). Pure: every state comes
 * from props, so stories and the review page render it without a server; `screens/Debrief.tsx` is the live container.
 * The page opens on the debrief (D101, 2026-10-27); a Segmented switch under the title ("Debrief | Conversation",
 * `?view=conversation` in the URL) shows the conversation across the whole main area, with the jump between questions.
 * The debrief (layout D, 2026-10-27: the verdict with the level and the one score → plan + Drill → sticky question switcher → one
 * question at a time, after Otter's summary, R5; the seven skills open from the score). One
 * "Practise again" sits next to the switch in both views. A session with nothing to show (`model.empty`) has the
 * conversation only, and no switch. Layer tints live only in the debrief (CONTRACT §2.6); fixes are marked inside the
 * user's own sentence, never red / green (P8). Container queries on `page`, no viewport media queries. */
import { useEffect, useId, useRef, useState } from "react";
import { Callout, Segmented, durationMs, scrollBehavior } from "../../ds";
import { t } from "../../i18n";
import { pageStyles } from "../../components/Page";
import { layerSequence, type DebriefViewMode, type DebriefViewProps } from "./types";
import { Header } from "./parts/Header";
import { Conversation, conversationFromQuestions } from "./parts/Conversation";
import { EnglishBody } from "./parts/English";
import type { RowContext } from "./parts/Layers";
import { orderedPlan, orderedSpots, questionHeadingId } from "./parts/debriefShared";
import { Plan } from "./parts/Plan";
import { QuestionViewer } from "./parts/QuestionViewer";
import { Actions, PractiseAgain, TemplateNote, VerdictNotice } from "./parts/Sections";
import { Summary } from "./parts/Summary";
import { ErrorBody, ExampleBanner, LoadingBody, NotFoundBody, PartialBanner, StorageBanner } from "./parts/States";
import s from "./DebriefView.module.css";

export function DebriefView(props: DebriefViewProps) {
  const { variant, state, model, layerOrder, ui, buildUp, storageError, className } = props;
  const uid = useId();
  const root = `${pageStyles.page} ${s.page} ${buildUp && state === "ready" ? "motion-stagger" : ""} ${className ?? ""}`;
  const heading = <h1 className="visually-hidden">{t("debrief.title")}</h1>;

  const [pickedOwn, setPicked] = useState<number | undefined>(ui?.selected ?? ui?.open?.[0]);
  const picked = props.question ?? pickedOwn;
  const detail = useRef<HTMLElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** The question picked in the conversation's jump bar (it scrolls the chat to that question). */
  const [chatQ, setChatQ] = useState<number | undefined>(undefined);
  const [viewOwn, setViewOwn] = useState<DebriefViewMode>(ui?.view ?? "debrief");
  const [strongerOpen, setStrongerOpen] = useState<ReadonlySet<number>>(() => new Set(ui?.strongerOpen ?? []));
  const [renaming, setRenaming] = useState(ui?.renaming ?? false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ q: number; target: string; draft?: string } | null>(
    ui?.editing ? { q: ui.editing.question, target: ui.editing.correction } : null,
  );
  const [recheckingOwn, setRechecking] = useState<number | null>(ui?.rechecking ?? null);
  const rechecking = props.rechecking !== undefined ? props.rechecking : recheckingOwn;
  const [dismissed, setDismissed] = useState<Readonly<Record<string, boolean>>>({});
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  /** Focus moves into a field only after the user opened it, never when a review state starts open. */
  const [userOpened, setUserOpened] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  if (state === "loading" || state === "preparing") {
    return (
      <div className={root} aria-busy="true">
        {heading}
        <LoadingBody preparing={state === "preparing"} progress={props.progress} />
      </div>
    );
  }
  if (state === "notFound") return <div className={root}>{heading}<NotFoundBody /></div>;
  if (state === "error" || !model) return <div className={root}>{heading}<ErrorBody onRetry={props.onRetry} /></div>;

  const canEdit = Boolean(props.onRecheck);
  const title = titleOverride ?? model.title;
  const seq = layerSequence(layerOrder);
  const key = (q: number, id: string) => `${q}:${id}`;

  const selected = model.questions.some((q) => q.n === picked) ? picked : model.questions[0]?.n;
  const current = model.questions.find((q) => q.n === selected);

  const turns = model.conversation?.length ? model.conversation : conversationFromQuestions(model.questions);
  const hasDebrief = !model.empty;
  const view: DebriefViewMode = hasDebrief ? props.view ?? viewOwn : "conversation";
  const setView = (next: DebriefViewMode) => {
    setViewOwn(next);
    props.onViewChange?.(next);
    // The new view starts at its top, not where the other one was scrolled to.
    window.requestAnimationFrame(() => rootRef.current?.closest("main")?.scrollTo({ top: 0 }));
  };

  /** Switch the viewer to question `n` (the tabs, ←/→, Previous / Next); the URL follows (`?q=n`). */
  const select = (n: number) => {
    setPicked(n);
    props.onQuestionChange?.(n);
  };
  /** The links from the plan, the skills card and the chat: show question `n`, bring the viewer into view and move
   * focus to the question's heading. */
  const jump = (n: number) => {
    select(n);
    window.requestAnimationFrame(() => {
      detail.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      document.getElementById(questionHeadingId(uid, n))?.focus({ preventScroll: true });
    });
  };

  /** The questions Mike asked, for the jump in the conversation. */
  const asked = Array.from(new Set(turns.flatMap((x) => (x.opens && x.q !== undefined ? [x.q] : []))));
  const jumpChat = (n: number) => {
    setChatQ(n);
    chat.current?.querySelector<HTMLElement>(`[data-question="${n}"]`)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  };

  const dismiss = (q: number, id: string) => {
    const k = key(q, id);
    setLeaving((prev) => new Set(prev).add(k));
    timers.current.push(window.setTimeout(() => {
      setDismissed((prev) => ({ ...prev, [k]: true }));
      setLeaving((prev) => { const n = new Set(prev); n.delete(k); return n; });
    }, durationMs("--duration-exit")));
    props.onDismiss?.(q, id);
  };
  const restore = (q: number, id: string) => {
    setDismissed((prev) => ({ ...prev, [key(q, id)]: false }));
    props.onRestore?.(q, id);
  };
  const save = (q: number, target: string, text: string) => {
    setEditing(null);
    setRechecking(q);
    void props.onRecheck?.(q, target, text)?.then((ok) => { if (!ok) setEditing({ q, target, draft: text }); });
  };

  const rowsFor = (q: number): RowContext => ({
    isDismissed: (id, base) => dismissed[key(q, id)] ?? Boolean(base),
    isLeaving: (id) => leaving.has(key(q, id)),
    editing: editing && editing.q === q && editing.target !== "answer" ? editing.target : null,
    draft: editing?.q === q ? editing.draft : undefined,
    focusEditor: userOpened,
    onEdit: canEdit ? (id) => { setUserOpened(true); setEditing({ q, target: id }); } : undefined,
    onDismiss: props.onDismiss ? (id) => dismiss(q, id) : undefined,
    onRestore: props.onRestore ? (id) => restore(q, id) : undefined,
    onSave: (id, text) => save(q, id, text),
    onCancel: () => setEditing(null),
  });

  const english = variant === "english" ? model.english : undefined;
  const partial = Boolean(model.partial);
  const ids = { verdict: `${uid}-verdict`, plan: `${uid}-plan`, actions: `${uid}-actions`, questions: `${uid}-questions` };

  /* Interview and example with a verdict: the summary (verdict, level, the one score with the skills card), the plan with
   * the page's only primary button, then the questions. A partial session has no verdict block, no plan. */
  const summaryBlock = model.verdict && !partial ? (
    <Summary
      verdict={model.verdict}
      rows={model.scorecard}
      id={ids.verdict}
      uid={uid}
      note={model.verdictNotice === "template" ? <TemplateNote rerunning={props.rerunning} onRerun={props.onRerun} /> : undefined}
      onJump={jump}
    />
  ) : null;
  const showDrill = variant !== "english" && !partial && Boolean(model.drill || model.plan?.some((p) => p.drill));
  const planWanted = !partial && !english;
  const planSteps = planWanted && model.verdict ? orderedPlan(model.plan, seq) : [];
  const planSpots = planWanted && model.verdict ? orderedSpots(model.weakSpots, seq) : [];
  const planBlock = planWanted && (planSteps.length || planSpots.length || showDrill) ? (
    <Plan steps={planSteps} spots={planSpots} id={ids.plan} drill={model.drill} showDrill={showDrill} example={variant === "example"} storageError={storageError} onDrill={props.onDrill} onJump={jump} />
  ) : null;
  const actionsBlock = (
    <Actions
      variant={variant}
      model={model}
      partial={partial}
      storageError={storageError}
      drillInPlan
      onDrill={props.onDrill}
      id={ids.actions}
    />
  );

  return (
    <div ref={rootRef} className={`${root} ${s.fluid}`} data-review-id="Debrief/Page" data-variant={variant}>
      {storageError ? <StorageBanner onDownload={props.onDownload} /> : null}
      {variant === "example" ? <ExampleBanner onStart={props.onStartFirst} /> : null}

      <Header
        title={title}
        meta={storageError ? model.meta.map((m) => (m.href ? { icon: "alert" as const, text: t("debrief.notSaved"), tone: "warning" as const } : m)) : model.meta}
        example={variant === "example"}
        obsidian={model.obsidian}
        renaming={renaming}
        focusRename={userOpened}
        onRenameStart={props.onRename ? () => { setUserOpened(true); setRenaming(true); } : undefined}
        onRenameSave={(next) => {
          setTitleOverride(next);
          setRenaming(false);
          const saved = props.onRename?.(next);
          if (saved instanceof Promise) void saved.then((ok) => { if (ok === false) setTitleOverride(null); });
        }}
        onRenameCancel={() => setRenaming(false)}
        onExport={props.onExport}
        onDownload={props.onDownload}
        onArchive={props.onArchive}
        onTrash={props.onTrash}
        toolbar={(
          <>
            {hasDebrief ? (
              <Segmented
                label={t("debrief.view.label")}
                hideLabel
                options={[
                  { value: "debrief", label: t("debrief.view.debrief") },
                  { value: "conversation", label: t("debrief.view.conversation") },
                ] satisfies { value: DebriefViewMode; label: string }[]}
                value={view}
                onChange={setView}
                track="debrief-view"
              />
            ) : null}
            <PractiseAgain variant={variant} english={english} partial={partial} storageError={storageError} onPractise={props.onPractise} />
          </>
        )}
      />

      {props.notice ? <Callout tone="error" live="alert">{props.notice}</Callout> : null}
      {partial ? <PartialBanner answered={model.partial!.answered} total={model.partial!.total} /> : null}

      {view === "debrief" ? (
        <div className={`${s.debrief} ${english ? "" : s.wide}`} data-review-id="Debrief/DebriefView">
          {model.verdictNotice && model.verdictNotice !== "template" && !partial ? <VerdictNotice kind={model.verdictNotice} id={ids.verdict} rerunning={props.rerunning} onRerun={props.onRerun} /> : null}
          {english ? null : summaryBlock}
          {planBlock}
          {english ? (
            <EnglishBody english={english} ctx={rowsFor(0)} ids={{ summary: `${uid}-sum`, corrections: `${uid}-cor`, phrases: `${uid}-phr` }} />
          ) : null}
          {actionsBlock}
          {current ? (
            <QuestionViewer
              questions={model.questions}
              current={current.n}
              onSelect={select}
              uid={uid}
              id={ids.questions}
              sectionRef={detail}
              view={{
                seq,
                spots: orderedSpots(model.weakSpots, seq),
                scorecard: model.verdict && !partial ? model.scorecard : undefined,
                rows: rowsFor(current.n),
                rechecking: rechecking === current.n,
                answerEditing: editing?.q === current.n && editing.target === "answer",
                answerDraft: editing?.q === current.n ? editing.draft : undefined,
                onEditAnswer: canEdit ? () => { setUserOpened(true); setEditing({ q: current.n, target: "answer" }); } : undefined,
                onSaveAnswer: (text) => save(current.n, "answer", text),
                onCancelAnswer: () => setEditing(null),
                focusEditor: userOpened,
                strongerOpen: strongerOpen.has(current.n),
                onStrongerOpenChange: (v) => {
                  setStrongerOpen((prev) => { const n = new Set(prev); if (v) n.add(current.n); else n.delete(current.n); return n; });
                  if (v && current.stronger?.status === "idle") props.onStronger?.(current.n);
                },
              }}
            />
          ) : null}
        </div>
      ) : (
        <section className={s.chat} aria-labelledby={ids.questions} data-review-id="Debrief/Conversation" data-review-section="Debrief · Conversation" data-comment-target="">
          <h2 id={ids.questions} className="visually-hidden">{t("debrief.convo.title")}</h2>
          {asked.length > 1 ? (
            <div className={s.jump}>
              <span className={s.jumpLabel} aria-hidden="true">{t("debrief.convo.pick")}</span>
              <Segmented
                label={t("debrief.convo.jump")}
                hideLabel
                options={asked.map((n) => ({ value: String(n), label: String(n), title: t("debrief.q.number", { n }), track: "debrief-question-jump" }))}
                value={String(chatQ ?? asked[0])}
                onChange={(v) => jumpChat(Number(v))}
              />
            </div>
          ) : null}
          <div ref={chat}>
            <Conversation turns={turns} />
          </div>
          {model.skipped ? (
            <p className={s.skipped}>
              {model.skipped.from === model.skipped.to
                ? t("debrief.partial.skippedOne", { n: model.skipped.from })
                : t("debrief.partial.skipped", { from: model.skipped.from, to: model.skipped.to })}
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
