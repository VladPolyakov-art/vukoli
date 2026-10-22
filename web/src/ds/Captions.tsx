/* Captions (G15): Mike's subtitles and the user's own words, structured like Otter's live transcript (R5, Q3):
 * each turn = speaker name + start time, then the words; interim words in --color-text-secondary turn
 * --color-text-primary once final; no avatars, no colours (P1).
 * - `mode="subtitles"` (voice): only the latest turn, at most 3 lines, hard clip aligned to the bottom (no mask: P4).
 * - `mode="transcript"` (text mode): every turn of the question, scrolls inside its parent, newest at the bottom,
 *   auto-scrolls (smooth, `auto` under reduced motion).
 * Motion (docs/motion.md 3.7 "Captions word-in"): Mike's streamed chunks (`text` as an array) fade in, opacity only,
 * no blur; a new turn block rises in (transcript). The user's own words update in place, never animate (rule 3).
 * Not a live region: Mike is heard through TTS, and the user is speaking — announcing either would double it. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { scrollBehavior } from "./motion";
import { Dots } from "./Dots";
import s from "./Captions.module.css";

export interface CaptionTurn {
  id: string;
  speaker: "mike" | "user";
  /** Shown name: "Mike", "You", "You typed". */
  name: string;
  /** Start time of the turn, "07:02". */
  time?: string;
  /** Final words. An array = streamed chunks: each new chunk fades in, earlier ones stay still. */
  text: string | string[];
  /** Words still being recognised (secondary until final). */
  interim?: string;
}

export interface CaptionsProps {
  mode?: "subtitles" | "transcript";
  turns: CaptionTurn[];
  /** Accessible name of the region ("Subtitles", "Transcript of question 2"). */
  label: string;
  /** Mike is about to answer: a Mike header with the grey 3-dot loader where his words will appear. */
  pending?: { name: string; label: string };
  /** Static line under the captions ("What we heard. A wrong word? Fix it after you answer."). */
  footer?: ReactNode;
  /** Shown when there are no turns yet. */
  empty?: ReactNode;
  className?: string;
}

export function Captions({ mode = "subtitles", turns, label, pending, footer, empty, className }: CaptionsProps) {
  const shown = mode === "subtitles" ? turns.slice(-1) : turns;
  const scroller = useRef<HTMLDivElement>(null);
  // Turns present at first render never animate (a remount must not replay them); later ones rise in.
  const [initial] = useState(() => new Set(turns.map((x) => x.id)));
  const last = turns.at(-1);
  const lastKey = `${turns.length}:${last ? flat(last.text).length + (last.interim?.length ?? 0) : 0}:${pending ? 1 : 0}`;

  useEffect(() => {
    const el = scroller.current;
    if (mode !== "transcript" || !el) return;
    el.scrollTo?.({ top: el.scrollHeight, behavior: scrollBehavior() });
  }, [mode, lastKey]);

  const isEmpty = !shown.length && !pending;
  return (
    <section
      className={`${s.root} ${s[mode]} ${className ?? ""}`}
      aria-label={label}
      data-review-id={`Captions/${mode}`}
    >
      <div ref={scroller} className={s.body} tabIndex={mode === "transcript" ? 0 : undefined}>
        {isEmpty && empty ? <p className={s.empty}>{empty}</p> : null}
        {shown.map((turn) => (
          <Turn key={turn.id} turn={turn} mode={mode} fresh={mode === "transcript" && !initial.has(turn.id)} />
        ))}
        {pending ? (
          <div className={s.turn}>
            <p className={s.head}><span className={s.name}>{pending.name}</span></p>
            <div className={s.words}><Dots label={pending.label} /></div>
          </div>
        ) : null}
      </div>
      {footer ? <p className={s.footer}>{footer}</p> : null}
    </section>
  );
}

function Turn({ turn, mode, fresh }: { turn: CaptionTurn; mode: "subtitles" | "transcript"; fresh: boolean }) {
  const chunks = Array.isArray(turn.text) ? turn.text : [turn.text];
  const streamed = turn.speaker === "mike" && Array.isArray(turn.text);
  return (
    <div className={`${s.turn} ${fresh ? "motion-rise" : ""}`} data-speaker={turn.speaker}>
      <p className={s.head}>
        <span className={s.name}>{turn.name}</span>
        {turn.time ? <span className={s.time}>{turn.time}</span> : null}
      </p>
      <div className={mode === "subtitles" ? s.clip : undefined}>
        <p className={s.words}>
          {chunks.map((c, i) => (
            <span key={i} className={streamed && i > 0 ? s.chunkIn : undefined}>{i > 0 && !/^\s/.test(c) ? " " : ""}{c}</span>
          ))}
          {turn.interim ? <span className={s.interim}> {turn.interim}</span> : null}
        </p>
      </div>
    </div>
  );
}

function flat(text: string | string[]) {
  return Array.isArray(text) ? text.join(" ") : text;
}
