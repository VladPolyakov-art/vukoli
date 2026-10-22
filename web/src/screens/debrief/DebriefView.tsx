/* Debrief (ds/screens/debrief.md; variants interview · english · example). Pure: every state comes from props, so
 * stories and the review page render it without a server; `screens/Debrief.tsx` is the live container.
 * Structure after Otter's summary (R5): Verdict (overview) → What to work on (key points + actions) → Question by
 * question (outline with quotes). Layer tints live only here (CONTRACT §2.6); fixes are marked inside the user's own
 * sentence, never red / green (P8). Container queries on `page`, no viewport media queries.
 * D80: a saved interview opens on the conversation; the verdict is a folded bar above it (VerdictBar).
 * D71: "Question by question" is two columns: the whole conversation as a chat on the left, the breakdown of the picked
 * answer on the right (sticky). A narrow page stacks them, and picking an answer scrolls to its breakdown. */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Callout, Segmented, durationMs, scrollBehavior } from "../../ds";
import { t } from "../../i18n";
import { pageStyles } from "../../components/Page";
import { layerSequence, type DebriefViewProps } from "./types";
import { Header } from "./parts/Header";
import { Conversation, conversationFromQuestions } from "./parts/Conversation";
import { EnglishBody } from "./parts/English";
import type { RowContext } from "./parts/Layers";
import { QuestionCard } from "./parts/QuestionCard";
import { Actions, SectionHead, TemplateNote, Verdict, VerdictBar, VerdictNotice, WeakSpots } from "./parts/Sections";
import { ErrorBody, ExampleBanner, LoadingBody, NotFoundBody, PartialBanner, StorageBanner } from "./parts/States";
import s from "./DebriefView.module.css";

/** `n` rem in px (the sticky offset is --space-6 = 1.5rem). */
const remPx = (el: Element, n: number) => n * parseFloat(getComputedStyle(el.ownerDocument.documentElement).fontSize || "16");

