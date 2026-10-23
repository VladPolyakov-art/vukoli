/* Session route: the live container. It owns the socket / audio (useSession) and maps the reducer to the pure
 * SessionView (screens/session/SessionView.tsx); the review page and Storybook render the same view from fixtures.
 * Terminal states (failed, saving, not started from Practice) stay here as centred messages. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Callout, EmptyState, motionMemory } from "../ds";
import { t, tMaybe } from "../i18n";
import { api } from "../lib/api";
import { useElapsed } from "../lib/hooks";
import { pendingSave } from "../lib/pendingSave";
import { useStorageWritable } from "../lib/storageProbe";
import { useApp } from "../lib/store";
import { sessionUtScreen, useUtScreen } from "../lib/utScreen";
import type { EngineId } from "../lib/types";
import { selectThreads, type SessionState } from "../session/reducer";
import { editTargets, heardEdit, recheckEdits } from "../session/recheck";
import { useSession, type SessionConfig } from "../session/useSession";
import { endingLine } from "./session/ending";
import { SessionView } from "./session/SessionView";
import type { PanelMode, SessionData, SessionHandlers, SessionOverlay, SessionPhase, TranscriptTurn } from "./session/types";
import s from "./Session.module.css";

interface LocationState { config?: SessionConfig; title?: string; /** A drill: the weak spots it works on. */ focus?: string }

export function SessionScreen() {
  const location = useLocation();
  // Coming back Home after a session replays the Home build-up (docs/motion.md 3.1).
  useEffect(() => () => { motionMemory.returnFromSession = true; }, []);
  const st = (location.state ?? {}) as LocationState;
  useUtScreen(sessionUtScreen(st.config?.start.mode));   // user-test screen name (13b)
  if (!st.config) {
    return (
      <main className={s.center} id="main">
        <EmptyState icon="info" title={t("session.missing")} actions={<Link to="/" data-track="session-back-home">{t("session.backHome")}</Link>} />
      </main>
    );
  }
  return <LiveSession config={st.config} title={st.title || t("session.title")} focus={st.focus} />;
}

const ENGINE_CODES = new Set(["not_installed", "not_running", "no_model", "not_configured", "unreachable", "unauthorized", "billing_required"]);
const STRICT = { 1: "gentle", 2: "standard", 3: "tough" } as const;
/** The mic problems that open the help dialog by themselves (US-06 AC2); the rest are plain notices. */
const MIC_HELP: Record<string, "blocked" | "none"> = { not_allowed: "blocked", not_found: "none" };

