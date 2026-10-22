import { useState, type ReactNode } from "react";
import { Button } from "../../ds";
import { t } from "../../i18n";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/store";
import type { EngineId, EngineTestResult } from "../../lib/types";
import s from "./engine.module.css";

/** "Test the engine": asks the model for one short reply. `children` sit between the button and the result line. */
export function EngineTest({ id, children }: { id: EngineId; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EngineTestResult | null>(null);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      setResult(await api.testEngine(id));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.actions}>
      <Button size="sm" icon="play" data-track="engine-test" loading={busy} onClick={() => void run()}>{t("engines.test")}</Button>
      {children}
      <span className={s.result} role="status">
        {busy ? t("engines.testing") : null}
        {result?.ok ? t("engines.testOk", { ms: result.latency_ms ?? 0 }) : null}
        {result && !result.ok ? `${t("engines.testFailed")} ${result.message ?? result.status.message}` : null}
        {err}
      </span>
    </div>
  );
}
