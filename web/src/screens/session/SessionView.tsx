/* The Session screen as a pure view (ds/screens/session.md §0): everything comes from props, nothing from audio, the
 * store or the network. The live container (screens/Session.tsx) maps the reducer to these props; the review page and
 * the stories pass fixtures.
 * v2 (§V2, D47c): no top bar and no dock. Every control lives in one floating island at the bottom centre of the stage;
 * the context (title, round) moved into the island's More menu. D107: there is no feedback panel in the call any more
 * (feedback lives in the debrief). Only the island's two rows (< 560) are done in JS; every other rule is a CSS
 * container query on the root (`session`).
 * V2.1 (D49): the centre is the running transcript of the whole dialogue (newest at the bottom, follows unless the user
 * scrolled up → "Jump to latest"). Mike's presence is a glow along the top edge (ds/Presence), only while someone talks
 * or Mike thinks; the transcript starts in its lower part (D91). The one state text sits in the glow, top centre (D92). */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, Presence, scrollBehavior, StatusPill, useScrollFocusable } from "../../ds";
import { t } from "../../i18n";
import { Banners } from "./parts/Banners";
import { FirstTime } from "./parts/FirstTime";
import { Interrupted } from "./parts/Interrupted";
import { islandModel, SessionIsland } from "./parts/Island";
import { MicHelpDialog } from "./parts/MicHelpDialog";
import { ShortcutsDialog } from "./parts/ShortcutsDialog";
import { Suggester } from "./parts/Suggester";
import { Transcript } from "./parts/Transcript";
import { HINT_MS, stageFor } from "./stage";
import { follow, FOLLOW_START, isAtBottom, showJump, type FollowEvent, type FollowState } from "./transcriptScroll";
import type { SessionViewProps } from "./types";
import { useIslandOverflow, useSessionLayout } from "./useSessionLayout";
import s from "./SessionView.module.css";

/** Scroll the transcript to its end; scroll events until it gets there are ours, not the user's. */
function scrollToEnd(el: HTMLElement | null, ours: { current: number }, behavior: ScrollBehavior) {
  if (!el) return;
  ours.current = performance.now() + (behavior === "smooth" ? 700 : 60);
  el.scrollTo?.({ top: el.scrollHeight, behavior });
}

function textLength(text: string | string[]) {
  return Array.isArray(text) ? text.join("").length : text.length;
}

function inTextField(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return Boolean(node && (node.tagName === "TEXTAREA" || node.tagName === "INPUT" || node.tagName === "SELECT" || node.isContentEditable));
}

/** Letters that are shortcuts in text mode (R redo, N next; "?" is the help). */
const TEXT_SHORTCUTS = new Set(["r", "n", "?"]);
/** A key press after another typed character this soon is part of typing, never a command. */
const TYPING_GAP_MS = 1000;
/** C2b: for this long after an answer was sent, a shortcut letter is the next answer being typed (Send leaves the focus
 * off the box; a lone "r" would have taken the answer back). */
const SENT_GUARD_MS = 2000;

/** C2 (text mode): is this key press, with the focus outside any text field, the user typing an answer? Inside a dialog
 * or a menu the keys keep their own meaning. */
function typesIntoAnswer(e: KeyboardEvent | ReactKeyboardEvent, target: HTMLElement | null, strayAt: { current: number }, sentAt: { current: number }): boolean {
  if (e.key.length !== 1 || e.key === " ") return false;          // Enter, Tab, arrows, Esc and Space keep their jobs
  if (target?.closest('dialog, [role="dialog"], [role="menu"], [role="listbox"]')) return false;
  if (e.key !== e.key.toLowerCase() && e.key !== "?") return true;     // a capital: a sentence being started
  if (!TEXT_SHORTCUTS.has(e.key)) return true;
  const now = performance.now();
  return now - strayAt.current < TYPING_GAP_MS || now - sentAt.current < SENT_GUARD_MS;   // a shortcut letter in the middle of typing, or right after Send
}

const focusAnswerBox = (root: HTMLElement | null) =>
  root?.querySelector<HTMLTextAreaElement>("[data-session-composer]")?.focus({ preventScroll: true });