/** The transcript as a Markdown file for the user to keep when the session could not be saved (US-23 AC4). */
function downloadTranscript(title: string, items: SessionState["transcript"]) {
  const body = items.map((x) => `**${x.speaker === "user" ? t("session.you") : t("session.interviewer")}:** ${x.text}`).join("\n\n");
  const url = URL.createObjectURL(new Blob([`# ${title}\n\n${body}\n`], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "transcript.md";
  a.click();
  URL.revokeObjectURL(url);
}

/** The reducer's flags -> the view's phase (ds/screens/session.md §4). The live app never shows "between": Mike goes on
 * by himself after an answer, so the feedback panel simply updates beside the stage. */
function phaseOf(state: SessionState, playing: boolean): SessionPhase {
  if (state.phase === "connecting" || (!state.ready && !state.transcript.length)) return "connecting";
  if (state.closing) return "between";
  if (state.recording) return "listening";
  if (playing || state.mikeTurnOpen) return "mike-speaking";
  if (state.awaitingReply) return "thinking";
  return "your-turn";
}

function LiveSession({ config, title, focus }: { config: SessionConfig; title: string; focus?: string }) {
  const navigate = useNavigate();
  const { settings } = useApp();
  const { state, playing, muted, micError, actions, getLevel } = useSession(config);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [readyMsg, setReadyMsg] = useState("");
  const [browserDismissed, setBrowserDismissed] = useState(false);
  const storageOk = useStorageWritable();
  const live = state.phase === "live";
  const voice = state.input !== "text";
  const english = state.mode === "english";

  useEffect(() => {
    if (live && startedAt === null) setStartedAt(Date.now());
  }, [live, startedAt]);
  const elapsed = useElapsed(startedAt, live || state.phase === "connecting");

  /* Done and saved while still here (the server ended the session): go to the debrief. */
  useEffect(() => {
    if (state.phase === "done" && state.savedSessionId && !state.interrupted) navigate(`/sessions/${state.savedSessionId}`, { replace: true });
  }, [state.phase, state.savedSessionId, state.interrupted, navigate]);

  const threads = useMemo(() => selectThreads(state), [state]);
  const userTurns = state.transcript.filter((x) => x.speaker === "user").length;

  /* "Edit what I said" (US-18 AC3): the editor lives in the feedback panel; saving sends only the changed answers to
   * be checked again over the socket. The draft stays until the check succeeds, so a failure opens the editor again
   * with the user's words and the reason (nothing is lost, the old feedback is untouched). */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ answer: string; followUp?: string } | null>(null);
  const recheckBusy = Object.keys(state.rechecking).length > 0;
  const threadKey = threads.at(-1)?.key;
  useEffect(() => { setEditing(false); setDraft(null); }, [threadKey]);
  useEffect(() => {
    if (state.recheckError && draft && !recheckBusy) setEditing(true);
    else if (!state.recheckError && !recheckBusy && draft && !editing) setDraft(null);
  }, [state.recheckError, recheckBusy, draft, editing]);

  /* D73: with an answer on record the server saves the session and writes the debrief by itself (the socket is not
   * needed), so End goes Home at once and the shell's toast says when it is ready (lib/pendingSave). Without an
   * answer nothing is saved: stay for that message. */
  const end = () => {
    const id = state.sessionId;
    const leave = !!id && userTurns > 0 && storageOk && (state.phase === "live" || state.phase === "connecting" || !!state.interrupted);
    actions.end();
    if (!leave) return;
    pendingSave.start(id);
    navigate("/", { replace: true });
  };
  const questionIndex = state.threadOrder.indexOf(state.currentThreadId);
  const total = state.questions.length;
  const phase: SessionPhase = state.interrupted ? "interrupted" : phaseOf(state, playing);

  /* US-13 AC5 (D94): Resume on the interrupted card turns on once the engine answers again (checked every few seconds
   * while the card shows); a dropped connection can always be tried again. Gemini Live cannot pick a session up again. */
  const paused = state.interrupted;
  const engineWait = paused?.kind === "engine" && !paused.resuming ? state.engine : "";
  const [engineReady, setEngineReady] = useState(false);
  useEffect(() => {
    if (!engineWait) { setEngineReady(false); return; }
    let alive = true;
    const check = () => { api.engineStatus(engineWait as EngineId).then((r) => { if (alive) setEngineReady(r.ready); }).catch(() => { if (alive) setEngineReady(false); }); };
    check();
    const id = window.setInterval(check, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, [engineWait]);
  const geminiGone = paused?.ended && state.engine === "gemini_live";
  const canResume = !geminiGone && (paused?.kind === "voice" || engineReady || !!paused?.ended);

  /* US-23 AC1 / D73 guard: closing the tab mid-session would lose the answers (nothing is saved before End); ask first.
   * After End the work goes on in the server, so the guard is off then. */
  const guard = live && userTurns > 0 && !state.interrupted;
  useEffect(() => {
    if (!guard) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [guard]);

  /* D96: no feedback is made during the call, so nothing is announced as "ready" here. The polite live region below
   * only carries the muted-mic tip. */

  /* D72: the muted-speech tooltip over the mic goes away once the mic is on again or after a few seconds; screen
   * readers hear it through the polite live region (a tooltip is not announced). */
  const mutedTalk = state.notice?.code === "muted_speech";
  useEffect(() => {
    if (!mutedTalk) return;
    if (!muted) { actions.dismissNotice(); return; }
    setReadyMsg(t("session.notice.mutedSpeech"));
    const id = window.setTimeout(actions.dismissNotice, 6000);
    return () => window.clearTimeout(id);
  }, [mutedTalk, muted, actions]);

  /* The tab says where you are (session.md §V2.3: the title left the screen for the More menu). */
  useEffect(() => {
    if (!live) return;
    const prev = document.title;
    const where = english ? t("session.turn", { n: userTurns + 1 }) : total && questionIndex >= 0 ? t("session.progress", { n: questionIndex + 1, total }) : "";
    document.title = [where, title].filter(Boolean).join(" · ");
    return () => { document.title = prev; };
  }, [live, title, english, userTurns, total, questionIndex]);

  /* ---------- terminal states ---------- */
  if (state.phase === "failed" && !state.interrupted) {
    const code = state.fatal?.code ?? "session_failed";
    const engine = ENGINE_CODES.has(code);
    return (
      <main className={s.center} id="main">
        <Callout
          tone="error"
          live="alert"
          title={engine ? t("session.errors.engineTitle") : t("session.errors.title")}
          actions={engine ? <Link to="/settings/engine" data-track="session-fix-engine">{t("session.errors.fixEngine")}</Link> : <Link to="/" data-track="session-back-home">{t("session.backHome")}</Link>}
        >
          {engine
            ? [state.fatal?.message, state.fatal?.hint].filter(Boolean).join(" ")
            : code === "bad_start"
              ? t("session.errors.bad_start", { message: state.fatal?.message ?? "" })
              : tMaybe(`session.errors.${code}`, state.fatal?.message || t("session.errors.session_failed"))}
        </Callout>
        {engine ? <Link to="/" data-track="session-back-home">{t("session.backHome")}</Link> : null}
      </main>
    );
  }
  if (state.phase === "done" && !state.savedSessionId && !state.interrupted) {
    return (
      <main className={s.center} id="main">
        <EmptyState
          icon="info"
          title={t("session.orb.ended")}
          actions={(
            <>
              {state.saveError && state.transcript.length ? <Button variant="secondary" icon="download" data-track="session-download-transcript" onClick={() => downloadTranscript(title, state.transcript)}>{t("session.errors.downloadTranscript")}</Button> : null}
              <Button variant="primary" data-track="session-back-home" onClick={() => navigate("/")}>{t("session.backHome")}</Button>
            </>
          )}
        >
          {state.saveError ? t("session.errors.saveFailed") + " " + state.saveError : t("session.notSaved")}
        </EmptyState>
      </main>
    );
  }
  if (!state.interrupted && (state.phase === "ending" || state.phase === "saving" || state.phase === "debrief_pending" || state.phase === "done")) {
    return (
      <main className={s.center} id="main">
        <p className="shimmer-text" role="status" aria-busy="true">
          {endingLine(state)}
        </p>
        {state.saveError ? <Callout tone="error">{t("session.errors.saveFailed")} {state.saveError}</Callout> : null}
      </main>
    );
  }

  /* ---------- live: reducer -> view props ---------- */
  const start = config.start;
  const current = threads.at(-1) ?? null;
  const progress = english
    ? t("session.turn", { n: userTurns + 1 })
    : total && questionIndex >= 0 ? t("session.progress", { n: questionIndex + 1, total }) : "";
  const roundLabel = start.round_type ? t(`session.round.${start.round_type}`) : "";
  const strictLabel = start.strictness && STRICT[start.strictness as 1 | 2 | 3] ? t(`session.strict.${STRICT[start.strictness as 1 | 2 | 3]}`) : "";
  const drill = !english && start.drill === true;
  const sub = english ? undefined
    : drill && focus ? t("session.focus", { spots: focus })
      : [roundLabel, strictLabel].filter(Boolean).join(" · ") || undefined;

  /* The running transcript (D49): the whole dialogue, newest last. Mike's first line of each thread opens "Question N";
   * follow-ups get their badge. The interim words of the answer being recorded ride on a last user line. */
  const opened = new Set<string>();
  const transcript: TranscriptTurn[] = state.transcript.map((x) => {
    const mike = x.speaker !== "user";
    let question: number | undefined;
    if (mike && !english && x.kind === "question" && x.threadId && !opened.has(x.threadId)) {
      opened.add(x.threadId);
      const n = state.threadOrder.indexOf(x.threadId);
      question = n >= 0 ? n + 1 : undefined;
    }
    return {
      id: x.key,
      speaker: mike ? "mike" : "user",
      name: mike ? t("session.interviewer") : voice ? t("session.you") : t("session.captions.youTyped"),
      text: x.text,
      question,
      followUp: mike && x.kind === "follow_up" ? true : undefined,
    };
  });
  if (state.recording && state.preview) transcript.push({ id: "interim", speaker: "user", name: t("session.you"), text: "", interim: state.preview });

  const notices: NonNullable<SessionData["notices"]> = [];
  if (!state.recording) {
    if (micError && micError !== "stt_unsupported" && !MIC_HELP[micError]) notices.push({ id: "mic", tone: "warning", text: tMaybe(`session.mic.${micError}`, t("session.mic.failed")) });
    if (state.notice && state.notice.code !== "muted_speech") notices.push({ id: "notice", tone: "info", text: state.notice.message, onDismiss: actions.dismissNotice });
    if (state.error) notices.push({ id: "error", tone: "error", text: [state.error.message, state.error.hint].filter(Boolean).join(" "), onDismiss: actions.dismissError });
    if (state.closing) notices.push({ id: "closing", tone: "info", title: t("session.closing.title"), text: t("session.closing.body"), action: { label: t("session.closing.debrief"), onClick: end } });
  }

  const suggestion = state.suggestion
    ? { status: state.suggestion.status, story: state.suggestion.story, answer: state.suggestion.answer, points: state.suggestion.points, message: state.suggestion.message }
    : undefined;

  const data: SessionData = {
    micTip: state.notice?.code === "muted_speech" && !state.recording ? state.notice.message : undefined,
    title,
    sub,
    badges: english && start.level ? [{ label: start.level, tone: "outline", icon: "language" }] : undefined,
    progress,
    step: !english && total && questionIndex >= 0 ? { n: questionIndex + 1, of: total } : undefined,
    elapsed,
    question: state.currentQuestionText,
    followUp: state.followUps.at(-1),
    transcript,
    answered: userTurns > 0,
    thread: current,
    earlier: threads.slice(0, -1).reverse(),
    nextNumber: null,
    suggestion,
    suggestOn: state.suggestOn,
    stronger: state.stronger,
    pauseSec: config.pauseSec,
    notices,
    closing: state.closing,
    interrupted: paused
      ? { engine: state.engine as EngineId, input: state.input === "text" ? "text" : "voice", canResume, resuming: paused.resuming, failed: paused.failed }
      : undefined,
  };
  if (editing && current) {
    const { main, follow } = editTargets(current.records);
    data.edit = {
      answer: draft?.answer ?? main?.answer ?? "",
      followUp: draft ? draft.followUp : follow?.answer,
      error: state.recheckError ? tMaybe(`session.edit.err.${state.recheckError.code}`, t("session.edit.failed")) : undefined,
    };
  }
  // A failed "No, I said..." has no editor to come back to: say so as a notice.
  if (state.recheckError && !draft && !editing && !state.recording) {
    notices.push({ id: "recheck", tone: "error", text: tMaybe(`session.edit.err.${state.recheckError.code}`, t("session.edit.failed")), onDismiss: actions.dismissRecheckError });
  }

  /* D96: the panel says "Feedback comes after the call" for every new answer (p0). Only a continued session shows the
   * feedback it already had (p3, the "Edit what I said" editor and its check); nothing new appears while the user speaks. */
  const rechecking = Boolean(current?.records.some((r) => state.rechecking[r.id]));
  const canEdit = Boolean(current && !state.recording && !rechecking && current.records.length && !current.pendingIds.length && current.records.every((r) => r.complete));
  const panel: PanelMode = state.recording ? "p0"
    : editing ? "edit"
    : rechecking ? "recheck"
    : current?.records.length && canEdit ? "p3" : "p0";

  const micHelp = micError ? MIC_HELP[micError] : undefined;
  const overlay: SessionOverlay = paused ? (paused.kind === "engine" ? "interrupted-engine" : "interrupted-voice") : micHelp ? "mic-help" : "none";

  const handlers: SessionHandlers = {
    onEnd: end,
    onToggleMute: actions.toggleMute,
    onInterrupt: actions.interrupt,
    onSendNow: actions.sendNow,
    onRedo: actions.redo,
    onTypeInstead: actions.switchToText,
    onUseVoice: actions.switchToVoice,
    // D66: the mic help dialog's ways forward (they did nothing in the live app).
    onUseText: () => (state.interrupted ? actions.resume("text") : actions.switchToText()),
    onResume: () => actions.resume(),
    onDismissBanner: () => setBrowserDismissed(true),
    onFixSettings: () => { window.open("/settings/privacy", "_blank", "noopener"); },
    onTryAgain: actions.retryMic,
    onSendText: actions.sendText,
    onFlag: actions.flag,
    onStronger: actions.stronger,
    onSetSuggest: actions.setSuggest,
    onSeeDebrief: end,
    onEdit: canEdit ? () => { actions.dismissRecheckError(); setEditing(true); } : undefined,
    onSaveEdit: (answer, followUp) => {
      const edits = recheckEdits(current?.records ?? [], answer, followUp);
      setEditing(false);
      if (!edits.length) { setDraft(null); return; }
      setDraft({ answer, followUp });
      actions.recheck(edits);
    },
    onCancelEdit: () => { actions.dismissRecheckError(); setEditing(false); setDraft(null); },
    onSaveHeard: (feedbackId, flagId, said) => {
      const edit = heardEdit(state.feedback[feedbackId], flagId, said);
      if (edit) actions.recheck([edit]);
    },
  };

  return (
    <div className={s.screen}>
      <span className="visually-hidden" role="status" aria-live="polite">{readyMsg}</span>
      <SessionView
        variant={english ? "english" : drill ? "drill" : "interview"}
        input={voice ? "voice" : "text"}
        phase={phase}
        overlay={overlay}
        micHelpReason={micHelp}
        banners={{ browser: micError === "stt_unsupported" && !browserDismissed, storage: !storageOk }}
        firstTime={userTurns === 0 && !state.closing}
        muted={muted}
        micLevel={0}
        getMicLevel={getLevel}
        layerOrder={settings?.layer_order ?? "content-first"}
        withChecks={Boolean(state.stt?.word_confidence)}
        suggester={!english && state.suggesterAvailable && settings?.answer_suggester !== false ? "on" : "off"}
        data={data}
        handlers={handlers}
        panel={panel}
        panelOpen={editing || rechecking ? true : undefined}
        entering
        autoFocusComposer
        globalKeys
      />
    </div>
  );
}
