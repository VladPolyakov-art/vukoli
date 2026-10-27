/* Debrief of a saved session (live container). The screen itself is the pure `DebriefView` (screens/debrief/);
 * this file loads the session, polls while the debrief is being written, and wires the actions to the REST API. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFreshOnce, useToast } from "../ds";
import { t } from "../i18n";
import { api, ApiError } from "../lib/api";
import { useDocumentTitle } from "../lib/documentTitle";
import { useInterval, useLoad } from "../lib/hooks";
import { useStorageWritable } from "../lib/storageProbe";
import { errorMessage, useApp } from "../lib/store";
import type { SessionRecord } from "../lib/types";
import type { StrongerState } from "../session/reducer";
import { DebriefView } from "./debrief/DebriefView";
import type { DebriefViewMode } from "./debrief/types";
import { DEFAULT_OPEN, exampleSam } from "./debrief/fixtures";
import { feedbackOfFlag, mapRecord, threadsFromRecord } from "./debrief/mapRecord";
import { renameSession, SESSIONS_CHANGED } from "./debrief/rename";

export { threadsFromRecord };

/** The build-up plays on the first open of each session in this visit (Debrief build-up, motion.md). */
const seen = new Set<string>();

/** The view lives in the URL (D101): a saved session opens on the debrief, so no param is the debrief and `?view=conversation`
 * is the chat; `?view=debrief` (old links, the "debrief ready" toast) is still the debrief. Switching replaces the entry, so
 * Back leaves the page instead of flipping between the views. A session with nothing to show but its chat has no debrief
 * view: the view itself falls back to the conversation. */
function useViewParam(initial: DebriefViewMode = "debrief"): [DebriefViewMode, (next: DebriefViewMode) => void] {
  const [params, setParams] = useSearchParams();
  const param = params.get("view");
  const view: DebriefViewMode = param === "debrief" || param === "conversation" ? param : initial;
  const setView = (next: DebriefViewMode) => {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (next === initial) n.delete("view");
      else n.set("view", next);
      // `?q=n` belongs to the debrief view only.
      if (next === "conversation") n.delete("q");
      return n;
    }, { replace: true });
  };
  return [view, setView];
}

/** The question the debrief shows lives in the URL too: `?q=4` opens question 4 and a reload keeps it. It is written only when
 * the user picks a question (the first one stays a clean URL); a number the session does not have is ignored by the view. */
function useQuestionParam(): [number | undefined, (n: number) => void] {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("q"));
  const question = Number.isInteger(raw) && raw > 0 ? raw : undefined;
  const setQuestion = (n: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("q", String(n));
      return next;
    }, { replace: true });
  };
  return [question, setQuestion];
}

/** `/sessions/example`: the built-in sample debrief (History empty state link); never reads the saved sessions. */
function ExampleDebrief() {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [view, setView] = useViewParam();
  const [question, setQuestion] = useQuestionParam();
  useDocumentTitle(exampleSam.title);
  return (
    <DebriefView
      variant="example"
      state="ready"
      view={view}
      onViewChange={setView}
      question={question}
      onQuestionChange={setQuestion}
      model={exampleSam}
      layerOrder={settings?.layer_order ?? "content-first"}
      ui={{ open: DEFAULT_OPEN.example }}
      onStartFirst={() => navigate("/")}
    />
  );
}

export function DebriefScreen() {
  const { id = "" } = useParams();
  return id === "example" ? <ExampleDebrief /> : <LiveDebrief />;
}

