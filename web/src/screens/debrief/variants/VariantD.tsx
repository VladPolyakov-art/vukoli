/* Variant D · "Question switcher" (ds/screens/debrief-variants.md §D). Built from the owner's functional asks
 * (2026-10-27), not from A/B/C:
 *  1. a final score, with the scorecard hidden until asked for ("where did I lose points");
 *  2. walk through every question with a switcher: how I answered and the feedback on it, one question at a time;
 *  3. less scrolling: click 1, 2, 3 instead of reading one long page.
 * v2 (owner's voice notes on D, 2026-10-27): the verdict scale is one labelled 3-step track ("Your level"), not three
 * chips; the scorecard opens from the score itself (hover = preview, click / Enter = pinned; a sheet under the score
 * on narrow screens) instead of a "Where you lost points" fold; the switcher shows numbers only when the labels do not
 * fit and then scrolls sideways with an edge fade, Previous / Next at its ends; the body spans the header's width.
 * v3 (owner, same day): "Your level" is a progress bar toward Ready (owner picked C `blocks`, the default; `track` / `journey` stay for the Level stories); the skills panel rows are name + "3/5" + lost points, no meters;
 * the skills open on HOVER (no pin for a mouse; focus, Enter / Space and tap are the fallbacks), to the left of the score,
 * top-aligned with it, two columns wide; under the score when there is no room, a sheet under 640px.
 * Order: a short summary (verdict, level, one average score), the plan with the drill (weak spots folded into it),
 * then the question viewer: a sticky switcher, one question at a time (question, answer, one list of notes with a small
 * layer tag each, the stronger answer behind a fold), Previous / Next, ←/→ on the switcher, `?q=2` in the URL. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Callout, Card, Disclosure, Icon, IconButton, Swap, durationMs, scrollBehavior, useOverlayRoot } from "../../../ds";
import { OverlayPortal } from "../../../ds/OverlayRoot";
import { OVERLAY_NARROW_MAX, cssPx, focusables, place, useOutsidePress } from "../../../ds/overlay";
import type { DurationToken } from "../../../ds/motion";
import { nextIndex } from "../../../ds/roving";
import { t, tp } from "../../../i18n";
import { drillHintText } from "../parts/drillHint";
import { RemovedLines } from "../parts/Layers";
import { Marked } from "../parts/Marked";
import { QuestionLinks } from "../parts/QuestionLinks";
import { Said } from "../parts/Sections";
import { verdictLine } from "../parts/verdictLine";
import type { QuestionModel, WeakSpotModel } from "../types";
import { CONTENT_ROWS } from "../verdictStep";
import card from "../parts/card.module.css";
import { COPY } from "./copy";
import { LayerTag, VariantPage, orderedPlan, orderedSpots, questionHeadingId, rowLabel, rowsLostIn, weakestFirst, type PageCtx } from "./shared";
import type { VariantProps } from "./VariantA";
import d from "./variantD.module.css";

export function VariantD({ level = "blocks", ...props }: VariantProps & { level?: LevelLook }) {
  // The selected question lives in the URL (`?q=2`): a reload or a shared link opens the same question.
  const [params] = useSearchParams();
  const fromUrl = Number(params.get("q"));
  const selected = props.model.questions.some((q) => q.n === fromUrl) ? fromUrl : props.selected;
  return (
    <VariantPage {...props} selected={selected} reviewId="DebriefVariant/D" bodyClassName={d.wide}>
      {(ctx) => <Body ctx={ctx} level={level} />}
    </VariantPage>
  );
}

function Body({ ctx, level }: { ctx: PageCtx; level: LevelLook }) {
  const [params, setParams] = useSearchParams();
  const { picked } = ctx;
  useEffect(() => {
    if (picked === undefined || params.get("q") === String(picked)) return;
    const next = new URLSearchParams(params);
    next.set("q", String(picked));
    setParams(next, { replace: true });
  }, [picked, params, setParams]);
  // One tighter rhythm than the page's sections (--space-10): the summary blocks are short and belong together.
  return (
    <div className={d.stack}>
      <Summary ctx={ctx} level={level} />
      <PlanBlock ctx={ctx} />
      <Viewer ctx={ctx} />
    </div>
  );
}

/* ------------------------------------------------------------------ summary ---- */

