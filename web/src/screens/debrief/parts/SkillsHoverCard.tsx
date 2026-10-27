/* The final score and its skills card (layout D, owner's decisions 2026-10-27). The score ("3.3/5 · Average of 7 skills",
 * a dotted-underline cue and an info icon) opens the seven skills, weakest first, in a card to the LEFT of the score on
 * mouse HOVER: no pin step for a mouse (a grace delay lets the pointer travel into the card and click its question
 * links). The accessible fallbacks open the same card and keep it until Esc, the close button, a press outside or a
 * link: keyboard focus (preview), Enter / Space (focus moves into the card), a touch tap. Under 640px the card is a
 * full-width sheet (the Menu's rules, `place`); with no room at the left it opens under the score.
 * Rows: name, "3/5" (no meters), the questions that lost points as links; "Not asked this time"; the misheard note.
 * DS candidate: a hover card / Popover with a side placement and a grace delay (ds/components.md, candidates). */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { Icon, IconButton, durationMs, useOverlayRoot } from "../../../ds";
import { OverlayPortal } from "../../../ds/OverlayRoot";
import { OVERLAY_NARROW_MAX, cssPx, focusables, place, useOutsidePress } from "../../../ds/overlay";
import type { DurationToken } from "../../../ds/motion";
import { t, tp } from "../../../i18n";
import type { ScoreRowModel } from "../types";
import { rowLabel, weakestFirst } from "./debriefShared";
import { QuestionLinks } from "./QuestionLinks";
import s from "./skillsCard.module.css";

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
    const row = a.closest<HTMLElement>("[data-skills-row]");
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
export function SkillsHoverCard({ rows, value, n, uid, onJump }: { rows: readonly ScoreRowModel[]; value: string; n: number; uid: string; onJump: (q: number) => void }) {
  const [mode, setMode] = useState<PopMode>("closed");
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const focusIn = useRef(false);
  const pointer = useRef<string>("mouse");
  const { container } = useOverlayRoot();
  const open = mode !== "closed";
  const pos = useSidePanel(open, anchor, panel, container);
  const panelId = `${uid}-skills`;
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

  const jump = (q: number) => {
    close();
    onJump(q);
  };

  return (
    <div className={s.score}>
      <button
        ref={anchor}
        type="button"
        className={s.scoreBtn}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-track="debrief-score-skills"
        data-review-id="Debrief/Score"
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
        <span className={s.scoreValue} aria-hidden="true">{value}<span className={s.scoreOf}>{t("debrief.score.outOf")}</span></span>
        <span className="visually-hidden">{t("debrief.score.averageSr", { score: value })} </span>
        <span className={s.scoreMore}>
          <span className={s.scoreMoreText}>{tp("debrief.score.average", n)}</span>
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
            className={`${s.pop} ${pos.side === "left" ? s.popLeft : pos.side === "top" ? s.popTop : s.popBottom}`}
            style={pos.style}
            data-mode={mode}
            data-side={pos.side}
            data-review-id="Debrief/Scorecard"
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
            <div className={s.popHead}>
              <h3 id={headId} className={s.popTitle} tabIndex={-1} data-autofocus="">{t("debrief.score.skillsTitle")}</h3>
              <IconButton icon="x" size="sm" label={t("common.close")} onClick={() => close(true)} />
            </div>
            <SkillsList rows={rows} onJump={jump} />
          </div>
        </OverlayPortal>
      ) : null}
    </div>
  );
}


/** The skills, weakest first, two columns when the card is wide: name, "3/5", the questions that lost points (links),
 * then the "Not asked this time" line and the misheard note. Exported pure for the markup tests. */
export function SkillsList({ rows, onJump }: { rows: readonly ScoreRowModel[]; onJump: (q: number) => void }) {
  const ordered = weakestFirst([...rows]);
  const skipped = rows.filter((r) => r.score === null).map((r) => rowLabel(r.key));
  return (
    <>
      <p className={s.muted}>{t("debrief.score.sub")}</p>
      <ul className={s.skills} aria-label={t("debrief.score.list")}>
        {ordered.map((r) => (
          <li key={r.key} className={s.skill} data-score-key={r.key}>
            <span className={s.skillLabel}>{rowLabel(r.key)}</span>
            <span className={s.skillScore} aria-hidden="true">{t("debrief.score.value", { score: r.score })}</span>
            <span className="visually-hidden">{t("debrief.score.sr", { score: r.score })}</span>
            <span className={s.skillLost}>
              {r.lost.length ? <>{tp("debrief.score.lost", r.lost.length)} <QuestionLinks ids={r.lost} onJump={onJump} /></> : t("debrief.score.noneLost")}
            </span>
          </li>
        ))}
      </ul>
      {skipped.length ? <p className={s.muted}>{t("debrief.score.notAsked", { labels: skipped.join(", ") })}</p> : null}
      <p className={s.muted}>{t("debrief.misheard.note")}</p>
    </>
  );
}