function LiveDebrief() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useApp();
  const [view, setView] = useViewParam();
  const [question, setQuestion] = useQuestionParam();
  const storageWritable = useStorageWritable();
  const session = useLoad(() => api.session(id), [id]);
  const [stronger, setStronger] = useState<Record<string, StrongerState>>({});
  const [rerunning, setRerunning] = useState(false);
  const [notice, setNotice] = useState("");
  /** The question being checked again after "Edit what I said" (the view shows its skeleton until it is back). */
  const [rechecking, setRechecking] = useState<number | null>(null);
  const [polls, setPolls] = useState(0);
  /** Bumped when an optimistic change failed: the view starts again from the saved data. */
  const [epoch, setEpoch] = useState(0);
  const record = session.data;
  const latest = useRef<SessionRecord | null>(null);
  latest.current = record;
  const fresh = useFreshOnce(seen, `debrief:${id}`);
  const loadedOnce = useRef(false);
  if (record) loadedOnce.current = true;
  useDocumentTitle(record?.title || t("debrief.title")); // QA-11: the tab carries the session's name

  // D96: right after a session the server makes the feedback answer by answer, then the debrief (`post_call` on the
  // record). The page asks again every few seconds for as long as that marker is there (the server drops it itself when
  // the work is over or its job died). A saved session with no marker and no debrief is polled for up to a minute.
  const preparing = Boolean(record?.post_call);
  const waiting = preparing || Boolean(record && record.mode === "interview" && !record.debrief && record.feedback.length && polls < 20);
  useInterval(() => {
    setPolls((n) => n + 1);
    api.session(id).then((r) => session.setData(r)).catch(() => {});
  }, preparing ? 2000 : 3000, waiting);
  useEffect(() => { setPolls(0); setStronger({}); setNotice(""); setRechecking(null); }, [id]);

  const model = useMemo(
    () => (record ? mapRecord(record, { obsidian: Boolean(settings?.obsidian_dir), stronger, waiting }) : undefined),
    [record, settings?.obsidian_dir, stronger, waiting],
  );

  /* The feedback and the debrief are still being made: say how far it is (the model below is not shown until it is done). */
  if (record?.post_call) {
    const { done, total, stage } = record.post_call;
    return (
      <DebriefView
        variant={record.mode === "english" ? "english" : "interview"}
        state="preparing"
        progress={{ done, total, stage }}
        layerOrder={settings?.layer_order ?? "content-first"}
      />
    );
  }

  if (!record) {
    const gone = session.error instanceof ApiError && session.error.status === 404;
    return (
      <DebriefView
        variant="interview"
        state={session.loading ? "loading" : gone ? "notFound" : "error"}
        layerOrder={settings?.layer_order ?? "content-first"}
        onRetry={session.reload}
      />
    );
  }

  const fail = (e: unknown) => { setNotice(errorMessage(e)); setEpoch((n) => n + 1); };

  const flag = (flagId: string, action: "dismiss" | "restore") => {
    const fb = feedbackOfFlag(record, flagId);
    if (!fb) return;
    setNotice("");
    api.sessionFlag(record.id, flagId, fb.id, action)
      .then(({ language, debrief }) => {
        // The weak spots follow the flag: a dismissed correction stops counting (US-22 AC3).
        const cur = latest.current ?? record;
        session.setData({ ...cur, debrief: debrief ?? cur.debrief, feedback: cur.feedback.map((x) => (x.id === fb.id ? { ...fb, layers: { ...fb.layers, language } } : x)) });
      })
      .catch(fail);
  };
  /* "Edit what I said" (US-18 AC3): the server swaps in the corrected text, regenerates this answer's feedback and
   * saves the session; the answer shows its skeleton meanwhile. A failure leaves everything as it was and reopens
   * the editor with the typed text. */
  const recheck = (n: number, target: string, text: string) => {
    const th = threadsFromRecord(record).find((x) => x.number === n);
    const whole = target === "answer";
    const fb = whole ? th?.records.find((r) => r.answer_kind === "main") ?? th?.records[0] : feedbackOfFlag(record, target);
    if (!fb) return Promise.resolve(false);
    setRechecking(n);
    setNotice("");
    return api.sessionRecheck(record.id, fb.id, text, whole ? undefined : target)
      .then(({ feedback, transcript, debrief }) => {
        const cur = latest.current ?? record;
        session.setData({ ...cur, transcript, debrief: debrief ?? cur.debrief, feedback: cur.feedback.map((x) => (x.id === feedback.id ? feedback : x)) });
        setStronger((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== fb.id)));
        return true;
      })
      .catch((e: unknown) => { setNotice(`${t("debrief.q.recheckFailed")} ${errorMessage(e)}`); return false; })
      .finally(() => setRechecking(null));
  };
  const askStronger = (n: number) => {
    const th = threadsFromRecord(record).find((x) => x.number === n);
    const main = th?.records.find((r) => r.answer_kind === "main") ?? th?.records[0];
    if (!main) return;
    setStronger((m) => ({ ...m, [main.id]: { status: "loading" } }));
    api.sessionStronger(record.id, main.id)
      .then((v) => setStronger((m) => ({ ...m, [main.id]: { status: "ready", ...v } })))
      .catch((e: unknown) => setStronger((m) => ({ ...m, [main.id]: { status: "unavailable", message: errorMessage(e) } })));
  };
  const rerun = () => {
    setRerunning(true);
    setNotice("");
    api.rerunDebrief(record.id)
      .then((debrief) => session.setData({ ...record, debrief }))
      .catch((e: unknown) => setNotice(errorMessage(e)))
      .finally(() => setRerunning(false));
  };
  // D80: after Archive or Delete the chat leaves the sidebar and the user lands on New practice, with Undo in a toast.
  const changed = () => window.dispatchEvent(new Event(SESSIONS_CHANGED));
  const undoFailed = (e: unknown) => toast.show({ message: errorMessage(e), tone: "error" });
  const trash = async () => {
    try {
      const { trash_id } = await api.deleteSession(record.id);
      navigate("/", { replace: true });
      toast.show({ message: t("rail.deleted"), action: { label: t("common.undo"), onClick: () => { api.restoreSession(trash_id).then(changed, undoFailed); } } });
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };
  const archive = async () => {
    const sid = record.id;
    try {
      await api.patchSession(sid, { archived: true });
      navigate("/", { replace: true });
      toast.show({ message: t("rail.archived"), action: { label: t("common.undo"), onClick: () => { api.patchSession(sid, { archived: false }).then(changed, undoFailed); } } });
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = api.sessionMarkdownUrl(record.id);
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const rename = async (title: string) => {
    try {
      const saved = await renameSession(record.id, title);
      session.setData({ ...record, title: saved });
      return true;
    } catch {
      setNotice(t("history.toast.renameFailed"));
      return false;
    }
  };
  const practise = () => navigate(record.mode === "english" ? "/?track=english" : "/");
  const drill = () => navigate(record.mode === "english" ? "/?track=english" : `/?drill=1${record.vacancy_id ? `&job=${encodeURIComponent(record.vacancy_id)}` : ""}`);

  return (
    <DebriefView
      key={epoch}
      variant={record.mode === "english" ? "english" : "interview"}
      state="ready"
      view={view}
      onViewChange={setView}
      question={question}
      onQuestionChange={setQuestion}
      storageError={!storageWritable}
      model={model}
      layerOrder={settings?.layer_order ?? "content-first"}
      buildUp={fresh}
      rerunning={rerunning}
      notice={notice || undefined}
      rechecking={rechecking}
      onRecheck={recheck}
      onRename={rename}
      onRerun={rerun}
      onDownload={download}
      onArchive={() => void archive()}
      onTrash={() => void trash()}
      onDrill={drill}
      onPractise={practise}
      onDismiss={(_q, flagId) => flag(flagId, "dismiss")}
      onRestore={(_q, flagId) => flag(flagId, "restore")}
      onStronger={askStronger}
    />
  );
}
