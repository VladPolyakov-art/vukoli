import { useNavigate } from "react-router-dom";
import { Button, EmptyState } from "../ds";
import { t } from "../i18n";
import { Page } from "../components/Page";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <Page title={t("notFound.title")}>
      <EmptyState icon="alert" title={t("notFound.body")} actions={<Button variant="primary" data-track="not-found-home" onClick={() => navigate("/")}>{t("notFound.home")}</Button>} />
    </Page>
  );
}
