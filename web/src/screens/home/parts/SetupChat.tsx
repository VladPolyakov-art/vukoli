/* Setup chat (home.md v2 §4, D47a): a short scripted conversation with Mike that ends in the plan card.
 * - Header row: "Setting up with Mike" · "Step 2 of 3" · Skip questions (gone once the plan is shown).
 * - The log: ChatMessage per turn, quick replies under Mike's question (removed once answered), the example card and
 *   the plan card inside Mike's last message.
 * - Scripted replies appear after `--duration-slow` with rise-in and no dots (§4.1: we don't fake thinking); a pending
 *   message (TextShimmer) only while real work runs.
 * The bottom composer lives in HomeView (it is the same object as the start composer, moved by FLIP). */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Button, ChatLog, ChatMessage, Chip, ChipGroup, Icon } from "../../../ds";
import { durationMs, scrollBehavior, usePresence } from "../../../ds/motion";
import { t } from "../../../i18n";
import type { HomeViewProps, SetupReply, SetupTurn } from "../types";
import { ExampleCard } from "./ExampleCard";
import { PlanCard } from "./PlanCard";
import s from "./parts.module.css";

/** `**Kestrel Pay**` → <strong>. Copy comes from the locale file, never from the user (user text is shown as is). */
function rich(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

/** Turns arriving in one batch after the user's message are held for `--duration-slow` (the scripted pause).
 * Turns present on mount are shown at once without an entrance, unless the chat itself is entering. */
function useReveal(turns: SetupTurn[], entering: boolean) {
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => (entering ? new Set(turns.map((x) => x.id)) : new Set()));
  const [hold, setHold] = useState<number>(() => (entering ? firstHeld(turns, new Set()) : turns.length));
  if (!known.current) known.current = entering ? new Set() : new Set(turns.map((x) => x.id));

  useLayoutEffect(() => {
    const seen = known.current!;
    const added = turns.filter((x) => !seen.has(x.id));
    if (!added.length) { setHold(turns.length); return; }
    const at = firstHeld(turns, seen);
    turns.forEach((x) => seen.add(x.id));
    setFresh(new Set(added.map((x) => x.id)));
    setHold(at);
    if (at >= turns.length) return;
    const ms = durationMs("--duration-slow");
    if (!ms) { setHold(turns.length); return; }
    const id = window.setTimeout(() => setHold(turns.length), ms);
    return () => window.clearTimeout(id);
  }, [turns]);

  return { visible: turns.slice(0, hold), fresh };
}

/** Index of the first new Mike turn that follows a new user turn (that's where the scripted pause goes). */
function firstHeld(turns: SetupTurn[], seen: Set<string>): number {
  let userSeen = false;
  for (let i = 0; i < turns.length; i += 1) {
    const x = turns[i]!;
    if (seen.has(x.id)) continue;
    if (x.speaker === "user") userSeen = true;
    else if (userSeen) return i;
  }
  return turns.length;
}

/** `data-track` of a quick reply: the group and its value ("setup-reply-level-b1"); a saved job's id never goes in. */
function replyTrack(id: string): string {
  const [k, v = ""] = id.split(":");
  return k === "job" && v !== "general" ? "setup-reply-job-saved" : `setup-reply-${k}-${v}`.toLowerCase();
}

