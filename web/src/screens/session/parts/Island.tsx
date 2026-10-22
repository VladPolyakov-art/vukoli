/* Session island (session.md §V2, D47c): the one floating control surface of the Session, on DS `Island` (G21).
 * It replaces the v1 top bar + dock. Four groups — Status · Voice · Tools · Exit — with a fixed set per variant:
 * a control that can't act now is disabled with the reason in its tooltip, never hidden (V2.1).
 * - Voice: one pill row. Text mode: a box, the Composer (`surface="none"`) on top and the controls without the mic.
 * - `stacked` (<560, phones, V2.7): two rows; Redo moves into More.
 * - Connecting (S9): a Dots pill fills groups 1-3, only End stays.
 * - Nothing in the island changes while the user speaks except the mic ring (GR6): the main action becomes Send now
 *   at the moment listening starts, and the toggles keep their state.
 * - D62 `tools`: "open" (default) = nothing behind More on wide: the sample-answer toggle, Feedback and a help button
 *   (shortcuts + mic help) are icons, the context is the status tooltip; "menu" = the same icons, but shortcuts, mic
 *   help and the context stay in More. Phones (stacked) always keep More. */
import { useState, type Ref } from "react";
import { Badge, Button, Composer, Dots, Island, IconButton, Menu, MicButton, Tooltip, type IconName, type IslandGroup, type MenuEntry } from "../../../ds";
import { t } from "../../../i18n";
import { clock } from "../clock";
import type { SessionData, SessionHandlers, SessionInput, SessionPhase, SessionVariant } from "../types";
import s from "./Island.module.css";

/** The main action slot of the Voice group (V2.2). */
type Main =
  | { kind: "button"; id: string; label: string; icon: IconName; variant: "primary" | "secondary"; iconRight?: boolean; disabled?: boolean; onClick?: () => void }
  | { kind: "dots"; label: string }
  | null;

export interface IslandModel {
  /** Main action and Redo / Feedback availability, derived once by the view (the keyboard uses the same model). */
  main: Main;
  canRedo: boolean;
  redoReason?: string;
  feedback: { enabled: boolean; reason?: string };
}

const AFTER = new Set<SessionPhase>(["between", "feedback", "unavailable", "editing"]);

/** What the island offers in this phase (V2.2). Shared by the island and the keyboard shortcuts (V2.8). */
export function islandModel(p: {
  variant: SessionVariant; input: SessionInput; phase: SessionPhase; muted: boolean; interrupted: boolean; data: SessionData;
  handlers?: SessionHandlers; hasFeedback: boolean;
}): IslandModel {
  const { variant, input, phase, muted, interrupted, data, handlers: h } = p;
  const english = variant === "english";
  const voice = input === "voice";
  // English has no Next question: after the feedback the conversation goes on (it is the user's turn again).
  const yourTurn = phase === "your-turn" || (english && (AFTER.has(phase) || phase === "preparing"));

  let main: Main = null;
  if (interrupted || phase === "saving" || phase === "connecting") main = null;
  else if (phase === "mike-speaking") main = voice ? { kind: "button", id: "interrupt", label: t("session.controls.interrupt"), icon: "hand", variant: "secondary", onClick: h?.onInterrupt } : null;
  else if (phase === "listening") main = { kind: "button", id: "send", label: t("session.controls.sendNow"), icon: "send", variant: "primary", onClick: h?.onSendNow };
  else if (yourTurn) main = voice ? { kind: "button", id: "talk", label: t("session.controls.talk"), icon: "mic", variant: "secondary", disabled: muted, onClick: h?.onInterrupt } : null;
  // Thinking (D55: no dots, the glow and the state text say it). D61: the button you pressed stays, as a disabled
  // "Sent", so the slot never goes empty after a send.
  else if (phase === "thinking") main = { kind: "button", id: "sent", label: t("session.controls.sent"), icon: "check", variant: "secondary", disabled: true };
  else if (phase === "preparing" || phase === "rechecking") main = { kind: "dots", label: t("session.island.preparing") };
  else if (AFTER.has(phase)) {
    const last = data.nextNumber === null;
    const onClick = last ? h?.onSeeDebrief : h?.onNext;
    if (onClick) {
      main = {
        kind: "button", id: last ? "debrief" : "next", label: last ? t("session.panel.seeDebrief") : t("session.panel.nextQuestion"),
        icon: "arrowRight", iconRight: true, variant: phase === "editing" ? "secondary" : "primary", onClick,
      };
    }
  }

  const redoPhase = !interrupted && !["connecting", "mike-speaking", "listening", "saving"].includes(phase);
  const canRedo = data.answered && redoPhase && Boolean(h?.onRedo);
  const redoReason = canRedo ? undefined : !data.answered ? t("session.island.redoNone") : t("session.island.redoLater");

  // D62: the panel opens any time (before the first answer it says what is coming / that it is still in progress).
  void p.hasFeedback;
  const feedback = { enabled: true };
  return { main, canRedo, redoReason, feedback };
}

