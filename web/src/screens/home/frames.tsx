/* Stage and harnesses for stories and the review page. A scene replays its inputs through the setup script and stays
 * playable (send, pick a reply, change a plan row, start); pending reads resolve after a pause. No network. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppShellView, savedToast, savingToast } from "../../components/AppShell";
import { ToastProvider, useToast } from "../../ds";
import { VacancyEditorView, type FileState, type LinkState, type VacancySource } from "../../components/VacancyEditor";
import { OverlayRoot } from "../../ds/OverlayRoot";
import type { EditorSeed } from "./editorSeeds";
import { HomeView } from "./HomeView";
import { t } from "../../i18n";
import { CV_FILE, DICTATED, JOB_FILE, KESTREL_PASTED, PASTED_TEXT } from "./fixtures";
import {
  attach, begin, change, pick, removeNote, resolveCv, resolveJob, say, setupModel, skip, suggestionsFor, updateJob,
  type JobResult, type ScriptContext, type SetupState,
} from "./script";
import { quickStartFor } from "./quickStart";
import { SCENES, type HomeScene, type HomeSceneId, type SceneInput } from "./states";
import type { SetupModel } from "./types";

/** A frame of a real width, scaled down to fit, with its own OverlayRoot (menus and dialogs open inside it). */
export function ScaledStage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div
      ref={outer}
      style={{ width: "100%", maxWidth: width, height: height * scale, overflow: "hidden", border: "var(--border-width) solid var(--color-border-subtle)", borderRadius: "var(--radius-lg)" }}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
        <OverlayRoot>{children}</OverlayRoot>
      </div>
    </div>
  );
}

