/* Home v2, live: runs the scripted setup (script.ts) on real data and feeds HomeView. Real work behind a pending Mike
 * message: a pasted job / link / file is saved with api.createVacancy, then questions are prepared from it. A file sent
 * later in the chat (D89: +, paste or drop) is the job at the job question, otherwise the CV (api.uploadProfile).
 * Gaps the server has today (🟡, home.md §9): no "technical" round (runs as the mixed round, B2), no field for the
 * user's note (UI only, B3), no questions status (we track the prepare call, B5), the last interview's job and round
 * are not in SessionSummary (remembered job + remembered round, B8), Drill = a 3-question mixed session (B7), no
 * recurring-phrases data (English phrases empty). The greeting uses `settings.name` (Q4, US-08 AC3).
 * Quick start (D51 item 1, quickStart.ts): the round mic at the composer's end (D53) opens the session straight away with the last settings.
 * D90: in the chat with Mike that mic dictates into the field instead (audio/dictation.ts); the words join what's typed. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { durationMs, motionMemory, shouldBuildUp } from "../../ds";
import { t, tMaybe, tp } from "../../i18n";
import { VacancyEditor } from "../../components/VacancyEditor";
import { extractCompanyRole, jobName, splitTitle } from "../../components/vacancyTitle";
import { browserSttSupported } from "../../audio/browserStt";
import { useDictation } from "../../audio/dictation";
import { api, ApiError, fileToBase64 } from "../../lib/api";
import { useInterval, useLoad } from "../../lib/hooks";
import { useInstallOffer } from "../../lib/installApp";
import { prefs } from "../../lib/prefs";
import { useApp } from "../../lib/store";
import { homeUtScreen, useUtScreen } from "../../lib/utScreen";
import type { Vacancy } from "../../lib/types";
import { buildSessionConfig } from "../../session/startConfig";
import { homePrefs, shortDate } from "./homePrefs";
import { quickStartFor } from "./quickStart";
import { HomeView } from "./HomeView";
import {
  attach, begin, change, pick, planFor, removeNote, resolveCv, resolveJob, say, setupModel, skip, suggestionsFor, updateJob,
  type ScriptContext, type SetupState,
} from "./script";
import type { EnglishTopic, JobItem, PlanModel, Track, WeakItem } from "./types";

let browserBannerDismissed = false;
const TOPICS: EnglishTopic[] = ["free", "work", "small"];
/** QA-02 🟡: how long Start waits for the job's questions. Past it the plan says general questions will be used (the
 * user can try again); if the answer arrives later after all, the plan turns ready. */
const PREP_TIMEOUT_MS = 90_000;

function toJob(v: { id: string; title: string; created_at: string; questions: number | unknown[] }, state: JobItem["state"]): JobItem {
  let parts = splitTitle(v.title);
  // A posting saved with the first line as its title ("Product Manager at Kestrel Pay") still gets company and role.
  if (!parts.role) parts = extractCompanyRole(v.title) ?? parts;
  const questions = Array.isArray(v.questions) ? v.questions.length : v.questions;
  return { id: v.id, company: parts.company, role: parts.role, added: shortDate(v.created_at), questions, state };
}

/** The name a session shows (13, QA-15): "Company · Role", "General questions" without a job, "Drill · …" for a drill. */
function sessionName(vacancyTitle: string, drill: boolean): string {
  const name = jobName(vacancyTitle) || t("session.titleGeneral");
  return drill ? t("session.titleDrill", { name }) : name;
}

interface EditorState { open: boolean; editId: string | null }