export interface SessionIslandProps {
  variant: SessionVariant;
  input: SessionInput;
  phase: SessionPhase;
  muted: boolean;
  micLevel: number;
  getMicLevel?: () => number;
  data: SessionData;
  handlers?: SessionHandlers;
  model: IslandModel;
  interrupted: boolean;
  /** 10b: the voice channel dropped, typing goes on. */
  voiceDown: boolean;
  /** The browser can't recognise speech (S12b): the mic is disabled with the reason. */
  noSpeech: boolean;
  layout: "inline" | "stacked";
  /** A phone-width stacked island (< 420): the text-mode tools go to the second row (13, QA-10). */
  compact?: boolean;
  panelOpen: boolean;
  /** QA-01: feedback is ready and the panel is closed: a dot on the toggle, and the name says so. */
  feedbackUnread?: boolean;
  onToggleFeedback: () => void;
  feedbackRef?: Ref<HTMLButtonElement>;
  /** More menu */
  moreOpen?: boolean;
  showSuggester: boolean;
  suggestOn: boolean;
  onSuggest: (on: boolean) => void;
  /** D62: "open" = no More menu on wide; "menu" = shortcuts, mic help and context stay in More. */
  tools: "open" | "menu";
  /** D63: the conversation on the stage is hidden (only Mike's current question). */
  onShortcuts: () => void;
  onMicHelp: () => void;
  /** Text mode: the send stays disabled while the panel waits for Next question. */
  sendLocked: boolean;
  autoFocus?: boolean;
  /** Play the island entrance (D5 dock-in) / the pill → box morph. */
  entering?: boolean;
  morph?: boolean;
}

function Status({ data, variant, entering, context, full }: Pick<SessionIslandProps, "data" | "variant" | "entering"> & { context?: boolean; full?: boolean }) {
  const total = Math.max(0, Math.floor(data.elapsed));
  const aria = t("session.elapsedAria", { m: Math.floor(total / 60), s: total % 60 });
  // D62: "2 of 5" alone didn't read as the question number: wide says "Question 2 of 5", phones "Q2 of 5".
  const short = variant === "english" || !data.step || full ? data.progress : t("session.island.step", { n: data.step.n, of: data.step.of });
  const status = (
    <span className={`${s.status} ${entering ? "motion-meta" : ""}`}>
      {short ? <span className={s.progress} aria-label={data.progress}>{short}</span> : null}
      <span className={s.timer} role="timer" aria-label={aria}><span aria-hidden="true">{clock(data.elapsed)}</span></span>
    </span>
  );
  // D62 tools "open": the context that lived in the More header is the status tooltip (🟡 hover only).
  if (!context) return status;
  const tip = [data.title, variant !== "english" ? data.sub : null, ...(data.badges ?? []).map((b) => b.label)].filter(Boolean).join(" · ");
  return <Tooltip content={tip} placement="top-start">{status}</Tooltip>;
}

/** The slot keeps the width of its longest label (V2.1: the island never changes width). Ghost copies of every label
 * this variant can show sit in the same grid cell, invisible and inert; the visible button stretches to it (D61). */