export function EditorHarness({ seed, open, inline, onClose }: { seed: EditorSeed; open: boolean; inline?: boolean; onClose: () => void }) {
  const [source, setSource] = useState<VacancySource>(seed.source ?? "paste");
  const [text, setText] = useState(seed.text ?? "");
  const [url, setUrl] = useState(seed.url ?? "");
  const [company, setCompany] = useState(seed.company ?? "");
  const [role, setRole] = useState(seed.role ?? "");
  const [link, setLink] = useState<LinkState>(seed.link ?? "idle");
  const [fileState, setFileState] = useState<FileState>(seed.fileState ?? "empty");
  const [file, setFile] = useState(seed.file ?? null);
  return (
    <VacancyEditorView
      {...seed}
      open={open}
      inline={inline}
      source={source}
      onSourceChange={setSource}
      text={text}
      onTextChange={setText}
      url={url}
      onUrlChange={setUrl}
      company={company}
      role={role}
      onCompanyChange={setCompany}
      onRoleChange={setRole}
      link={link}
      onFetch={() => setLink("fetching")}
      file={file}
      fileState={fileState}
      onFile={(f) => { setFile({ name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` }); setFileState("chosen"); }}
      onRemoveFile={() => { setFile(null); setFileState("empty"); }}
      onSwitchToPaste={() => setSource("paste")}
      onClose={onClose}
    />
  );
}

/** Replays a scene's inputs through the script. `pick` answers the last open question. */
export function replay(ctx: ScriptContext, inputs: SceneInput[]): SetupState | null {
  let st: SetupState | null = null;
  for (const step of inputs) {
    if (step.do === "begin") { st = begin(ctx, step.input); continue; }
    if (!st) continue;
    if (step.do === "pick") {
      const open = [...st.turns].reverse().find((x) => x.replies?.some((r) => r.id === step.reply) && !x.answered);
      if (open) st = pick(ctx, st, open.id, step.reply);
    } else if (step.do === "say") st = say(ctx, st, step.text);
    else if (step.do === "resolve") st = resolveJob(ctx, st, step.result);
    else if (step.do === "update") st = updateJob(st, step.job);
    else if (step.do === "skip") st = skip(ctx, st);
    else if (step.do === "change") st = change(ctx, st, step.row, step.value);
    else if (step.do === "attach") st = attach(ctx, st, step.file);
    else if (step.do === "resolveCv") st = resolveCv(ctx, st, step.result);
  }
  return st;
}

const PENDING_MS = 1600;
const PREP_MS = 2400;

/** A scene, playable: the script runs on every send / reply / change; pending reads resolve after a pause. */
export function HomeHarness({ scene }: { scene: HomeScene }) {
  const p = scene.props ?? {};
  const [track, setTrack] = useState(scene.ctx.track);
  const ctx = useMemo<ScriptContext>(() => ({ ...scene.ctx, track }), [scene.ctx, track]);
  const [setup, setSetup] = useState<SetupState | null>(() => (scene.inputs ? replay(scene.ctx, scene.inputs) : null));
  const [composer, setComposer] = useState(p.composer ?? { text: "" });
  const [textMode, setTextMode] = useState(Boolean(p.textMode));
  const [starting, setStarting] = useState(Boolean(p.starting));
  const [editor, setEditor] = useState({ open: false, seed: {} as EditorSeed, n: 0 });
  // D90: a stand-in for the mic: listening until pressed again, then a pause, then DICTATED joins the field.
  const [dictating, setDictating] = useState<"idle" | "listening" | "transcribing">(scene.dictate === "listening" ? "listening" : "idle");
  const [dictateError, setDictateError] = useState(scene.dictate === "no_speech" ? t("chat.dictate.error.no_speech") : undefined);
  const dictate = () => {
    setDictateError(undefined);
    if (dictating === "idle") { setDictating("listening"); return; }
    if (dictating !== "listening") return;
    setDictating("transcribing");
    later(() => {
      setDictating("idle");
      setComposer((c) => ({ ...c, text: c.text.trim() ? `${c.text.trimEnd()} ${DICTATED}` : DICTATED }));
    }, PENDING_MS);
  };
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  // A pending read resolves after a pause (unless the scene holds it); a job that is preparing gets ready later.
  const pending = setup?.pending;
  const [held] = useState(() => Boolean(scene.hold));
  useEffect(() => {
    if (!pending || held) return;
    if (pending.kind === "cv") {
      const id = window.setTimeout(() => setSetup((st) => (st ? resolveCv(ctx, st, scene.cvWith ?? "ok") : st)), PENDING_MS);
      return () => window.clearTimeout(id);
    }
    const result: JobResult = scene.resolveWith ?? (pending.kind === "link" ? { ok: false } : { ok: true, job: KESTREL_PASTED });
    const id = window.setTimeout(() => {
      setSetup((st) => (st ? resolveJob(ctx, st, result) : st));
      if (result.ok && result.job.state === "preparing") {
        later(() => setSetup((st) => (st ? updateJob(st, { ...result.job, state: "ready", questions: 12 }) : st)), PREP_MS);
      }
    }, PENDING_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.turnId]);

  const view: SetupModel | undefined = setup ? setupModel(ctx, setup) : undefined;
  const send = () => {
    const text = composer.text.trim();
    if (!setup) {
      if (!text && !composer.file) return;
      setSetup(begin(ctx, composer.file ? { kind: "file", ...composer.file } : { kind: "text", text }));
    } else if (composer.file) {
      if (setup.pending) return;
      setSetup(attach(ctx, setup, composer.file));
      setComposer({ text: composer.text });
      return;
    } else if (text) {
      setSetup(say(ctx, setup, text));
    }
    setComposer({ text: "" });
  };
  const run = (fn: (st: SetupState) => SetupState) => setSetup((st) => (st ? fn(st) : st));

  return (
    <HomeView
      {...p}
      step={setup ? "setup" : "start"}
      track={setup?.track ?? track}
      name={p.name}
      engineReady={p.engineReady ?? true}
      suggestions={p.suggestions ?? suggestionsFor(ctx)}
      quickStart={p.quickStart !== undefined ? p.quickStart : setup ? null : (() => {
        const q = quickStartFor(ctx, textMode);
        return !q ? null : p.loading ? { detail: "" } : { detail: q.detail, answer: q.answer };
      })()}
      onQuickStart={() => { setStarting(true); later(() => setStarting(false), PREP_MS); }}
      composer={composer}
      setup={view}
      jobs={setup ? [...setup.jobs, ...ctx.jobs.filter((j) => !setup.jobs.some((x) => x.id === j.id))] : ctx.jobs}
      textMode={textMode}
      starting={starting}
      onComposerChange={(text) => { setDictateError(undefined); setComposer((c) => ({ ...c, text })); }}
      dictation={p.dictation ?? { available: true, state: dictating, error: dictateError }}
      onDictate={dictate}
      onAddFile={() => setComposer((c) => ({ ...c, file: setup && setup.stage !== "job" ? CV_FILE : JOB_FILE }))}
      onFiles={(files) => {
        const f = files[0];
        if (f) setComposer((c) => ({ ...c, file: { name: f.name, size: `${Math.max(1, Math.round(f.size / 1024))} KB` } }));
      }}
      onRemoveFile={() => setComposer((c) => ({ text: c.text }))}
      onSend={send}
      onSuggestion={(id) => setSetup(begin(ctx, { kind: "suggestion", id }))}
      onReply={(turnId, replyId) => run((st) => pick(ctx, st, turnId, replyId))}
      onTurnAction={(_turnId, action) => {
        if (action === "use-general") run((st) => say(ctx, st, t("chat.suggest.general")));
        else setEditor((e) => ({ open: true, seed: { mode: "edit", source: "paste", text: PASTED_TEXT, company: "Kestrel Pay", role: "Senior Product Designer" }, n: e.n + 1 }));
      }}
      onSkip={() => run((st) => skip(ctx, st))}
      onChange={(row, value) => run((st) => change(ctx, st, row, value))}
      onRemoveNote={() => run(removeNote)}
      onRetryPrep={() => run((st) => updateJob(st, { ...KESTREL_PASTED, state: "ready", questions: 12 }))}
      onStart={() => { setStarting(true); later(() => setStarting(false), PREP_MS); }}
      onTypeInstead={() => setTextMode(true)}
      onUseTextMode={() => setTextMode(true)}
      onModeChange={setTrack}
      overlay={<EditorHarness key={editor.n} seed={editor.seed} open={editor.open} onClose={() => setEditor((e) => ({ ...e, open: false }))} />}
    />
  );
}

/** The screen inside the shell, no frame around it (the review page brings its own). */
/** D73: the toast the shell shows after End, as in the app (the same options, the real region). */
function SceneToast({ kind }: { kind: "saving" | "saved" }) {
  const toast = useToast();
  useEffect(() => {
    const id = toast.show(kind === "saving" ? savingToast() : { ...savedToast(() => {}), duration: null });
    return () => toast.dismiss(id);
  }, [toast, kind]);
  return null;
}

export function HomeScene({ id }: { id: HomeSceneId }) {
  const scene: HomeScene = SCENES[id];
  return (
    <MemoryRouter initialEntries={["/"]}>
      <ToastProvider>
        <AppShellView current="practice" recent={scene.recent} engine={scene.engine}>
          <HomeHarness scene={scene} />
        </AppShellView>
        {scene.toast ? <SceneToast kind={scene.toast} /> : null}
      </ToastProvider>
    </MemoryRouter>
  );
}
