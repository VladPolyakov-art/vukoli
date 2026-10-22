/* First-visit example (US-29), now inside Mike's message (home.md v2 §4 "Example"): what you get after each question,
 * from Sam Rivera's debrief — clearly not the user's. */
import { Link } from "react-router-dom";
import { Badge, Card, InlineMark } from "../../../ds";
import { t } from "../../../i18n";
import s from "./parts.module.css";

export function ExampleCard({ order = "content-first" }: { order?: "content-first" | "delivery-first" }) {
  const rows = [
    { layer: "content" as const, body: <>{t("home.example.content")}</> },
    {
      layer: "language" as const,
      body: (
        <>
          “{t("home.example.langFrom")} <InlineMark kind="fix">{t("home.example.langWrong")}</InlineMark>” → “{t("home.example.langTo")}{" "}
          <InlineMark kind="fix">{t("home.example.langRight")}</InlineMark>”
          <span className={s.exampleLevel}> · {t("home.example.langLevel")}</span>
        </>
      ),
    },
    { layer: "delivery" as const, body: <>{t("home.example.delivery")}</> },
  ];
  if (order === "delivery-first") rows.reverse();
  return (
    <Card tone="subtle" padding="md">
      <div data-review-id="Home/Example" data-review-section="Home · Example" data-comment-target className={s.exampleCard}>
        <Badge tone="outline">{t("home.example.label")} · {t("feedback.example.name")}</Badge>
        <ul className={s.exampleRows}>
          {rows.map((r) => (
            <li key={r.layer} className={s.exampleRow}>
              <Badge tone={r.layer} icon={r.layer}>{t(`feedback.layer.${r.layer}`)}</Badge>
              <span className={s.exampleText}>{r.body}</span>
            </li>
          ))}
        </ul>
        <Link to="/sessions/example" className={s.link} data-track="home-example-open">{t("home.example.open")}</Link>
      </div>
    </Card>
  );
}
