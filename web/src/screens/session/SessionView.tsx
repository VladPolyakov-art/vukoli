/* The Session screen as a pure view (ds/screens/session.md §0): everything comes from props, nothing from audio, the
 * store or the network. The live container (screens/Session.tsx) maps the reducer to these props; the review page and
 * the stories pass fixtures.
 * v2 (§V2, D47c): no top bar and no dock. Every control lives in one floating island at the bottom centre of the stage;
 * the context (title, round) moved into the island's More menu. The feedback panel is opened from the island:
 * wide (>= 1024) a floating panel on the right (the stage shifts left to stay centred), mid (768-1023) a right Drawer,
 * narrow (< 768) a bottom sheet. Only the panel swap and the island's two rows (< 560) are done in JS (the Drawer is a
 * portal); every other rule is a CSS container query on the root (`session`).
 * V2.1 (D49): the centre is the running transcript of the whole dialogue (newest at the bottom, follows unless the user
 * scrolled up → "Jump to latest"). Mike's presence is a glow along the top edge (ds/Presence), only while someone talks
 * or Mike thinks; the transcript starts in its lower part (D91). The one state text sits in the glow, top centre (D92). */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, Drawer, IconButton, Panel, Presence, scrollBehavior, StatusPill, usePresence, useScrollFocusable } from "../../ds";
import { t } from "../../i18n";
import { Banners } from "./parts/Banners";
import { FirstTime } from "./parts/FirstTime";
import { Interrupted } from "./parts/Interrupted";
import { islandModel, SessionIsland } from "./parts/Island";
import { MicHelpDialog } from "./parts/MicHelpDialog";
import { PanelBody, type ConcretePanel } from "./parts/PanelBody";
import { ShortcutsDialog } from "./parts/ShortcutsDialog";
import { Suggester } from "./parts/Suggester";
import { Transcript } from "./parts/Transcript";
import { opensItself, readyKey } from "./feedbackWatch";
import { HINT_MS, stageFor } from "./stage";
import { follow, FOLLOW_START, isAtBottom, showJump, type FollowEvent, type FollowState } from "./transcriptScroll";
import type { SessionPhase, SessionViewProps } from "./types";
import { useIslandOverflow, useSessionLayout } from "./useSessionLayout";
import s from "./SessionView.module.css";

/** Spec P0..P4 from the phase, unless the caller (the live container) says what to show. */
function resolvePanel(p: SessionViewProps): ConcretePanel {
  if (p.panel && p.panel !== "auto") return p.panel;
  switch (p.phase) {
    case "editing": return "edit";
    case "rechecking": return "recheck";
    case "preparing": return "p2";
    case "unavailable": return "p4";
    case "feedback":
    case "between": return "p3";
    case "interrupted":
    case "saving": return p.data.thread?.records.length ? "p3" : p.data.answered ? "p1" : "p0";
    default: return p.data.answered ? "p1" : "p0";
  }
}

/** Panel modes that open the panel on their own (feedback is there or on its way). */
const OPEN_MODES = new Set<ConcretePanel>(["p2", "p3", "p4", "edit", "recheck"]);
/** Phases in which the panel never opens on its own: Mike asks, the user answers (GR6), the session starts. */
const QUIET = new Set<SessionPhase>(["connecting", "mike-speaking", "your-turn", "listening", "thinking"]);

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