/** The one final score: the plain average of the scored rows (rubric §9.1), one decimal. 🟡 New: not in the rubric yet. */
function average(rows: PageCtx["model"]["scorecard"]): { value: string; n: number } | null {
  const scored = (rows ?? []).filter((r) => r.score !== null).map((r) => r.score as number);
  if (!scored.length) return null;
  const mean = scored.reduce((a, b) => a + b, 0) / scored.length;
  return { value: (Math.round(mean * 10) / 10).toFixed(1), n: scored.length };
}

function Summary({ ctx, level }: { ctx: PageCtx; level: LevelLook }) {
  const v = ctx.model.verdict;
  if (!v) return null;
  const next = verdictLine(v);
  const avg = average(ctx.model.scorecard);
  const progress = v.step !== undefined ? levelProgress(v.step, ctx.model.scorecard) : null;
  const id = `${ctx.uid}-verdict`;
  return (
    <section className={d.summary} aria-labelledby={id} data-review-id="DebriefVariant/D/Summary">
      <div className={d.verdict}>
        <h2 id={id} className="visually-hidden">{t("debrief.verdict")}</h2>
        <p className={d.headline}>{v.headline}</p>
        {v.line ? <p className={d.line}>{v.line}</p> : null}
        {progress ? <LevelProgress data={progress} look={level} /> : null}
        {next ? <p className={d.next}>{next}</p> : null}
      </div>
      {avg ? <ScoreSkills ctx={ctx} value={avg.value} n={avg.n} /> : null}
    </section>
  );
}

const LEVELS = ["debrief.scale.notReady", "debrief.scale.gettingThere", "debrief.scale.ready"] as const;

/** Three looks of "Your level" for the owner to pick (v3, 2026-10-27): `blocks` (owner's pick, 2026-10-27, default), `track`, `journey` (kept for the D_Level_A/B stories). */
export type LevelLook = "track" | "journey" | "blocks";

export interface LevelProgressData {
  step: 0 | 1 | 2;
  /** 0…1 along the whole path: Not ready yet at 0, Getting there at ½, Ready at 1. */
  pos: number;
  /** Skills already past the next step's bar, of the skills that count for it. */
  done: number;
  total: number;
}

/** 🟡 Derived, not in the rubric: where the user stands between two steps, from the same rule as the step (D99,
 * verdictStep.ts). Not ready yet → Getting there: the answer rows (structure, your part, result, on the question) at
 * 3/5 or more. Getting there → Ready: every shown row at 4/5 or more. `total − done` is exactly the verdict's `gap`. */
export function levelProgress(step: number, rows: readonly { key: string; score: number | null }[] | undefined): LevelProgressData | null {
  const shown = (rows ?? []).filter((r): r is { key: string; score: number } => typeof r.score === "number");
  if (!shown.length) return null;
  if (step >= 2) return { step: 2, pos: 1, done: shown.length, total: shown.length };
  if (step === 1) {
    const done = shown.filter((r) => r.score >= 4).length;
    return { step: 1, pos: 0.5 + 0.5 * (done / shown.length), done, total: shown.length };
  }
  const pool = shown.filter((r) => (CONTENT_ROWS as readonly string[]).includes(r.key));
  const done = pool.filter((r) => r.score >= 3).length;
  return { step: 0, pos: pool.length ? 0.5 * (done / pool.length) : 0, done, total: pool.length };
}

/** "Your level" as progress toward Ready: the three steps stay named and the user's place is marked, and the bar
 * between two steps fills by the skills already past the next bar. Not a control: no hover, no pointer. The fill grows
 * once on load (`--duration-slower`, `--ease-enter`; 0 under reduced motion, global.css). One sentence for AT. */