export function HomeScreen() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const track: Track = params.get("track") === "english" ? "english" : "interview";
  const { settings, selectedEngine, refreshEngines, updateSettings } = useApp();
  const engineReady = Boolean(selectedEngine?.status.ready);
  const vacancies = useLoad(() => api.vacancies());
  const profile = useLoad(() => api.profile());
  const sessions = useLoad(() => api.sessions());
  const memory = useLoad(() => api.memory());
  const stt = useLoad(() => api.stt());

  // Build-up (docs/motion.md 3.1, N3): first visit and return from a session only, never on a re-render.
  const [buildUp] = useState(() => shouldBuildUp(motionMemory));
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    motionMemory.homeSeen = true;
    motionMemory.returnFromSession = false;
  }, []);

  const [setup, setSetup] = useState<SetupState | null>(null);
  const [composer, setComposer] = useState<{ text: string; file?: { name: string; size: string } }>({ text: "" });
  const dictation = useDictation(stt.data, (text) => setComposer((c) => ({ ...c, text: c.text.trim() ? `${c.text.trimEnd()} ${text}` : text })));
  const fileRef = useRef<File | null>(null);
  /** The file of the message that was sent, read by the pending step (a new one may be attached meanwhile). */
  const sentFile = useRef<File | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [prep, setPrep] = useState<Record<string, "preparing" | "error">>({});
  const [textMode, setTextMode] = useState(prefs.input() === "text");
  const [browserDismissed, setBrowserDismissed] = useState(browserBannerDismissed);
  const [editor, setEditor] = useState<EditorState>({ open: false, editId: null });
  const installOffer = useInstallOffer();

  // "Start over" (home.md §4.1): the Practice nav row (a new location on "/") returns to the start screen.
  useEffect(() => { setSetup(null); }, [location.key]);
  // Engine check every 5 seconds while it is not ready.
  useInterval(() => { void refreshEngines(); }, 5000, Boolean(selectedEngine) && !engineReady);

  const list = useMemo(
    () => [...(vacancies.data?.vacancies ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [vacancies.data],
  );
  const sessionList = sessions.data?.sessions;
  const memoryData = memory.data;
  const hasCv = Boolean(profile.data?.text);

  const ctx = useMemo<ScriptContext>(() => {
    const jobs = list.map((v) => toJob(v, prep[v.id] ?? "ready"));
    const interviews = (sessionList ?? []).filter((x) => x.mode !== "english");
    const lastInterview = interviews[0];
    const remembered = prefs.vacancy();
    const weak: WeakItem[] = (memoryData?.weak_spots ?? []).slice(0, 6).map((w) => {
      const title = tMaybe(`feedback.tag.${w.tag}`, w.text || w.tag.replace(/_/g, " "));
      const count = tp("home.workOn.count", w.sessions);
      return { id: `${w.layer}-${w.tag}`, layer: w.layer, title, short: title.toLowerCase(), phrase: `${title.toLowerCase()} (${count})`, count };
    });
    return {
      track,
      firstVisit: interviews.length === 0,
      hasCv,
      jobs,
      last: lastInterview
        ? {
          date: shortDate(lastInterview.started_at),
          jobId: jobs.some((j) => j.id === remembered) ? remembered : null,
          round: homePrefs.round(),
          strictness: settings?.strictness ?? 2,
        }
        : undefined,
      strictness: settings?.strictness ?? 2,
      questions: settings?.questions_per_session ?? 5,
      weak,
      weakSessions: memoryData?.sessions_considered ?? 0,
      level: (sessionList ?? []).some((x) => x.mode === "english") ? settings?.level ?? null : null,
      phrases: [],
    };
  }, [list, prep, sessionList, memoryData, hasCv, settings, track]);

  /* "Drill these weak spots" in a debrief arrives as /?drill=1: start the same drill as the suggestion chip,
     once, after the weak spots and jobs have loaded. The param stays in the URL so the reset above is not re-run. */
  const drillAsked = useRef(false);
  const dataReady = !memory.loading && !sessions.loading && !vacancies.loading;
  useEffect(() => {
    if (drillAsked.current || params.get("drill") !== "1" || !dataReady) return;
    drillAsked.current = true;
    setSetup(begin(ctx, { kind: "drill", jobId: params.get("job") || undefined }));
  }, [params, dataReady, ctx]);

  /* Questions from a job: the plan's Job row shows "Preparing questions…" and Start waits until the call returns
   * (QA-02: a session started meanwhile would ask a general question). A failure or the timeout says that general
   * questions will be used and unlocks Start; "Try again" asks once more. */
  const prepTimers = useRef(new Set<number>());
  useEffect(() => () => { prepTimers.current.forEach((id) => window.clearTimeout(id)); }, []);
  const prepareQuestions = useCallback((job: JobItem) => {
    setPrep((p) => ({ ...p, [job.id]: "preparing" }));
    setSetup((st) => (st ? updateJob(st, { ...job, state: "preparing" }) : st));
    const failed = () => {
      setPrep((p) => ({ ...p, [job.id]: "error" }));
      setSetup((st) => (st ? updateJob(st, { ...job, state: "error" }) : st));
    };
    const timer = window.setTimeout(failed, PREP_TIMEOUT_MS);
    prepTimers.current.add(timer);
    const settled = () => { window.clearTimeout(timer); prepTimers.current.delete(timer); };
    api.vacancyQuestions(job.id)
      .then((r) => {
        settled();
        setPrep((p) => { const rest = { ...p }; delete rest[job.id]; return rest; });
        setSetup((st) => (st ? updateJob(st, { ...job, questions: r.questions.length, state: "ready" }) : st));
        vacancies.reload();
      })
      .catch(() => { settled(); failed(); });
  }, [vacancies]);

  /* A pending read (pasted job, link, file): save it as a job, then let Mike name it. */
  const pendingId = setup?.pending?.turnId;
  useEffect(() => {
    const p = setup?.pending;
    if (!p) return;
    let cancelled = false;
    if (p.kind === "cv") {
      const file = sentFile.current;
      (file ? api.uploadProfile(file) : Promise.reject(new Error("no file")))
        .then(() => { if (!cancelled) { profile.reload(); setSetup((st) => (st ? resolveCv(ctx, st, "ok") : st)); } })
        .catch((e: unknown) => {
          const full = e instanceof ApiError && e.code === "too_many_files";
          if (!cancelled) setSetup((st) => (st ? resolveCv(ctx, st, full ? "full" : "unreadable") : st));
        });
      return () => { cancelled = true; };
    }
    (async () => {
      const body: Parameters<typeof api.createVacancy>[0] = {};
      if (p.kind === "link") body.url = p.url;
      else if (p.kind === "job") body.text = p.text;
      else if (sentFile.current) body.file = { name: sentFile.current.name, data: await fileToBase64(sentFile.current) };
      const v: Vacancy = await api.createVacancy(body);
      return toJob(v, "preparing");
    })()
      .then((job) => {
        if (cancelled) return;
        setSetup((st) => (st ? resolveJob(ctx, st, { ok: true, job }) : st));
        vacancies.reload();
        prepareQuestions(job);
      })
      .catch(() => { if (!cancelled) setSetup((st) => (st ? resolveJob(ctx, st, { ok: false }) : st)); });
    return () => { cancelled = true; };
    // Runs once per pending message; ctx is read at resolve time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId]);

  const run = (fn: (st: SetupState) => SetupState) => setSetup((st) => (st ? fn(st) : st));

  const takeFile = (f: File) => {
    fileRef.current = f;
    setComposer((c) => ({ ...c, file: { name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` } }));
  };
  const onSend = () => {
    const text = composer.text.trim();
    const file = composer.file;
    if (file && setup?.pending) return;    // one read at a time: the file waits in the composer
    if (file) { sentFile.current = fileRef.current; fileRef.current = null; }
    if (!setup) {
      if (!text && !file) return;
      setSetup(begin(ctx, file ? { kind: "file", ...file } : { kind: "text", text }));
    } else if (file) {
      // D89: the file goes now; text typed next to it stays in the field for the next message.
      run((st) => attach(ctx, st, file));
      setComposer({ text: composer.text });
      return;
    } else if (text) {
      run((st) => say(ctx, st, text));
    }
    setComposer({ text: "" });
  };

  /* Start: Home soft-outs (`exit`), then the session opens. Instant under reduced motion. */
  const leave = (go: () => void) => {
    if (leaving) return;
    const ms = durationMs("--duration-exit");
    if (ms <= 0) { go(); return; }
    setLeaving(true);
    window.setTimeout(go, ms);
  };

  const start = (plan: PlanModel, answer: "voice" | "text") => {
    if (plan.kind === "english") {
      const level = plan.level ?? settings?.level ?? "B1";
      if (settings && settings.level !== level) void updateSettings({ level });
      const key = TOPICS.find((x) => t(`english.topics.${x}`) === plan.topic);
      const topic = key ? t(`english.topicValue.${key}`) : plan.topic ?? "";
      const config = buildSessionConfig({ mode: "english", answer, level, topic }, settings, stt.data);
      leave(() => navigate("/session", { state: { config, title: t("home.tabEnglish") } }));
      return;
    }
    homePrefs.setRound(plan.round);
    prefs.setVacancy(plan.job?.id ?? "");
    // The server knows three round types; "technical" runs as the mixed round until it learns the fourth (B2).
    const roundType = plan.kind === "drill" || plan.round === "technical" ? "mix" : plan.round;
    const config = buildSessionConfig({
      mode: "interview", answer, roundType, strictness: plan.strictness, questions: plan.questions, vacancyId: plan.job?.id,
      drill: plan.kind === "drill",
    }, settings, stt.data);
    const title = sessionName(list.find((v) => v.id === plan.job?.id)?.title ?? "", plan.kind === "drill");
    const focus = plan.kind === "drill" ? plan.focus?.spots : undefined;
    leave(() => navigate("/session", { state: { config, title, focus, roundType: config.start.round_type } }));
  };
  const plan = setup ? planFor(ctx, setup) : null;
  const unsupportedSpeech = stt.data?.available === false && !browserSttSupported();
  const loading = (vacancies.loading && !vacancies.data) || (sessions.loading && !sessions.data);
  const shown = setup ? setupModel(ctx, setup) : undefined;
  // User-test screen name (13b): start screen, setup chat, or the plan card.
  useUtScreen(homeUtScreen({ active: Boolean(setup), plan: shown?.plan?.kind ?? null }));
  /* Quick start (D51 item 1): one click, the last settings (general questions on a first visit), no setup chat. */
  // While Home loads the row keeps its place (disabled, no detail) so it doesn't jump in later.
  const quick = setup || loading ? null : quickStartFor(ctx, textMode || unsupportedSpeech);
  // QA-02: the remembered job is still getting its questions: the mic waits as Start does in the plan.
  const quickWaits = Boolean(quick?.jobId && prep[quick.jobId] === "preparing");
  const quickStart = () => {
    if (!quick || !engineReady || quickWaits) return;
    homePrefs.setRound(quick.round);
    const config = buildSessionConfig({
      mode: "interview", answer: quick.answer, roundType: quick.roundType, strictness: quick.strictness,
      questions: quick.questions, vacancyId: quick.jobId ?? undefined,
    }, settings, stt.data);
    const title = sessionName(list.find((v) => v.id === quick.jobId)?.title ?? "", false);
    leave(() => navigate("/session", { state: { config, title, roundType: config.start.round_type } }));
  };

  return (
    <>
      <HomeView
        step={setup ? "setup" : "start"}
        track={setup?.track ?? track}
        name={settings?.name?.trim() || undefined}
        namePending={!settings}
        loading={loading}
        engineReady={engineReady}
        engineBanner={selectedEngine && !engineReady
          ? {
            body: [selectedEngine.status.message, selectedEngine.status.hint].filter(Boolean).join(" "),
            command: selectedEngine.status.hint_command || undefined,
          }
          : null}
        browserBanner={unsupportedSpeech && !browserDismissed && !textMode}
        textMode={textMode}
        storageError={Boolean(sessions.error)}
        installCard={installOffer.showCard}
        suggestions={loading ? [] : suggestionsFor(ctx)}
        quickStart={quick ? { detail: quick.detail, answer: quick.answer, wait: quickWaits } : loading && track === "interview" ? { detail: "" } : null}
        onQuickStart={quickStart}
        composer={composer}
        setup={shown}
        jobs={setup ? [...setup.jobs, ...ctx.jobs.filter((j) => !setup.jobs.some((x) => x.id === j.id))] : ctx.jobs}
        starting={leaving}
        buildUp={buildUp}
        leaving={leaving}
        layerOrder={settings?.layer_order}
        onComposerChange={(text) => { dictation.clearError(); setComposer((c) => ({ ...c, text })); }}
        dictation={{
          available: dictation.mode !== null,
          state: dictation.state,
          error: dictation.error ? t(`chat.dictate.error.${dictation.error}`) : undefined,
        }}
        onDictate={dictation.toggle}
        onAddFile={() => picker.current?.click()}
        onFiles={(files) => { if (files[0]) takeFile(files[0]); }}
        onRemoveFile={() => { fileRef.current = null; setComposer((c) => ({ text: c.text })); }}
        onSend={onSend}
        onSuggestion={(id) => setSetup(begin(ctx, { kind: "suggestion", id }))}
        onReply={(turnId, replyId) => run((st) => pick(ctx, st, turnId, replyId))}
        onTurnAction={(_turnId, action) => {
          if (action === "use-general") run((st) => say(ctx, st, t("chat.suggest.general")));
          else setEditor({ open: true, editId: setup?.draft.jobId ?? null });
        }}
        onSkip={() => run((st) => skip(ctx, st))}
        onChange={(row, value) => run((st) => change(ctx, st, row, value))}
        onRemoveNote={() => run(removeNote)}
        onRetryPrep={() => {
          const job = shown?.plan?.job ? (setup?.jobs ?? []).concat(ctx.jobs).find((j) => j.id === shown.plan!.job!.id) : undefined;
          if (job) prepareQuestions(job);
        }}
        onAddCv={() => navigate("/settings/profile")}
        onStart={() => { if (plan) start(plan, textMode ? "text" : "voice"); }}
        onTypeInstead={() => { if (plan) start(plan, "text"); }}
        onModeChange={(next) => setParams(next === "english" ? { track: "english" } : {}, { replace: true })}
        onUseTextMode={() => { prefs.setInput("text"); setTextMode(true); }}
        onDismissBrowser={() => { browserBannerDismissed = true; setBrowserDismissed(true); }}
        onRetryEngine={() => { void refreshEngines(); }}
        onInstall={() => { void installOffer.install(); }}
        onDismissInstall={installOffer.dismiss}
        overlay={(
          <VacancyEditor
            open={editor.open}
            editId={editor.editId}
            onClose={() => setEditor({ open: false, editId: null })}
            onDeleted={() => { vacancies.reload(); run((st) => change(ctx, st, "job", "general")); }}
            onSaved={(v) => {
              setEditor({ open: false, editId: null });
              const job = toJob(v, "preparing");
              // An edit saves a new copy: the plan follows it (Mike's earlier line is not rewritten).
              run((st) => change(ctx, updateJob(st, job), "job", job.id));
              vacancies.reload();
              prepareQuestions(job);
            }}
          />
        )}
      />
      <input
        ref={picker}
        type="file"
        hidden
        accept=".pdf,.docx,.txt,.md,.html,application/pdf,text/plain,text/markdown,text/html"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) takeFile(f);
        }}
      />
    </>
  );
}