export function SessionView(props: SessionViewProps) {
  const { variant, input, phase, overlay, muted, data, handlers, entering } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFocus = useScrollFocusable(t("session.transcript"), scrollRef); // QA-09: reachable by keyboard when it scrolls
  const islandRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLButtonElement>(null);
  const islandBoxRef = useRef<HTMLDivElement>(null);
  const { layout, stacked: narrowIsland, compact: compactIsland } = useSessionLayout(rootRef);
  const overflowIsland = useIslandOverflow(islandBoxRef, !props.island && !narrowIsland);
  const islandLayout = props.island ?? (narrowIsland || overflowIsland ? "stacked" : "inline");
  const wide = layout === "wide";
  const compact = layout === "narrow";
  const voice = input === "voice";
  const interrupted = phase === "interrupted" || overlay === "interrupted-engine" || overlay === "interrupted-voice";
  const stage = stageFor({ ...props, phase: interrupted ? "interrupted" : phase });
  const panelMode = resolvePanel(props);
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
  /* The scroller can change height with nothing new in it (a notice, the panel, the window): if the transcript was
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
  const th = data.thread;
  const hasFeedback = Boolean(data.answered || th?.records.length || th?.pendingIds.length || th?.unavailable.length || data.earlier.length);
  const model = islandModel({ variant, input, phase, muted, interrupted, data, handlers, hasFeedback });

  /* ---------- feedback panel (13, QA-01; rules in feedbackWatch.ts). The designed frames (p2/p3/p4/edit/recheck in
   * a phase that is not quiet) open it as before. In the live app every phase is quiet, so what opens it is the
   * feedback itself: on wide it opens by itself when ready feedback arrives (not while the user talks); on mid and
   * narrow a dot on the toggle says it is ready. The user's own toggle wins: a close they made keeps it shut until
   * they open it again; their open or close holds until the panel's mode changes. ---------- */
  const autoOpen = OPEN_MODES.has(panelMode) && !QUIET.has(phase) && !(interrupted && !wide);
  const autoKey = `${th?.number ?? 0}:${panelMode}:${autoOpen}`;
  const [manual, setManual] = useState<{ key: string; open: boolean } | null>(null);
  const ready = readyKey(th);
  const [seen, setSeen] = useState(ready);             // feedback that is there on arrival counts as seen
  const [selfOpened, setSelfOpened] = useState(false); // opened by itself on wide: stays until the user closes it
  const [closedByUser, setClosedByUser] = useState(false);
  const fresh = ready !== null && ready !== seen;
  const opensNow = fresh && opensItself({ layout, phase: interrupted ? "interrupted" : phase, suppressed: closedByUser });
  const wanted = manual?.key === autoKey ? manual.open : props.panelOpen ?? (autoOpen || (wide && selfOpened) || opensNow);
  const panelOpen = model.feedback.enabled && wanted;
  useEffect(() => {
    if (!fresh || !panelOpen) return;
    setSeen(ready);
    if (opensNow) setSelfOpened(true);
  }, [fresh, panelOpen, opensNow, ready]);
  /* Ready feedback the user has not seen with the panel open: the dot (stories can force it with `feedbackUnread`). */
  const unread = props.feedbackUnread ?? (fresh && !panelOpen);
  const setPanel = (open: boolean, returnFocus = false) => {
    setManual({ key: autoKey, open });
    setClosedByUser(!open);
    if (!open) setSelfOpened(false);
    if (!open && returnFocus) feedbackRef.current?.focus({ preventScroll: true });
  };
  const floating = usePresence(wide && panelOpen);

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

  /* ---------- keyboard (V2.8) ---------- */
  const onKey = (e: KeyboardEvent | ReactKeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (e.key === "Escape") {
      if (wide && panelOpen) { e.preventDefault(); setPanel(false, true); }
      return;
    }
    if (inTextField(target)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const onButton = target?.tagName === "BUTTON";
    const live = !interrupted && phase !== "connecting" && phase !== "saving";
    const run = (fn?: () => void) => { if (fn) { e.preventDefault(); fn(); } };
    if (key === "?") run(() => setShortcuts(true));
    else if (key === "f" && model.feedback.enabled) run(() => setPanel(!panelOpen));
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

  const label = variant === "english"
    ? t("feedback.turn", { n: th?.number ?? 0 })
    : t("session.panel.feedbackFor", { n: th?.number ?? 0 });

  /* Panel footer: Next question again (two ways to one action). On wide the island's is the primary, so this one is
   * secondary (one primary per view, V2.4 🟡); the sheet covers the island on mid / narrow, so there it is primary. */
  const footer = (() => {
    if (variant === "english" || !["p3", "p4", "edit"].includes(panelMode)) return null;
    const last = data.nextNumber === null;
    const onClick = last ? handlers?.onSeeDebrief : handlers?.onNext;
    if (!onClick) return null;
    return (
      <Button
        variant={wide || panelMode === "edit" ? "secondary" : "primary"}
        size={compact ? "lg" : "md"}
        fullWidth
        iconRight="arrowRight"
        data-track={last ? "see-debrief" : "next-question"}
        disabled={interrupted}
        onClick={onClick}
      >
        {last ? t("session.panel.seeDebrief") : t("session.panel.nextQuestion")}
      </Button>
    );
  })();

  const body = (
    <PanelBody
      mode={panelMode}
      variant={variant}
      input={input}
      data={data}
      layerOrder={props.layerOrder}
      withChecks={props.withChecks}
      handlers={handlers}
      initialOpenHeard={props.initialOpenHeard}
      defaultShowAnswer={props.defaultShowAnswer}
      defaultStrongerOpen={props.defaultStrongerOpen}
    />
  );

  const sendLocked = Boolean(handlers?.onNext) && (phase === "between" || phase === "feedback" || phase === "editing" || phase === "rechecking" || phase === "preparing" || phase === "unavailable");
  /* The whole dialogue, every phase (D49); "What we heard" under the user's latest voice answer. */
  const showTranscript = data.transcript.length > 0 || thinking;
  
  const showTips = props.firstTime && !interrupted && phase !== "saving";
  const showHeard = voice && !interrupted && lastTurn?.speaker === "user";
  const showIsland = phase !== "saving" && !data.closing;
  const shifted = wide && panelOpen;

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-layout={layout}
      data-panel={shifted ? "open" : undefined}
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
          <div className={`${s.status} ${s.shift}`} data-review-id="Session/Status" data-review-section="Session · Status" data-comment-target>
            <StatusPill state={stage.pill} label={stage.label} live={stage.live} sub={stage.sub} subFadeMs={stage.hint ? (props.hintMs ?? HINT_MS) : undefined} surface="glass" className={data.micTip && muted ? s.statusQuiet : undefined} />
          </div>
          <div className={s.scroll} onScroll={onScroll} {...scrollFocus}>
            <div className={`${s.flow} ${s.shift}`}>
              {showTranscript ? (
                <Transcript
                  turns={data.transcript}
                  label={variant === "english" ? t("session.captions.transcriptEnglish") : t("session.transcript")}
                  recording={phase === "listening"}
                  footer={showHeard ? t("session.heard") : undefined}
                />
              ) : null}
              {interrupted ? <Interrupted kind={overlay === "interrupted-voice" ? "voice" : "engine"} handlers={handlers} info={data.interrupted} /> : null}
              {showTips ? <FirstTime input={input} pauseSec={data.pauseSec} layout={layout} english={variant === "english"} /> : null}
              {showSuggester && suggestOn && !interrupted ? <Suggester suggestion={data.suggestion} /> : null}
            </div>
          </div>
          {showJump(followState) ? (
            <div className={`${s.jumpWrap} ${s.shift}`}>
              <Button variant="secondary" size="sm" iconRight="arrowDown" className={s.jump} data-track="session-jump-latest" onClick={() => send({ type: "jump" }, scrollBehavior())}>
                {t("session.captions.jump")}
              </Button>
            </div>
          ) : null}
          <div className={`${s.islandWrap} ${s.shift}`} data-input={input}>
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
                    panelOpen={panelOpen}
                    feedbackUnread={unread}
                    onToggleFeedback={() => setPanel(!panelOpen)}
                    feedbackRef={feedbackRef}
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
        {wide && floating.mounted ? (
          <div
            className={`${s.float} ${floating.leaving ? s.floatOut : s.floatIn}`}
            data-review-id="Session/Panel"
            data-review-section="Session · Feedback panel"
            data-comment-target
          >
            <Panel
              as="aside"
              title={t("feedback.panel")}
              labelId="session-feedback-title"
              footer={footer}
              className={s.panel}
              actions={<IconButton icon="x" size="sm" label={t("session.island.feedbackHide")} data-track="feedback-close" onClick={() => setPanel(false, true)} />}
            >
              {body}
            </Panel>
          </div>
        ) : null}
      </div>
      {!wide ? (
        <Drawer
          open={panelOpen}
          onClose={() => setPanel(false, true)}
          side={layout === "mid" ? "right" : "bottom"}
          label={label}
          title={t("feedback.panel")}
          closeLabel={t("session.island.feedbackHide")}
          footer={footer}
          duration="slower"
        >
          <div data-review-id="Session/Panel" data-review-section="Session · Feedback panel" data-comment-target>{body}</div>
        </Drawer>
      ) : null}
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