export function LevelProgress({ data, look = "blocks" }: { data: LevelProgressData; look?: LevelLook }) {
  const name = t(LEVELS[data.step]);
  const next = data.step < 2 ? t(LEVELS[data.step + 1]!) : null;
  const caption = COPY.levelCaption(data.step, data.done, data.total);
  const toGo = next ? COPY.levelToGo(data.total - data.done, next) : null;
  const pct = `${Math.round(data.pos * 1000) / 10}%`;
  const sr = `${COPY.levelSr(name, data.step + 1)} ${caption}${toGo ? `, ${toGo}` : ""}.`;
  const names = LEVELS.map((key, i) => (
    <li key={key} className={`${d.stopName} ${i < data.step ? d.passed : ""} ${i === data.step ? d.here : ""}`}>{t(key)}</li>
  ));

  if (look === "blocks") {
    // One cell per skill that counts for the next step, the ones already there first.
    const cells = Array.from({ length: data.total }, (_, i) => i < data.done);
    return (
      <div className={`${d.level} ${d.levelBlocks}`} role="img" aria-label={sr} data-review-id="DebriefVariant/D/Level">
        <div className={d.levelHead} aria-hidden="true">
          <span className={d.levelLabel}>{COPY.level}</span>
          <ol className={d.crumbs}>{names}</ol>
        </div>
        <div className={d.cells} aria-hidden="true">
          {cells.map((on, i) => (
            <span key={i} className={on ? `${d.cell} ${d.cellOn}` : d.cell} style={on ? { animationDelay: `calc(var(--duration-stagger) * ${i})` } : undefined} />
          ))}
        </div>
        <p className={d.levelCaption} aria-hidden="true">
          <span className={d.captionStrong}>{caption}</span>
          {toGo ? <span> · {toGo}</span> : null}
        </p>
      </div>
    );
  }

  return (
    <div className={`${d.level} ${look === "journey" ? d.levelJourney : d.levelTrack}`} role="img" aria-label={sr} data-review-id="DebriefVariant/D/Level">
      <div className={d.levelHead} aria-hidden="true">
        <span className={d.levelLabel}>{COPY.level}</span>
        <span className={d.levelCaption}>
          <span className={d.captionStrong}>{caption}</span>
          {toGo ? <span> · {toGo}</span> : null}
        </span>
      </div>
      <div className={d.rail} aria-hidden="true">
        <span className={d.railFill} style={{ width: pct }} />
        {look === "journey" ? (
          [0, 1, 2].map((i) => (
            <span key={i} className={`${d.node} ${i < data.step || data.step === 2 ? d.nodeDone : ""} ${i === data.step && data.step < 2 ? d.nodeHere : ""}`} data-at={i}>
              {i < data.step || data.step === 2 ? <Icon name="check" size="sm" /> : null}
            </span>
          ))
        ) : (
          <>
            <span className={d.tick} data-at="1" />
            <span className={d.marker} style={{ left: pct }} />
          </>
        )}
      </div>
      <ol className={d.stops} aria-hidden="true">{names}</ol>
    </div>
  );
}

/* ------------------------------------------------------------------ score → skills, on hover, to the side ---- */

type PopMode = "closed" | "hover" | "held";

/** Where the skills panel goes: to the LEFT of the score, top edges aligned (the score sits at the right edge), as
 * wide as the room between the content's left edge and the score allows (up to `--layout-dialog`,
 * at least `--layout-panel` − `--space-10`). No such room (narrow page, or the score has wrapped under the verdict):
 * under the score, right-aligned; under 640px of overlay width a full-width sheet (the Menu's rules, `place`). */
function useSidePanel(active: boolean, anchor: RefObject<HTMLElement | null>, floating: RefObject<HTMLElement | null>, container: HTMLElement | null) {
  const [style, setStyle] = useState<CSSProperties>({ left: 0, top: 0, visibility: "hidden" });
  const [side, setSide] = useState<"left" | "bottom" | "top">("left");
  const measure = useCallback(() => {
    const a = anchor.current;
    const f = floating.current;
    if (!a || !f) return;
    const ar = a.getBoundingClientRect();
    let ox = 0;
    let oy = 0;
    let scale = 1;
    let space = { width: document.documentElement.clientWidth, height: window.innerHeight };
    if (container) {
      const cr = container.getBoundingClientRect();
      space = { width: container.clientWidth, height: container.clientHeight };
      scale = space.width ? cr.width / space.width : 1;
      ox = cr.left;
      oy = cr.top;
    }
    const box = { left: (ar.left - ox) / scale, top: (ar.top - oy) / scale, width: ar.width / scale, height: ar.height / scale };
    const pad = cssPx(f, "--layout-gutter", 16);
    const gap = cssPx(f, "--space-2", 8);
    // The content column's left edge: the summary row the score sits in.
    const row = a.closest<HTMLElement>("[data-review-id='DebriefVariant/D/Summary']");
    const contentLeft = row ? (row.getBoundingClientRect().left - ox) / scale : pad;
    const room = box.left - gap - Math.max(pad, contentLeft);
    const maxW = cssPx(f, "--layout-dialog", 560);
    const minW = cssPx(f, "--layout-panel", 440) - cssPx(f, "--space-10", 40);
    if (space.width >= OVERLAY_NARROW_MAX && room >= minW) {
      const width = Math.min(maxW, room);
      const maxHeight = Math.max(0, space.height - pad * 2);
      const height = Math.min(f.scrollHeight, maxHeight);
      const top = Math.max(pad, Math.min(box.top, space.height - pad - height));
      setSide("left");
      setStyle({ left: box.left - gap - width, top, width, maxHeight });
      return;
    }
    const p = place(box, space, { placement: "bottom-end", floating: { width: f.offsetWidth, height: f.scrollHeight }, pad, gap: cssPx(f, "--space-1", 4), sheetWhenNarrow: true });
    setSide(p.side === "top" ? "top" : "bottom");
    setStyle({ left: p.left, top: p.top, width: p.width, maxHeight: p.maxHeight });
  }, [anchor, floating, container]);

  useLayoutEffect(() => {
    if (!active) {
      setStyle({ left: 0, top: 0, visibility: "hidden" });
      return;
    }
    measure();
  }, [active, measure]);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro && floating.current) ro.observe(floating.current);
    if (ro && container) ro.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro?.disconnect();
    };
  }, [active, measure, floating, container]);
  return { style, side };
}