function Replies({ turn, fresh, onReply }: { turn: SetupTurn; fresh: boolean; onReply?: (turnId: string, replyId: string) => void }) {
  const open = Boolean(turn.replies?.length) && !turn.answered;
  const { mounted, leaving } = usePresence(open);
  const last = useRef<SetupReply[]>(turn.replies ?? []);
  if (turn.replies?.length) last.current = turn.replies;
  if (!mounted) return null;
  return (
    <div className={leaving ? s.repliesOut : fresh ? s.repliesIn : undefined} data-review-id="Home/Setup/Replies">
      <ChipGroup label={t("chat.setup.replies")} hideLabel>
        {last.current.map((r, i) => (
          <Chip key={r.id} icon={r.icon} data-track={replyTrack(r.id)} style={{ "--i": i } as CSSProperties} disabled={leaving} onClick={() => onReply?.(turn.id, r.id)}>
            {r.label}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}

function PastedJob({ label, meta }: { label: string; meta?: string }) {
  const [all, setAll] = useState(false);
  return (
    <div className={s.pasted}>
      <p className={`${s.pastedText} ${all ? "" : s.clamped}`}>{label}</p>
      <span className={s.pastedMeta}>
        {meta ? <span>{meta}</span> : null}
        <Button variant="link" size="sm" data-track="setup-show-all" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? t("chat.setup.showLess") : t("chat.setup.showAll")}
        </Button>
      </span>
    </div>
  );
}

function UserBody({ turn }: { turn: SetupTurn }) {
  const a = turn.attachment;
  if (a?.kind === "job") return <PastedJob label={a.label} meta={a.meta} />;
  if (a?.kind === "file") {
    return (
      <span className={s.attachRow}>
        <span className={s.attachIcon}><Icon name="file" /></span>
        <span className={s.attachText}>
          <span className={s.attachName}>{a.label}</span>
          {a.meta ? <span className={s.attachMeta}>{a.meta}</span> : null}
        </span>
      </span>
    );
  }
  return <p className={s.linkText}>{turn.text}</p>;
}

export interface SetupChatProps extends HomeViewProps {
  /** The chat just opened from the start screen: the first messages play their entrance. */
  entering?: boolean;
  scroller: RefObject<HTMLDivElement | null>;
}

export function SetupChat(props: SetupChatProps) {
  const { setup, entering = false, scroller } = props;
  const turns = setup?.turns ?? [];
  const { visible, fresh } = useReveal(turns, entering);
  const heading = useRef<HTMLHeadingElement>(null);
  const items = useRef(new Map<string, HTMLDivElement>());
  const planTurn = visible.find((x) => x.plan);
  const planFresh = planTurn ? fresh.has(planTurn.id) : false;

  // Keep the newest message in view: its top when it is taller than the view (a plan card on a phone), else the end.
  const lastId = visible[visible.length - 1]?.id;
  const firstFresh = visible.find((x) => fresh.has(x.id))?.id;
  const mountedOnce = useRef(false);
  useEffect(() => {
    const box = scroller.current;
    if (!box || !lastId) return;
    const end = box.scrollHeight - box.clientHeight;
    const target = firstFresh ? items.current.get(firstFresh) : undefined;
    let top = end;
    if (target) {
      const y = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      top = Math.min(end, Math.max(0, y - box.clientHeight / 3));
      if (planFresh) top = Math.min(end, y);
    }
    box.scrollTo({ top, behavior: mountedOnce.current ? scrollBehavior() : "auto" });
    mountedOnce.current = true;
  }, [lastId, firstFresh, planFresh, scroller]);

  // The plan heading takes focus when it appears (no ring: tabindex -1, focus-visible only for keyboard users).
  useEffect(() => {
    if (planFresh) heading.current?.focus({ preventScroll: true });
  }, [planFresh]);

  return (
    <ChatLog label={t("chat.setup.log")} className={s.log}>
      {visible.map((turn, i) => {
        const prev = visible[i - 1];
        const isFresh = fresh.has(turn.id);
        const name = turn.speaker === "mike" && prev?.speaker !== "mike" ? t("chat.setup.mike") : undefined;
        const ref = (el: HTMLDivElement | null) => { if (el) items.current.set(turn.id, el); else items.current.delete(turn.id); };
        if (turn.speaker === "user") {
          return (
            <div key={turn.id} ref={ref} className={s.turn}>
              <ChatMessage speaker="user" animate={isFresh} reviewId="Home/Setup/User">
                <UserBody turn={turn} />
              </ChatMessage>
            </div>
          );
        }
        const action = turn.action ? (
          turn.action.button ? (
            <Button variant="secondary" size="sm" icon={turn.action.icon ?? "chat"} data-track={`setup-action-${turn.action.id}`} onClick={() => props.onTurnAction?.(turn.id, turn.action!.id)}>{turn.action.label}</Button>
          ) : (
            <Button variant="link" size="sm" icon={turn.action.icon} data-track={`setup-action-${turn.action.id}`} onClick={() => props.onTurnAction?.(turn.id, turn.action!.id)}>{turn.action.label}</Button>
          )
        ) : null;
        const replies = turn.replies?.length ? <Replies turn={turn} fresh={isFresh} onReply={props.onReply} /> : null;
        return (
          <div key={turn.id} ref={ref} className={`${s.turn} ${name ? "" : s.turnCont}`}>
            <ChatMessage
              speaker="mike"
              state={turn.state}
              name={name}
              pendingLabel={turn.pendingLabel}
              animate={isFresh}
              reviewId={`Home/Setup/Mike-${turn.state}`}
              actions={action || replies ? <>{action}{replies}</> : undefined}
            >
              {turn.text ? (
                <>
                  <p className={s.text}>{rich(turn.text)}</p>
                  {turn.aside ? <p className={s.aside}>{turn.aside}</p> : null}
                </>
              ) : null}
            </ChatMessage>
            {turn.example ? (
              <div className={isFresh ? "motion-card" : undefined}><ExampleCard order={props.layerOrder} /></div>
            ) : null}
            {turn.plan && setup?.plan ? (
              <div className={isFresh ? "motion-card" : undefined}>
                <PlanCard
                  plan={setup.plan}
                  jobs={props.jobs}
                  engineReady={props.engineReady}
                  textMode={props.textMode}
                  starting={props.starting}
                  initialOverlay={props.initialOverlay}
                  headingRef={heading}
                  onChange={props.onChange}
                  onRemoveNote={props.onRemoveNote}
                  onRetryPrep={props.onRetryPrep}
                  onAddCv={props.onAddCv}
                  onStart={props.onStart}
                  onTypeInstead={props.onTypeInstead}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </ChatLog>
  );
}

/** "Setting up with Mike · Step 2 of 3 · Skip questions". */
export function SetupHeader({ setup, onSkip }: Pick<HomeViewProps, "setup" | "onSkip">) {
  return (
    <div className={s.header} data-review-id="Home/Setup/Header" data-review-section="Home · Setup header" data-comment-target>
      <h1 className={s.headerTitle}>{t("chat.setup.title")}</h1>
      {setup?.step ? <span className={s.headerStep}>{t("chat.setup.step", { n: setup.step.n, of: setup.step.of })}</span> : null}
      {setup?.canSkip ? (
        <Button variant="ghost" size="sm" className={s.headerSkip} data-track="setup-skip-questions" onClick={onSkip}>{t("chat.setup.skip")}</Button>
      ) : null}
    </div>
  );
}