export function DebriefView(props: DebriefViewProps) {
  const { variant, state, model, layerOrder, ui, buildUp, storageError, className } = props;
  const uid = useId();
  const root = `${pageStyles.page} ${s.page} ${buildUp && state === "ready" ? "motion-stagger" : ""} ${className ?? ""}`;
  const heading = <h1 className="visually-hidden">{t("debrief.title")}</h1>;

  const [picked, setPicked] = useState<number | undefined>(ui?.selected ?? ui?.open?.[0]);
  const detail = useRef<HTMLDivElement>(null);
  /** The breakdown's height cap: the visible height of <main> minus the sticky offset (D71). */
  const [detailMax, setDetailMax] = useState<number | undefined>(undefined);
  const [strongerOpen, setStrongerOpen] = useState<ReadonlySet<number>>(() => new Set(ui?.strongerOpen ?? []));
  const [renaming, setRenaming] = useState(ui?.renaming ?? false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ q: number; target: string; draft?: string } | null>(
    ui?.editing ? { q: ui.editing.question, target: ui.editing.correction } : null,
  );
  const [recheckingOwn, setRechecking] = useState<number | null>(ui?.rechecking ?? null);
  const rechecking = props.rechecking !== undefined ? props.rechecking : recheckingOwn;
  const [verdictOpen, setVerdictOpen] = useState(ui?.verdictOpen ?? false);
  const [dismissed, setDismissed] = useState<Readonly<Record<string, boolean>>>({});
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  /** Focus moves into a field only after the user opened it, never when a review state starts open. */
  const [userOpened, setUserOpened] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const hasDetail = state === "ready" && Boolean(model?.questions.length);
  useLayoutEffect(() => {
    const panel = detail.current;
    const main = panel?.closest("main");
    if (!hasDetail || !panel || !main) return;
    // Stacked (narrow) the panel is not sticky and takes its full height.
    const measure = () => setDetailMax(getComputedStyle(panel).position === "sticky" ? Math.max(0, main.clientHeight - 2 * remPx(main, 1.5)) : undefined);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    return () => ro.disconnect();
  }, [hasDetail]);

  if (state === "loading" || state === "preparing") {
    return (
      <div className={root} aria-busy="true">
        {heading}
        <LoadingBody preparing={state === "preparing"} />
      </div>
    );
  }
  if (state === "notFound") return <div className={root}>{heading}<NotFoundBody /></div>;
  if (state === "error" || !model) return <div className={root}>{heading}<ErrorBody onRetry={props.onRetry} /></div>;

  const canEdit = Boolean(props.onRecheck);
  const title = titleOverride ?? model.title;
  const seq = layerSequence(layerOrder);
  const headerId = (n: number) => `${uid}q${n}`;
  const key = (q: number, id: string) => `${q}:${id}`;

  const selected = model.questions.some((q) => q.n === picked) ? picked : model.questions[0]?.n;
  const current = model.questions.find((q) => q.n === selected);

  /** Show question `n` in the breakdown. Scroll to it only when it is out of view (the narrow, stacked layout, or a
   * weak-spot link above); `focus` moves focus to its heading (evidence links), a chat bubble keeps it. */
  const pick = (n: number, focus = false) => {
    setPicked(n);
    window.requestAnimationFrame(() => {
      const panel = detail.current;
      if (!panel) return;
      panel.scrollTop = 0;
      const top = panel.getBoundingClientRect().top;
      const viewport = panel.closest("main")?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
      if (top < viewport.top || top > viewport.top + (viewport.bottom - viewport.top) * 0.6) {
        panel.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      }
      if (focus) document.getElementById(headerId(n))?.focus({ preventScroll: true });
    });
  };
  const jump = (n: number) => pick(n, true);

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
  const turns = model.conversation?.length ? model.conversation : conversationFromQuestions(model.questions);
  const partial = Boolean(model.partial);
  const ids = { verdict: `${uid}-verdict`, spots: `${uid}-spots`, actions: `${uid}-actions`, questions: `${uid}-questions` };

  // D80: a saved interview opens on the conversation; the verdict, what to fix first and the next step fold into a bar.
  const folded = variant === "interview" && Boolean(model.verdict) && !partial;
  const verdictBlock = model.verdict && !partial ? (
    <Verdict verdict={model.verdict} id={folded ? `${ids.verdict}-body` : ids.verdict} bare={folded} note={model.verdictNotice === "template" ? <TemplateNote rerunning={props.rerunning} onRerun={props.onRerun} /> : undefined} />
  ) : null;
  const spotsBlock = !partial && !english && model.weakSpots.length ? <WeakSpots model={model} order={layerOrder} onJump={jump} id={ids.spots} /> : null;
  const actionsBlock = (
    <Actions
      variant={variant}
      model={model}
      english={english}
      partial={partial}
      storageError={storageError}
      onDrill={props.onDrill}
      onPractise={props.onPractise}
      onStartFirst={props.onStartFirst}
      id={ids.actions}
    />
  );

  return (
    <div className={root} data-review-id="Debrief/Page" data-variant={variant}>
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
      />

      {props.notice ? <Callout tone="error" live="alert">{props.notice}</Callout> : null}
      {partial ? <PartialBanner answered={model.partial!.answered} total={model.partial!.total} /> : null}
      {model.verdictNotice && model.verdictNotice !== "template" && !partial ? <VerdictNotice kind={model.verdictNotice} id={ids.verdict} rerunning={props.rerunning} onRerun={props.onRerun} /> : null}
      {folded ? (
        <VerdictBar verdict={model.verdict!} id={ids.verdict} open={verdictOpen} onOpenChange={setVerdictOpen}>
          {verdictBlock}
          {spotsBlock}
          {actionsBlock}
        </VerdictBar>
      ) : (
        <>
          {verdictBlock}
          {spotsBlock}
          {english ? (
            <EnglishBody english={english} ctx={rowsFor(0)} ids={{ summary: `${uid}-sum`, corrections: `${uid}-cor`, phrases: `${uid}-phr` }} />
          ) : null}
          {actionsBlock}
        </>
      )}

      {turns.length ? (
        <section className={s.questions} aria-labelledby={ids.questions} data-review-id="Debrief/Questions" data-review-section="Debrief · Conversation" data-comment-target="">
          <SectionHead id={ids.questions} title={t("debrief.convo.title")} sub={current ? t("debrief.convo.sub") : undefined} />
          <div className={`${s.split} ${current ? "" : s.single}`}>
            <div className={s.chat}>
              <Conversation turns={turns} questions={new Set(model.questions.map((q) => q.n))} selected={selected} onSelect={(n) => pick(n)} />
              {model.skipped ? (
                <p className={s.skipped}>
                  {model.skipped.from === model.skipped.to
                    ? t("debrief.partial.skippedOne", { n: model.skipped.from })
                    : t("debrief.partial.skipped", { from: model.skipped.from, to: model.skipped.to })}
                </p>
              ) : null}
            </div>
            {current ? (
              <div ref={detail} className={s.detail} style={detailMax ? { maxHeight: detailMax } : undefined} aria-label={t("debrief.convo.breakdown")} role="region">
                {model.questions.length > 1 ? (
                  <Segmented
                    label={t("debrief.convo.pick")}
                    hideLabel
                    options={model.questions.map((q) => ({ value: String(q.n), label: String(q.n), title: q.question, track: "debrief-question-pick" }))}
                    value={String(current.n)}
                    onChange={(v) => pick(Number(v))}
                  />
                ) : null}
                <QuestionCard
                  key={current.n}
                  fixed
                  q={current}
                  order={seq}
                  headerId={headerId(current.n)}
                  open
                  onOpenChange={() => {}}
                  strongerOpen={strongerOpen.has(current.n)}
                  onStrongerOpenChange={(v) => {
                    setStrongerOpen((prev) => { const n = new Set(prev); if (v) n.add(current.n); else n.delete(current.n); return n; });
                    if (v && current.stronger?.status === "idle") props.onStronger?.(current.n);
                  }}
                  rows={rowsFor(current.n)}
                  rechecking={rechecking === current.n}
                  answerEditing={editing?.q === current.n && editing.target === "answer"}
                  answerDraft={editing?.q === current.n ? editing.draft : undefined}
                  onEditAnswer={canEdit ? () => { setUserOpened(true); setEditing({ q: current.n, target: "answer" }); } : undefined}
                  onSaveAnswer={(text) => save(current.n, "answer", text)}
                  onCancelAnswer={() => setEditing(null)}
                  focusEditor={userOpened}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
