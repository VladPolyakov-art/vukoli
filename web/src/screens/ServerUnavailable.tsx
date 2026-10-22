import { Button, Card, CopyField, EmptyState } from "../ds";
import { t } from "../i18n";
import { useUtScreen } from "../lib/utScreen";
import s from "./ServerUnavailable.module.css";

export function ServerUnavailable({ onRetry }: { onRetry: () => void }) {
  useUtScreen("/server-unavailable");
  return (
    <main className={s.wrap}>
      <Card padding="lg" className={s.card}>
        <EmptyState
          icon="alert"
          headingLevel={1}
          title={t("server.title")}
          actions={<Button variant="primary" icon="refresh" data-track="server-check-again" onClick={onRetry}>{t("server.checkAgain")}</Button>}
        >
          <p>{t("server.body")}</p>
        </EmptyState>
        <CopyField value={t("server.command")} copyLabel={t("common.copyCommand")} copiedLabel={t("common.copied")} label={t("common.command")} />
      </Card>
    </main>
  );
}