function MainSlot({ main, variant, stacked, sized = true }: { main: Main; variant: SessionVariant; stacked: boolean; sized?: boolean }) {
  const labels = variant === "english"
    ? [t("session.controls.interrupt"), t("session.controls.sendNow"), t("session.controls.talk"), t("session.controls.sent")]
    : [t("session.controls.interrupt"), t("session.controls.sendNow"), t("session.controls.talk"), t("session.controls.sent"), t("session.panel.nextQuestion"), t("session.panel.seeDebrief")];
  const size = stacked ? "lg" : "md";
  return (
    <span className={`${s.slot} ${stacked ? s.slotGrow : ""}`} data-review-id="Session/Island/Main">
      {stacked || !sized ? null : (
        <span className={s.sizer} aria-hidden="true" inert>
          {labels.map((l) => <Button key={l} size={size} icon="arrowRight" tabIndex={-1}>{l}</Button>)}
        </span>
      )}
      {main?.kind === "button" ? (
        <Button
          key={main.id}
          // The label swaps with a short rise (D6), except into Send now: the user has just started talking (rule 3).
          className={main.id === "send" ? undefined : "motion-rise-base"}
          variant={main.variant}
          size={size}
          icon={main.iconRight ? undefined : main.icon}
          iconRight={main.iconRight ? main.icon : undefined}
          // D61: the button fills the sized slot, so a short label leaves no gap before the next group.
          fullWidth={stacked || sized}
          data-track={main.id === "debrief" ? "see-debrief" : main.id === "next" ? "next-question" : `session-${main.id}`}
          disabled={main.disabled}
          onClick={main.onClick}
        >
          {main.label}
        </Button>
      ) : main?.kind === "dots" ? (
        <span key="dots" className={`${s.dots} motion-fade`} role="status"><Dots label={main.label} showLabel /></span>
      ) : <span aria-hidden="true" />}
    </span>
  );
}

function MenuHeader({ data, variant }: Pick<SessionIslandProps, "data" | "variant">) {
  return (
    <div className={s.menuHeader}>
      <Tooltip content={data.title} onlyWhenTruncated block>
        <span className={s.menuTitle} data-truncate>{data.title}</span>
      </Tooltip>
      {data.sub && variant !== "english" ? <span className={s.menuSub}>{data.sub}</span> : null}
      {data.badges?.length ? (
        <span className={s.menuBadges}>
          {data.badges.map((b) => <Badge key={b.label} tone={b.tone} icon={b.icon}>{b.label}</Badge>)}
        </span>
      ) : null}
    </div>
  );
}

function TextComposer({ phase, handlers: h, sendLocked, autoFocus }: Pick<SessionIslandProps, "phase" | "handlers" | "sendLocked" | "autoFocus">) {
  const [draft, setDraft] = useState("");
  const busy = phase === "mike-speaking" || phase === "thinking" || phase === "connecting";
  const canSend = !busy && !sendLocked && draft.trim().length > 0;
  const send = () => {
    if (canSend && h?.onSendText?.(draft)) setDraft("");
  };
  return (
    <Composer
      surface="none"
      label={t("session.input.label")}
      placeholder={t("session.input.placeholder")}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      submitOnEnter
      minRows={1}
      maxRows={6}
      autoFocus={autoFocus}
      send={{ label: t("session.input.send"), icon: "send", variant: "action", disabled: !canSend, track: "session-send-text", onSend: send }}
    />
  );
}