/** The final score shows the scorecard on HOVER (owner, v3: "on hover, not on click"): no pin step for a
 * mouse. Pointer on the score → opens after `--duration-fast`; the pointer can travel into the panel (grace
 * `--duration-slow`, so a diagonal move does not close it) and click its question links; leaving both closes it.
 * Accessible fallbacks open the same panel and keep it until Esc, ×, a press outside or a link: keyboard focus
 * (preview), Enter / Space (focus moves into it), a touch tap. Local: a DS `Popover` / hover-card candidate. */
function ScoreSkills({ ctx, value, n }: { ctx: PageCtx; value: string; n: number }) {
  const [mode, setMode] = useState<PopMode>("closed");
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const focusIn = useRef(false);
  const pointer = useRef<string>("mouse");
  const { container } = useOverlayRoot();
  const open = mode !== "closed";
  const pos = useSidePanel(open, anchor, panel, container);
  const panelId = `${ctx.uid}-skills`;
  const headId = `${panelId}-title`;

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (fn: () => void, token: DurationToken) => {
    clear();
    timer.current = window.setTimeout(fn, durationMs(token));
  };
  const close = (refocus = false) => {
    clear();
    setMode("closed");
    if (refocus) anchor.current?.focus({ preventScroll: true });
  };
  const leaveSoon = () => later(() => setMode((m) => (m === "hover" ? "closed" : m)), "--duration-slow");
  useEffect(() => clear, []);
  useOutsidePress(open, [anchor, panel], () => close());
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(Boolean(panel.current?.contains(document.activeElement)) || document.activeElement === anchor.current);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  // Opened from the keyboard: focus goes to the panel's heading, so Tab walks its question links.
  useLayoutEffect(() => {
    if (mode !== "held" || !focusIn.current) return;
    focusIn.current = false;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [mode]);

  const onClick = (e: ReactMouseEvent) => {
    clear();
    if (e.detail === 0) {
      // Enter / Space: open and move focus in (a second press closes).
      if (mode === "held") return close();
      focusIn.current = true;
      return setMode("held");
    }
    // A tap toggles; a mouse click changes nothing (hover already opened it), so there is no pin step.
    if (pointer.current === "touch") setMode((m) => (m === "held" ? "closed" : "held"));
    else setMode((m) => (m === "closed" ? "hover" : m));
  };
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const list = focusables(panel.current);
    const first = list[0];
    const last = list[list.length - 1];
    const head = panel.current.querySelector("[data-autofocus]");
    const leaving = e.shiftKey ? document.activeElement === first || document.activeElement === head : document.activeElement === last;
    if (leaving) {
      e.preventDefault();
      close(true);
    }
  };

  const rows = ctx.model.scorecard ?? [];
  const ordered = weakestFirst(rows);
  const skipped = rows.filter((r) => r.score === null).map((r) => rowLabel(r.key));
  const jump = (q: number) => {
    close();
    ctx.jump(q);
  };

  return (
    <div className={d.score}>
      <button
        ref={anchor}
        type="button"
        className={d.scoreBtn}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-track="debrief-score-skills"
        data-review-id="DebriefVariant/D/Score"
        onPointerDown={(e) => { pointer.current = e.pointerType; }}
        onClick={onClick}
        onPointerEnter={(e) => {
          pointer.current = e.pointerType;
          if (e.pointerType === "touch") return;
          if (mode === "closed") later(() => setMode((m) => (m === "closed" ? "hover" : m)), "--duration-fast");
          else clear();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "touch") return;
          if (mode === "closed") return clear();
          if (mode !== "hover") return;
          const to = e.relatedTarget as Node | null;
          if (to && panel.current?.contains(to)) return clear();
          leaveSoon();
        }}
        onFocus={(e) => { if (mode === "closed" && e.currentTarget.matches(":focus-visible")) setMode("hover"); }}
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null;
          if (mode === "hover" && to && !panel.current?.contains(to)) close();
        }}
      >
        <span className={d.scoreValue} aria-hidden="true">{value}<span className={d.scoreOf}>{COPY.outOf}</span></span>
        <span className="visually-hidden">{COPY.averageSr(value)} </span>
        <span className={d.scoreMore}>
          <span className={d.scoreMoreText}>{COPY.average(n)}</span>
          <Icon name="info" size="sm" />
        </span>
      </button>
      {open ? (
        <OverlayPortal>
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-labelledby={headId}
            className={`${d.pop} ${pos.side === "left" ? d.popLeft : pos.side === "top" ? d.popTop : d.popBottom}`}
            style={pos.style}
            data-mode={mode}
            data-side={pos.side}
            data-review-id="DebriefVariant/D/Scorecard"
            onPointerEnter={(e) => { if (e.pointerType !== "touch") clear(); }}
            onPointerLeave={(e) => {
              if (e.pointerType === "touch" || mode !== "hover") return;
              const to = e.relatedTarget as Node | null;
              if (to && anchor.current?.contains(to)) return clear();
              leaveSoon();
            }}
            onKeyDown={onPanelKey}
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null;
              if (mode === "hover" && to && !panel.current?.contains(to) && to !== anchor.current) close();
            }}
          >
            <div className={d.popHead}>
              <h3 id={headId} className={d.popTitle} tabIndex={-1} data-autofocus="">{COPY.skillsTitle}</h3>
              <IconButton icon="x" size="sm" label={COPY.close} onClick={() => close(true)} />
            </div>
            <p className={d.muted}>{t("debrief.score.sub")}</p>
            <ul className={d.skills} aria-label={t("debrief.score.list")}>
              {ordered.map((r) => (
                <li key={r.key} className={d.skill}>
                  <span className={d.skillLabel}>{rowLabel(r.key)}</span>
                  <span className={d.skillScore} aria-hidden="true">{t("debrief.score.value", { score: r.score })}</span>
                  <span className="visually-hidden">{t("debrief.score.sr", { score: r.score })}</span>
                  <span className={d.skillLost}>
                    {r.lost.length ? <>{tp("debrief.score.lost", r.lost.length)} <QuestionLinks ids={r.lost} onJump={jump} /></> : COPY.noPointsLost}
                  </span>
                </li>
              ))}
            </ul>
            {skipped.length ? <p className={d.muted}>{t("debrief.score.notAsked", { labels: skipped.join(", ") })}</p> : null}
            <p className={d.muted}>{t("debrief.misheard.note")}</p>
          </div>
        </OverlayPortal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ plan + drill ---- */

