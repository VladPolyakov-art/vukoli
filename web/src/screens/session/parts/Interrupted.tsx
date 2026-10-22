/* SessionInterrupted: inside the stage (the panel stays readable), replacing question, captions and dock (US-04 AC5,
 * US-13 AC5). Engine drop: Resume is disabled until the engine answers again; no "Continue in text" (GR5).
 * Voice drop: the connection is gone; Resume (voice) or Continue in text both pick the saved session up again.
 * Live (D94): `info` carries the engine that stopped (its name and what to do come from engines.* / interrupted.body.*),
 * whether Resume works now, and the result of the last try. Fixtures pass none: the designed Ollama frame.
 * v2 (session.md §V2.2 S10): "End and see debrief" left the callout; the island's End does it.
 * V2.1 (D49): no orb and no second status pill: the callouts follow the transcript (the dialogue stays readable above),
 * and the one StatusPill over the island says "Paused". */
import { Button, Callout, CopyField } from "../../../ds";
import { engineKey } from "../../../components/engine/meta";
import { t } from "../../../i18n";
import type { SessionData, SessionHandlers } from "../types";
import s from "./parts.module.css";

/** Engines whose copy tells the user a command to run (Ollama: `ollama serve`); the others have none. */
const COMMAND = new Set(["ollama"]);

export function Interrupted({ kind, handlers, info }: { kind: "engine" | "voice"; handlers?: SessionHandlers; info?: SessionData["interrupted"] }) {
  const engine = info?.engine ?? "ollama";
  const key = engineKey(engine);
  const resuming = Boolean(info?.resuming);
  const fail = info?.failed === undefined ? null : (
    <Callout tone="warning" live="alert">
      {info.failed ? t("session.interrupted.resumeFailedWith", { message: info.failed }) : t("session.interrupted.resumeFailed")}
    </Callout>
  );
  return (
    <section className={s.interrupted} aria-label={t("session.status.paused")} data-review-id="Session/Interrupted" data-review-section="Session · Interrupted" data-comment-target>
      {kind === "engine" ? (
        <>
          <Callout tone="error" live="alert" title={t("session.interrupted.engineTitle", { engine: t(`engines.${key}.short`) })}>
            {t(`session.interrupted.body.${key}`)}
            {COMMAND.has(key) ? <CopyField value={t("session.interrupted.command")} copyLabel={t("common.copyCommand")} copiedLabel={t("common.copied")} label={t("common.command")} /> : null}
          </Callout>
          {fail}
          {key === "gemini" ? null : <p className={s.interruptedNote}>{t("session.interrupted.engineRetry")}</p>}
          <div className={s.interruptedActions}>
            <Button variant="primary" data-track="session-resume" disabled={!info?.canResume} loading={resuming} onClick={handlers?.onResume}>
              {resuming ? t("session.interrupted.resuming") : t("session.interrupted.resume")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Callout tone="error" live="alert" title={t("session.interrupted.voiceTitle")}>
            {info?.input === "text" ? t("session.interrupted.voiceBodyText") : t("session.interrupted.voiceBody")}
          </Callout>
          {fail}
          <div className={s.interruptedActions}>
            <Button variant="primary" data-track="session-resume" loading={resuming} onClick={handlers?.onResume}>
              {resuming ? t("session.interrupted.resuming") : info?.input === "text" ? t("session.interrupted.resume") : t("session.interrupted.resumeVoice")}
            </Button>
            {info?.input === "text" ? null : (
              <Button variant="secondary" icon="keyboard" data-track="session-resume-text" disabled={resuming} onClick={handlers?.onUseText}>{t("session.interrupted.continueText")}</Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