export function SessionView(props: SessionViewProps) {
  const { variant, input, phase, overlay, muted, data, entering } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  /* C2b: when the last answer was sent. The text composer takes the focus back after Send (the button is disabled by the
   * time the user types), and for SENT_GUARD_MS a shortcut letter is typing, never Redo. */
  const sentAt = useRef(-Infinity);
  const sendText = props.handlers?.onSendText;
  const handlers = useMemo(() => (props.handlers && sendText
    ? { ...props.handlers, onSendText: (text: string) => { const ok = sendText(text); if (ok) sentAt.current = performance.now(); return ok; } }
    : props.handlers), [props.handlers, sendText]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFocus = useScrollFocusable(t("session.transcript"), scrollRef); // QA-09: reachable by keyboard when it scrolls
  const islandRef = useRef<HTMLDivElement>(null);
  const islandBoxRef = useRef<HTMLDivElement>(null);
  const { layout, stacked: narrowIsland, compact: compactIsland } = useSessionLayout(rootRef);
  const overflowIsland = useIslandOverflow(islandBoxRef, !props.island && !narrowIsland);
  const islandLayout = props.island ?? (narrowIsland || overflowIsland ? "stacked" : "inline");
  const voice = input === "voice";
  const interrupted = phase === "interrupted" || overlay === "interrupted-engine" || overlay === "interrupted-voice";
  const stage = stageFor({ ...props, phase: interrupted ? "interrupted" : phase });
  const thinking = phase === "thinking";
  const lastTurn = data.transcript.at(-1);

  /* ---------- transcript follow (transcriptScroll.ts): the newest line stays in view unless the user scrolled up.
   * Smooth (C11), instant while the user talks (rule 3), on the first render and under reduced motion. ---------- */
  const startFollow: FollowState = props.initialFollow === "reading" ? { stuck: false, unread: true } : FOLLOW_START;
  const [followState, setFollowState] = useState<FollowState>(startFollow);
  const followRef = useRef<FollowState>(startFollow);
  const ours = useRef(0);
  const firstScroll = useRef(true);
  const send = (e: FollowEvent, behavior: ScrollBehavior) => {
    const r = follow(followRef.current, e);
    if (r.state !== followRef.current) {
      followRef.current = r.state;
      setFollowState(r.state);
    }
    if (r.scroll) scrollToEnd(scrollRef.current, ours, behavior);
  };
  const sendRef = useRef(send);
  useLayoutEffect(() => { sendRef.current = send; });
  const contentKey = `${data.transcript.length}:${lastTurn ? textLength(lastTurn.text) + (lastTurn.interim?.length ?? 0) : 0}:${thinking ? 1 : 0}:${interrupted ? 1 : 0}`;
  const [islandH, setIslandH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const instant = firstScroll.current || phase === "listening";
    firstScroll.current = false;
    sendRef.current({ type: "content" }, instant ? "auto" : scrollBehavior());
  }, [contentKey, phase, islandH]);
  /* The scroller can change height with nothing new in it (a notice, the window): if the transcript was
   * following, it stays at the latest line instead of leaving it under the island (the D59 bug). */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => sendRef.current({ type: "content" }, "auto"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = isAtBottom(el.scrollTop, el.scrollHeight, el.clientHeight);
    const programmatic = performance.now() < ours.current;
    if (programmatic && atBottom) ours.current = 0;
    send({ type: "scroll", atBottom, programmatic }, "auto");
  };

  /* ---------- island model (also drives the keyboard) ---------- */
  const model = islandModel({ variant, input, phase, muted, interrupted, data, handlers });

  /* ---------- island overlays ---------- */
  const [shortcuts, setShortcuts] = useState(props.initialOverlay === "shortcuts");
  const [micHelp, setMicHelp] = useState(false);
  /* D66: the dialog always closes — ×, Esc, or either way forward; an `overlay="mic-help"` state opens it only once. */
  const [micHelpClosed, setMicHelpClosed] = useState(false);
  const closeMicHelp = () => { setMicHelp(false); setMicHelpClosed(true); handlers?.onCloseMicHelp?.(); };
  /* Live (US-06 AC2): the dialog opens by itself when the mic fails; once the failure is gone it may open again for the next one. */
  const [prevOverlay, setPrevOverlay] = useState(overlay);
  if (prevOverlay !== overlay) {
    setPrevOverlay(overlay);
    if (overlay !== "mic-help") setMicHelpClosed(false);
  }
  const [suggestOn, setSuggestOn] = useState(data.suggestOn ?? true);
  const showSuggester = props.suggester === "on" && variant === "interview";

  /* Text mode morph: the island turns from pill into box once, when the input switches during the session. */
  const [prevInput, setPrevInput] = useState(input);
  const [morph, setMorph] = useState(false);
  if (prevInput !== input) {
    setPrevInput(input);
    setMorph(true);
  }

  /* The stage keeps room for the island and the state text above it (the transcript is never under them): their height
   * as a variable. */
  useLayoutEffect(() => {
    const el = islandRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setIslandH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* C2b: after "Redo answer" (the server took the answer back, the box is empty again) the next thing the user does is type:
   * the focus goes to the box, unless they are in a dialog or a menu. */
  const userTurns = data.transcript.reduce((n, x) => n + (x.speaker === "user" ? 1 : 0), 0);
  const prevUserTurns = useRef(userTurns);
  useEffect(() => {
    const dropped = userTurns < prevUserTurns.current;
    prevUserTurns.current = userTurns;
    if (!dropped || voice) return;
    const at = document.activeElement as HTMLElement | null;
    if (at && at !== document.body && !(rootRef.current?.contains(at) && at.tagName === "BUTTON" && !at.closest('dialog, [role="dialog"], [role="menu"], aside'))) return;
    focusAnswerBox(rootRef.current);
  }, [userTurns, voice]);

  /* ---------- keyboard (V2.8) ---------- */
  const strayAt = useRef(0);   // when the last character was typed outside a text field (typesIntoAnswer)
  const onKey = (e: KeyboardEvent | ReactKeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (e.key === "Escape") return;
    if (inTextField(target)) return;
    /* C2: a held key is not a second command (holding R redid every answer back to the first). */
    if (e.repeat) return;
    /* C2: in text mode keys that land outside the answer box are the user's typing (after Send with the mouse, the focus is
     * on a button or on the page), not shortcuts: the box takes the focus and the character.
     * Only a lone, lowercase press of a shortcut letter still acts as one. The cost of a stray R was the user's answer. */
    if (!voice && typesIntoAnswer(e, target, strayAt, sentAt)) {
      const box = rootRef.current?.querySelector<HTMLTextAreaElement>("[data-session-composer]");
      if (box) {
        strayAt.current = performance.now();
        box.focus({ preventScroll: true });   // the character of this very key press goes to the box
        return;
      }
    }
    if (!voice && e.key.length === 1 && e.key !== " ") strayAt.current = performance.now();
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const onButton = target?.tagName === "BUTTON";
    const live = !interrupted && phase !== "connecting" && phase !== "saving";
    const run = (fn?: () => void) => { if (fn) { e.preventDefault(); fn(); } };
    if (key === "?") run(() => setShortcuts(true));
    else if (key === "n" && model.main?.kind === "button" && (model.main.id === "next" || model.main.id === "debrief") && !model.main.disabled) run(model.main.onClick);
    else if (!live || !voice) {
      if (key === "r" && model.canRedo) run(handlers?.onRedo);
    } else if (key === "m") run(handlers?.onToggleMute);
    else if (key === "r" && model.canRedo) run(handlers?.onRedo);
    else if (key === "t") run(voice ? handlers?.onTypeInstead : handlers?.onUseVoice);
    else if (key === " " && !onButton && (phase === "mike-speaking" || phase === "your-turn")) run(handlers?.onInterrupt);
    else if (key === "Enter" && !onButton && phase === "listening") run(handlers?.onSendNow);
  };
  const keyRef = useRef(onKey);
  useLayoutEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    if (!props.globalKeys) return;
    const listener = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [props.globalKeys]);

  const sendLocked = Boolean(handlers?.onNext) && (phase === "between" || phase === "feedback");
  /* The whole dialogue, every phase (D49); "What we heard" under the user's latest voice answer. */
  const showTranscript = data.transcript.length > 0 || thinking;
  
  const showTips = props.firstTime && !interrupted && phase !== "saving";
  const showHeard = voice && !interrupted && lastTurn?.speaker === "user";
  const showIsland = phase !== "saving" && !data.closing;

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-layout={layout}
      data-motion-quiet={phase === "listening" ? "true" : undefined}
      data-review-id="Session"
      style={islandH ? ({ "--island-h": `${islandH}px` } as CSSProperties) : undefined}
      onKeyDown={props.globalKeys ? undefined : onKey}
    >
      <div className={s.body}>
        <main className={s.stage} id="main" data-review-id="Session/Stage" data-review-section="Session · Stage" data-comment-target>
          <h1 className="visually-hidden">{data.title}</h1>{/* QA-12: the page's one h1 (the title left the screen, session.md V2.3) */}
          <div className={s.presenceBox} data-review-id="Session/Presence" data-review-section="Session · Presence" data-comment-target>
            <Presence
              state={stage.presence}
              level={stage.presence === "listening" ? (props.getMicLevel ? undefined : props.micLevel) : props.voiceLevel}
              getLevel={stage.presence === "listening" ? props.getMicLevel : props.getVoiceLevel}
              reducedMotion={props.reducedMotion}
            />
          </div>
          {/* D92: the state text sits in the glow at the top (the glow is the same state), not in a row above the island. */}
          <div className={`${s.status}`} data-review-id="Session/Status" data-review-section="Session · Status" data-comment-target>
            <StatusPill state={stage.pill} label={stage.label} live={stage.live} sub={stage.sub} subFadeMs={stage.hint ? (props.hintMs ?? HINT_MS) : undefined} surface="glass" className={data.micTip && muted ? s.statusQuiet : undefined} />
          </div>
          <div className={s.scroll} onScroll={onScroll} {...scrollFocus}>
            <div className={`${s.flow}`}>
              {showTranscript ? (
                <Transcript
                  turns={data.transcript}
                  label={variant === "english" ? t("session.captions.transcriptEnglish") : t("session.transcript")}
                  recording={phase === "listening"}
                  footer={showHeard ? t("session.heard") : undefined}
                />
              ) : null}
              {interrupted ? <Interrupted kind={overlay === "interrupted-voice" ? "voice" : "engine"} handlers={handlers} info={data.interrupted} /> : null}
              {showTips ? <FirstTime input={input} pauseSec={data.pauseSec} english={variant === "english"} /> : null}
              {showSuggester && suggestOn && !interrupted ? <Suggester suggestion={data.suggestion} /> : null}
            </div>
          </div>
          {showJump(followState) ? (
            <div className={`${s.jumpWrap}`}>
              <Button variant="secondary" size="sm" iconRight="arrowDown" className={s.jump} data-track="session-jump-latest" onClick={() => send({ type: "jump" }, scrollBehavior())}>
                {t("session.captions.jump")}
              </Button>
            </div>
          ) : null}
          <div className={`${s.islandWrap}`} data-input={input}>
            <div ref={islandRef} className={s.dock}>
              <Banners overlay={overlay} browser={props.banners?.browser} storage={props.banners?.storage} typing={Boolean(props.banners?.browser) && input === "text"} notices={data.notices} handlers={handlers} />
              {showIsland ? (
                <div ref={islandBoxRef} className={s.islandBox} data-input={input} data-stacked={islandLayout === "stacked" || undefined}>
                  <SessionIsland
                    key={input}
                    variant={variant}
                    input={input}
                    phase={phase}
                    muted={muted}
                    micLevel={props.micLevel}
                    getMicLevel={props.getMicLevel}
                    data={data}
                    handlers={handlers}
                    model={model}
                    interrupted={interrupted}
                    voiceDown={overlay === "interrupted-voice"}
                    noSpeech={overlay === "browser" || Boolean(props.banners?.browser)}
                    layout={islandLayout}
                    compact={props.island ? props.island === "stacked" : compactIsland}
                                    moreOpen={props.initialOverlay === "more"}
                    showSuggester={showSuggester}
                    suggestOn={suggestOn}
                    onSuggest={(on) => { setSuggestOn(on); handlers?.onSetSuggest?.(on); }}
                    tools={props.tools ?? "open"}
                    onShortcuts={() => setShortcuts(true)}
                    onMicHelp={() => setMicHelp(true)}
                    sendLocked={sendLocked}
                    autoFocus={props.autoFocusComposer}
                    entering={entering && !morph}
                    morph={morph}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
      <MicHelpDialog
        reason={props.micHelpReason}
        open={(overlay === "mic-help" && !micHelpClosed) || micHelp}
        handlers={{
          ...handlers,
          onCloseMicHelp: closeMicHelp,
          onUseText: () => { closeMicHelp(); (handlers?.onUseText ?? handlers?.onTypeInstead)?.(); },
          onTryAgain: () => { closeMicHelp(); handlers?.onTryAgain?.(); },
        }}
      />
      <ShortcutsDialog
        open={shortcuts}
        onClose={() => setShortcuts(false)}
        input={input}
        variant={variant}
        onMicHelp={voice ? () => { setShortcuts(false); setMicHelp(true); } : undefined}
      />
    </div>
  );
}
