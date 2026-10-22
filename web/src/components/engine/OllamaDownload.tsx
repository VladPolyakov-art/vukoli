/* Ollama is running but has no model (D85): download it from here, no Terminal. The server runs one download in
 * the background (it keeps going if this page closes) and this polls its progress; when it is done the engine
 * turns Ready. A machine with 16 GB+ is offered the smaller model as well (slow connection, little disk).
 * The Terminal command stays behind "Use Terminal instead". */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button, Callout, CopyField, Disclosure, Progress } from "../../ds";
import { t } from "../../i18n";
import { api } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { errorMessage, useApp } from "../../lib/store";
import type { EngineInfo, OllamaPull } from "../../lib/types";
import s from "./engine.module.css";

const POLL_MS = 700;

/** Review and stories: a fixed download state for every OllamaDownload inside (no polling). */
export const OllamaPullPreview = createContext<OllamaPull | null>(null);

export interface OllamaDownloadProps {
  engine: EngineInfo;
  /** Review and stories: show this download state and don't poll. */
  initial?: OllamaPull;
}

export function OllamaDownload({ engine, initial: given }: OllamaDownloadProps) {
  const { refreshEngines } = useApp();
  const preview = useContext(OllamaPullPreview);
  const initial = given ?? preview ?? undefined;
  const [pull, setPull] = useState<OllamaPull | null>(initial ?? null);
  const [error, setError] = useState("");
  const refresh = useRef(refreshEngines);
  refresh.current = refreshEngines;
  const pulling = pull?.state === "pulling";

  useEffect(() => {
    if (!initial) void api.ollamaPull().then(setPull, () => {});
  }, [initial]);
  useEffect(() => {
    if (!pulling || initial) return;
    const id = window.setInterval(() => {
      void api.ollamaPull().then((next) => {
        setPull(next);
        if (next.state === "done") void refresh.current();
      }, () => {});
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [pulling, initial]);

  const start = async (model: string) => {
    setError("");
    try {
      setPull(await api.startOllamaPull(model));
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const cancel = async () => {
    try {
      setPull(await api.cancelOllamaPull());
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const recommended = pull?.recommended || engine.status.model;
  const size = (model: string) => pull?.options.find((o) => o.model === model)?.size_gb;
  const recSize = size(recommended);
  // After Cancel the first button continues that model from where it stopped; the other one stays offered.
  const resume = pull?.state === "cancelled" && pull.model ? pull.model : "";
  const first = resume || recommended;
  const second = pull?.options.find((o) => o.model !== first && (o.model === recommended || (recSize !== undefined && o.size_gb < recSize)));

  if (pull && pulling) {
    const share = pull.total ? pull.completed / pull.total : undefined;
    const line = pull.phase === "verify" ? t("engines.ollama.pull.verifying")
      : !pull.total ? t("engines.ollama.pull.preparing")
      : t("engines.ollama.pull.progress", { done: formatBytes(pull.completed) || "0 MB", total: formatBytes(pull.total),
        pct: Math.floor((share ?? 0) * 100) });
    return (
      <Callout tone="info" icon="download" title={t("engines.ollama.pull.downloading", { model: pull.model })}
        actions={<Button variant="ghost" size="sm" data-track="ollama-pull-cancel" onClick={() => void cancel()}>{t("common.cancel")}</Button>}>
        <div className={s.pull}>
          <Progress label={t("engines.ollama.pull.label")} value={pull.phase === "verify" ? 1 : share} valueText={line} />
          <p className={s.pullLine}>{line}</p>
          <p className={s.note}>{t("engines.ollama.pull.keepsGoing")}</p>
        </div>
      </Callout>
    );
  }

  const failure = error || (pull?.state === "error" ? pull.error : "");
  return (
    <Callout tone={failure ? "error" : "warning"} title={t("engines.ollama.noModel")} live={failure ? "alert" : undefined}>
      <div className={s.pull}>
        <p>
          {failure ? t("engines.ollama.pull.failed", { message: failure })
            : pull?.state === "cancelled" ? t("engines.ollama.pull.cancelled")
            : t("engines.ollama.pull.body", { model: recommended, size: recSize ?? "?" })}
        </p>
        {first ? (
          <div className={s.actions}>
            <Button variant="primary" size="sm" icon="download" data-track="ollama-pull-start" onClick={() => void start(first)}>
              {resume ? t("engines.ollama.pull.resume", { model: first }) : t("engines.ollama.pull.start", { model: first })}
            </Button>
            {second ? (
              <Button variant="secondary" size="sm" data-track="ollama-pull-alt" onClick={() => void start(second.model)}>
                {second.model === recommended ? t("engines.ollama.pull.start", { model: second.model }) : t("engines.ollama.pull.smaller", { size: second.size_gb })}
              </Button>
            ) : null}
          </div>
        ) : null}
        <Disclosure surface="plain" title={t("engines.ollama.pull.terminal")}>
          <CopyField value={`ollama pull ${first}`} copyLabel={t("common.copyCommand")} copiedLabel={t("common.copied")} label={t("common.command")} />
        </Disclosure>
      </div>
    </Callout>
  );
}