export function SessionIsland(p: SessionIslandProps) {
  const { variant, input, phase, data, handlers: h, model, layout, interrupted } = p;
  const voice = input === "voice";
  const stacked = layout === "stacked";
  const english = variant === "english";
  const endLabel = english ? t("session.endPractice") : t("session.end");
  const onEnd = interrupted ? h?.onEndAndDebrief ?? h?.onEnd : h?.onEnd;

  const end = (
    <Button variant="secondary" size={stacked ? "sm" : "md"} icon="stop" data-track="end-session" onClick={onEnd}>{endLabel}</Button>
  );

  if (phase === "connecting") {
    const pill = <Dots variant="pill" shimmer label={t("session.connectingPill")} fullWidth={stacked} />;
    // Phones: one group without the divider, so "Connecting to Mike…" fits next to End.
    const groups: IslandGroup[] = stacked
      ? [{ id: "connecting", grow: true, reviewId: "Session/Island/More", children: <><span className={s.grow}>{pill}</span>{end}</> }]
      : [
          { id: "connecting", grow: true, children: pill },
          { id: "exit", label: t("session.island.exit"), reviewId: "Session/Island/More", children: end },
        ];
    return (
      <Island
        label={t("session.controls.label")}
        layout="inline"
        groups={groups}
        className={`${s.island} ${stacked ? s.full : ""} ${p.entering ? "motion-dock" : ""}`}
        reviewId="Session/Island"
      />
    );
  }

  const micDisabled = interrupted || p.noSpeech;
  const micButton = voice ? (
    <MicButton
      label={p.muted ? t("session.controls.unmute") : t("session.controls.mute")}
      title={p.noSpeech ? t("session.island.voiceUnavailable") : interrupted ? t("session.island.micDisabled") : undefined}
      muted={p.muted}
      data-track="voice-toggle"
      live={!micDisabled && phase !== "saving"}
      level={p.getMicLevel ? undefined : p.micLevel}
      getLevel={p.getMicLevel}
      disabled={micDisabled}
      onClick={h?.onToggleMute}
    />
  ) : null;
  // D72: "you're talking while muted" points at the mic itself instead of a banner over the stage.
  const mic = micButton && p.data.micTip && p.muted
    ? <Tooltip content={p.data.micTip} open placement="top-start" size="lg">{micButton}</Tooltip>
    : micButton;

  const redo = (
    <IconButton
      icon="redo"
      label={t("session.island.redo")}
      data-track="session-redo"
      title={model.redoReason}
      disabled={!model.canRedo}
      onClick={h?.onRedo}
    />
  );
  const typeDisabled = voice ? interrupted && !p.voiceDown : true;
  const type = voice ? (
    <IconButton
      icon="keyboard"
      data-track="session-type-instead"
      label={t("session.island.type")}
      disabled={typeDisabled || !h?.onTypeInstead}
      onClick={p.voiceDown ? h?.onUseText ?? h?.onTypeInstead : h?.onTypeInstead}
    />
  ) : (
    // D64: back to voice in the same session (the server attaches speech recognition on the switch).
    <IconButton
      icon="mic"
      data-track="session-use-voice"
      label={t("session.island.toVoice")}
      title={p.noSpeech ? t("session.island.voiceUnavailable") : undefined}
      disabled={p.noSpeech || !h?.onUseVoice}
      onClick={h?.onUseVoice}
    />
  );
  const suggest = p.showSuggester ? (
    <IconButton
      icon="bulb"
      data-track="suggester-toggle"
      label={p.suggestOn ? t("session.island.suggestHide") : t("session.island.suggestShow")}
      pressed={p.suggestOn}
      onClick={() => p.onSuggest(!p.suggestOn)}
    />
  ) : null;
  const help = (
    <IconButton icon="help" label={t("session.island.help")} data-track="session-help" onClick={p.onShortcuts} />
  );
  const feedback = (
    <IconButton
      ref={p.feedbackRef}
      icon="panel"
      data-track="feedback-toggle"
      label={p.panelOpen ? t("session.island.feedbackHide") : p.feedbackUnread ? t("session.island.feedbackShowNew") : t("session.island.feedbackShow")}
      title={model.feedback.reason}
      pressed={p.panelOpen}
      dot={p.feedbackUnread && !p.panelOpen}
      disabled={!model.feedback.enabled}
      onClick={p.onToggleFeedback}
    />
  );

  const items: MenuEntry[] = [];
  if (stacked) items.push({ id: "redo", track: "session-redo", label: t("session.controls.redo"), icon: "redo", shortcut: "R", disabled: !model.canRedo, onSelect: h?.onRedo });
  items.push({ id: "shortcuts", track: "session-shortcuts", label: t("session.island.shortcuts"), icon: "keyboard", shortcut: "?", onSelect: p.onShortcuts });
  if (voice) items.push({ id: "mic-help", track: "mic-help", label: t("session.island.micHelp"), icon: "mic", onSelect: p.onMicHelp });
  if (p.noSpeech) items.push({ id: "voice", label: t("session.island.switchToVoice"), description: t("session.island.voiceUnavailable"), icon: "mic", disabled: true });

  const more = (
    <Menu
      label={t("session.island.menu")}
      items={items}
      header={<MenuHeader data={data} variant={variant} />}
      placement="top-end"
      defaultOpen={p.moreOpen}
      trigger={(tp) => <IconButton {...tp} icon="more" label={t("session.island.more")} data-track="session-more" />}
    />
  );

  // Text mode: the box is full width anyway, so the slot isn't sized; it takes the free space instead.
  const main = <MainSlot main={model.main} variant={variant} stacked={stacked} sized={voice} />;
  const open = p.tools === "open" && !stacked;
  const status = <Status data={data} variant={variant} entering={p.entering} context={open} full={!stacked} />;
  const exit = open ? <>{help}{end}</> : <>{more}{end}</>;

  const statusGroup = (row: 1 | 2, grow: boolean): IslandGroup => ({ id: "status", row, grow, label: t("session.island.status"), reviewId: "Session/Island/Status", children: status });
  let groups: IslandGroup[];
  if (voice) {
    groups = stacked
      ? [
          statusGroup(1, true),
          { id: "exit", row: 1, label: t("session.island.exit"), reviewId: "Session/Island/More", children: <>{feedback}{end}</> },
          { id: "voice", row: 2, grow: true, label: t("session.island.voice"), reviewId: "Session/Island/Controls", children: <>{mic}{main}</> },
          { id: "tools", row: 2, label: t("session.island.tools"), reviewId: "Session/Island/Tools", children: <>{type}{suggest}{more}</> },
        ]
      : [
          statusGroup(1, false),
          { id: "voice", label: t("session.island.voice"), reviewId: "Session/Island/Controls", children: <>{mic}{main}</> },
          { id: "tools", label: t("session.island.tools"), reviewId: "Session/Island/Tools", children: <>{redo}{type}{suggest}{feedback}</> },
          { id: "exit", label: t("session.island.exit"), reviewId: "Session/Island/More", children: exit },
        ];
  } else {
    // Text mode: no mic, the send lives in the composer. The main slot (Next question / Dots) shows only when there is
    // one, so the row never carries an empty group between two dividers.
    const mainGroup: IslandGroup | null = model.main
      ? { id: "voice", row: 2, grow: true, label: t("session.island.voice"), reviewId: "Session/Island/Controls", children: main }
      : null;
    const toolsGroup: IslandGroup = { id: "tools", row: p.compact ? 2 : 1, label: t("session.island.tools"), reviewId: "Session/Island/Tools", children: <>{type}{suggest}{feedback}{more}</> };
    const exitGroup: IslandGroup = { id: "exit", row: 1, label: t("session.island.exit"), reviewId: "Session/Island/More", children: end };
    groups = stacked && p.compact
      ? [
          statusGroup(1, true),
          exitGroup,
          mainGroup ?? { id: "spacer", row: 2, grow: true, children: null },
          toolsGroup,
        ]
      : stacked
      ? [
          statusGroup(1, true),
          toolsGroup,
          exitGroup,
          ...(mainGroup ? [mainGroup] : []),
        ]
      : [
          statusGroup(1, !mainGroup),
          ...(mainGroup ? [mainGroup] : []),
          { id: "tools", label: t("session.island.tools"), reviewId: "Session/Island/Tools", children: <>{redo}{type}{suggest}{feedback}</> },
          { id: "exit", label: t("session.island.exit"), reviewId: "Session/Island/More", children: exit },
        ];
  }

  return (
    <Island
      label={t("session.controls.label")}
      shape={voice ? "pill" : "box"}
      layout={layout}
      lead={voice ? undefined : <TextComposer phase={phase} handlers={h} sendLocked={p.sendLocked} autoFocus={p.autoFocus} />}
      groups={groups}
      morph={p.morph}
      className={`${s.island} ${stacked || !voice ? s.full : ""} ${p.entering ? "motion-dock" : ""}`}
      reviewId="Session/Island"
    />
  );
}