function PlanBlock({ ctx }: { ctx: PageCtx }) {
  const plan = orderedPlan(ctx.model.plan, ctx.seq);
  const spots = orderedSpots(ctx.model.weakSpots, ctx.seq);
  const drill = ctx.model.drill;
  if (!plan.length && !drill) return null;
  const id = `${ctx.uid}-plan`;
  return (
    <Card as="section" padding="md" className={d.plan} aria-labelledby={id} data-review-id="DebriefVariant/D/Plan">
      <div className={d.planHead}>
        <h2 id={id} className={d.label}>{COPY.planCard}</h2>
        <div className={d.drill}>
          <p className={d.hint}>{ctx.example ? t("debrief.example.own") : drill ? drillHintText(drill) : null}</p>
          <Button variant="primary" icon="play" data-track="drill-start" disabled={ctx.example}>{t("debrief.drill")}</Button>
        </div>
      </div>
      {plan.length ? (
        <ol className={d.steps}>
          {plan.map((p, i) => {
            const w = spots.find((s) => s.layer === p.layer);
            return (
              <li key={p.id} className={d.step}>
                <span className={card.num} aria-hidden="true">{i + 1}</span>
                <p className={d.stepText}>
                  {w ? <span className={d.stepTitle}>{w.title}. </span> : null}
                  <span className={d.stepDo}>{p.text}</span>
                </p>
                {w?.evidence ? (
                  <span className={d.stepLinks}>
                    {w.evidence.kind === "most" ? t("debrief.evidence.mostIn") : tp("debrief.evidence.questions", w.evidence.ids.length)}{" "}
                    <QuestionLinks ids={w.evidence.ids} onJump={ctx.jump} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ question viewer ---- */

/** Overflow rule of the switcher (owner: "what if there are more than 10 questions"). The server caps a session at 10
 * (`questions_per_session` 1–10); the switcher is designed for 10 and degrades past it:
 *  1. labels (number + the question's text, 2 lines) while every tab gets at least `--tab-min` (8rem) of the bar;
 *  2. otherwise numbers only, Previous / Next at the bar's ends (the text stays the tab's name for screen readers,
 *     the selected question is the heading right below);
 *  3. when the numbers do not fit either, the strip scrolls sideways with a fade on the side that has more, and the
 *     selected tab is always scrolled into view. The bar stays one row. */
function useSwitcherLayout(count: number) {
  const bar = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [fade, setFade] = useState({ start: false, end: false });
  const updateFade = () => {
    const el = list.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade((f) => (f.start === start && f.end === end ? f : { start, end }));
  };
  useLayoutEffect(() => {
    const b = bar.current;
    if (!b) return;
    const measure = () => {
      const min = cssPx(b, "--tab-min", 128);
      setCompact(b.clientWidth / count < min);
      updateFade();
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(b);
    return () => ro?.disconnect();
  }, [count]);
  useLayoutEffect(updateFade, [compact]);
  return { bar, list, compact, fade, updateFade };
}

function Viewer({ ctx }: { ctx: PageCtx }) {
  const qs = ctx.model.questions;
  const current = qs.find((q) => q.n === ctx.picked) ?? qs[0];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { bar, list, compact, fade, updateFade } = useSwitcherLayout(qs.length);
  const base = `${ctx.uid}-qv`;
  const index = current ? qs.indexOf(current) : -1;

  // Keep the selected tab in view inside a scrolling strip (sideways only: the page never jumps).
  useLayoutEffect(() => {
    const el = list.current;
    const tab = tabs.current[index];
    if (!el || !tab || el.scrollWidth <= el.clientWidth) return;
    const pad = cssPx(el, "--space-10", 40);
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    let to = el.scrollLeft;
    if (left - pad < el.scrollLeft) to = left - pad;
    else if (right + pad > el.scrollLeft + el.clientWidth) to = right + pad - el.clientWidth;
    if (to !== el.scrollLeft) el.scrollTo({ left: Math.max(0, to), behavior: scrollBehavior() });
  }, [index, compact, list]);

  if (!current) return null;

  /** Switch, keeping the reader's place: when the viewer's top is already scrolled past, bring it back to the top
   * (under the sticky switcher), so a shorter answer never leaves the page scrolled into empty space. */
  const pick = (n: number, focusTab = false) => {
    ctx.setPicked(n);
    const i = qs.findIndex((q) => q.n === n);
    if (focusTab) tabs.current[i]?.focus({ preventScroll: true });
    window.requestAnimationFrame(() => {
      const top = ctx.detail.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) ctx.detail.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = nextIndex(e.key, i, qs.length);
    if (n < 0) return;
    e.preventDefault();
    const q = qs[n];
    if (q) pick(q.n, true);
  };

  const prev = qs[index - 1];
  const next = qs[index + 1];
  const id = `${ctx.uid}-viewer`;
  const fadeClass = fade.start && fade.end ? d.fadeBoth : fade.start ? d.fadeStart : fade.end ? d.fadeEnd : "";
  return (
    <section ref={ctx.detail} className={d.viewer} aria-labelledby={id} data-review-id="DebriefVariant/D/Viewer">
      <h2 id={id} className="visually-hidden">{t("debrief.qSection")}</h2>
      {qs.length > 1 ? (
        <div ref={bar} className={`${d.bar} ${compact ? d.barCompact : ""}`} data-review-id="DebriefVariant/D/Switcher">
          {compact ? (
            <IconButton icon="chevronLeft" size="sm" label={COPY.prevQuestion} disabled={!prev} onClick={() => prev && pick(prev.n)} className={d.barStep} />
          ) : null}
          <div
            ref={list}
            role="tablist"
            aria-label={COPY.questionsNav}
            className={`${d.tabs} ${compact ? d.tabsCompact : ""} ${fadeClass}`}
            onScroll={updateFade}
          >
            {qs.map((q, i) => {
              const sel = q === current;
              return (
                <button
                  key={q.n}
                  ref={(el) => { tabs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${q.n}`}
                  aria-selected={sel}
                  aria-controls={`${base}-panel`}
                  tabIndex={sel ? 0 : -1}
                  className={d.tab}
                  data-track="debrief-question-tab"
                  onClick={() => pick(q.n)}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  <span className={d.tabNum}>{q.n}</span>
                  <span className={d.tabText}>{q.question}</span>
                </button>
              );
            })}
          </div>
          {compact ? (
            <IconButton icon="chevronRight" size="sm" label={COPY.nextQuestion} disabled={!next} onClick={() => next && pick(next.n)} className={d.barStep} />
          ) : null}
        </div>
      ) : null}
      <div role={qs.length > 1 ? "tabpanel" : undefined} id={`${base}-panel`} aria-labelledby={qs.length > 1 ? `${base}-tab-${current.n}` : undefined} className={d.panel}>
        <Swap swapKey={String(current.n)} focusTarget={() => document.getElementById(questionHeadingId(ctx.uid, current.n))}>
          <QuestionView q={current} ctx={ctx} index={index} />
        </Swap>
        {qs.length > 1 ? (
          <div className={d.nav}>
            <Button variant="ghost" icon="chevronLeft" disabled={!prev} onClick={() => prev && pick(prev.n)}>{COPY.prev}</Button>
            <Button variant="secondary" iconRight="chevronRight" disabled={!next} onClick={() => next && pick(next.n)}>
              {next ? COPY.nextQ(next.n) : COPY.lastQuestion}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function QuestionView({ q, ctx, index }: { q: QuestionModel; ctx: PageCtx; index: number }) {
  const lost = rowsLostIn(ctx.model.scorecard, q.n);
  return (
    <article className={d.q} data-question={q.n}>
      <header className={d.qHead}>
        <p className={d.facts}>
          <span className={d.qOf}>{COPY.questionOf(index + 1, ctx.model.questions.length)}</span>
          {q.duration ? <span className={d.fact}><Icon name="clock" size="sm" />{q.duration}</span> : null}
          {q.startsAt ? <span>{t("debrief.q.startsAt", { time: q.startsAt })}</span> : null}
          <span>{q.followUps ? tp("debrief.q.followUps", q.followUps) : t("debrief.q.noFollowUp")}</span>
          {q.misheard ? <span>{t("debrief.q.misheard", { n: q.misheard })}</span> : null}
        </p>
        <h3 id={questionHeadingId(ctx.uid, q.n)} tabIndex={-1} className={d.qTitle}>
          <span className="visually-hidden">{t("debrief.q.number", { n: q.n })}: </span>{q.question}
        </h3>
        {ctx.model.scorecard ? (
          <p className={d.lostLine}>
            {lost.length ? <><span className={d.lead}>{COPY.lostOn}:</span> {lost.map(rowLabel).join(", ")}</> : COPY.noLoss}
          </p>
        ) : null}
      </header>

      <div className={d.cols}>
        <section className={d.answerCol} aria-label={t("debrief.q.yourAnswer")}>
          {q.followUp ? <p className={d.muted}><span className={d.lead}>{t("debrief.q.followUp")}</span> {q.followUp}</p> : null}
          <div className={d.part}>
            <h4 className={d.partLabel}>{t("debrief.q.yourAnswer")}</h4>
            <p className={d.answer}><Marked parts={q.answer} /></p>
            {!ctx.example ? <span className={d.ghostRow}><Button variant="ghost" size="sm" icon="edit">{t("debrief.q.edit")}</Button></span> : null}
          </div>
          {q.followUpAnswer ? (
            <div className={d.part}>
              <h4 className={d.partLabel}>{t("debrief.q.yourFollowUp")}</h4>
              <p className={d.answer}>{q.followUpAnswer}</p>
            </div>
          ) : null}
          {q.stronger?.status === "ready" && q.stronger.text ? (
            <Disclosure surface="plain" title={t("feedback.stronger.show")} leading={<Icon name="sparkle" size="sm" />}>
              <div className={`${d.part} ${d.stronger}`}>
                <p className={d.answer}><Marked parts={q.stronger.text} /></p>
                {q.stronger.placeholders ? <p className={d.muted}>{t("debrief.stronger.note")}</p> : null}
              </div>
            </Disclosure>
          ) : null}
        </section>

        <section className={d.notesCol} aria-labelledby={`${ctx.uid}-fb-${q.n}`}>
          <h4 id={`${ctx.uid}-fb-${q.n}`} className={d.partLabel}>{COPY.feedback}</h4>
          {q.unavailable ? <Callout tone="info">{t("debrief.q.unavailable")}</Callout> : <Notes q={q} ctx={ctx} />}
        </section>
      </div>
    </article>
  );
}

/** One list of notes for the question, in the configured layer order, each with a small layer tag. The weak spot
 * whose quote comes from this question opens the list with "What you said → How it lands" (AC7 lives where the
 * quote is, so the plan above stays one line per step). A language spot skips "What you said": its correction row
 * right below shows the same words as "heard → say". */
function Notes({ q, ctx }: { q: QuestionModel; ctx: PageCtx }) {
  const spots: WeakSpotModel[] = orderedSpots(ctx.model.weakSpots, ctx.seq).filter((w) => w.evidence?.ids[0] === q.n && (w.said || w.lands));
  const content = q.layers.content?.items ?? [];
  const lang = q.layers.language;
  const del = q.layers.delivery;
  const delParts = del ? [
    del.fillers !== undefined ? tp("debrief.sum.fillers", del.fillers) : null,
    del.length ? t("debrief.delivery.lengthValue", { time: del.length, words: del.words !== undefined ? tp("common.words", del.words) : "" }) : null,
    del.textMode && del.words !== undefined ? tp("common.words", del.words) : null,
    del.pace ? t("debrief.delivery.paceValue", { wpm: del.pace.wpm, verdict: t(`feedback.delivery.${del.pace.verdict}`) }) : null,
  ].filter(Boolean) : [];
  const corrections = lang?.corrections ?? [];
  const empty = !spots.length && !content.length && !corrections.length && !delParts.length;

  const byLayer = {
    content: content.map((it, i) => (
      <li key={`c${i}`} className={d.note}>
        <LayerTag layer="content" />
        <p className={d.noteLine}>{it.lead ? <strong className={d.lead}>{it.lead} </strong> : null}{it.text}</p>
      </li>
    )),
    language: corrections.map((x) => (
      <li key={x.id} className={d.note}>
        <LayerTag layer="language" />
        <div className={d.noteText}>
          <p className={d.fixLine}>
            <span className={d.heard}><span className="visually-hidden">{x.typed ? t("debrief.q.typed") : COPY.heardAs}: </span><Marked parts={x.heard} quoted /></span>
            <Icon name="arrowRight" size="sm" className={d.fixArrow} />
            <span><span className="visually-hidden">{COPY.say}: </span><Marked parts={x.say} quoted /></span>
          </p>
          <p className={d.why}>{x.why}</p>
          <span className={d.fixActions}>
            <Button variant="ghost" size="sm">{t("debrief.lang.notWhatISaid")}</Button>
            <Button variant="ghost" size="sm" icon="x">{t("debrief.lang.dismiss")}</Button>
          </span>
        </div>
      </li>
    )),
    delivery: delParts.length ? [
      <li key="d" className={d.note}>
        <LayerTag layer="delivery" />
        <div className={d.noteText}>
          <p className={d.metrics}>{delParts.join(" · ")}</p>
          {del?.mostFillers ? <p className={d.why}>{t("debrief.delivery.tip", { list: del.mostFillers })}</p> : null}
          {del?.textMode ? <p className={d.why}>{t("feedback.delivery.textMode")}</p> : null}
          {del?.engineNote ? <p className={d.why}>{t("debrief.delivery.engineNote")}</p> : null}
        </div>
      </li>,
    ] : [],
  };

  return (
    <>
      <ul className={d.notes}>
        {spots.map((w) => (
          <li key={w.id} className={`${d.note} ${d.spot}`}>
            <LayerTag layer={w.layer} />
            <div className={d.noteText}>
              <p className={d.spotTitle}><span className="visually-hidden">{COPY.fromWeakSpot}: </span>{w.title}</p>
              <dl className={d.lines}>
                {w.said && w.layer !== "language" ? <div><dt>{t(w.said.kind === "metric" ? "debrief.measuredLead" : "debrief.saidLead")}</dt><dd><Said said={w.said} /></dd></div> : null}
                {w.lands ? <div><dt>{t("debrief.landsLead")}</dt><dd>{w.lands}</dd></div> : null}
                {w.fix ? <div><dt>{t("debrief.fixLead")}</dt><dd>{w.fix}</dd></div> : null}
              </dl>
            </div>
          </li>
        ))}
        {ctx.seq.flatMap((layer) => byLayer[layer])}
      </ul>
      {empty ? <p className={d.muted}>{t("debrief.lang.nothing")}</p> : null}
      {lang?.removed.length ? <div className={d.removed}><RemovedLines lines={lang.removed} /></div> : null}
    </>
  );
}
