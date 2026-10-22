/* Answer suggester (US-58): practice only, generated once per question, static while the user speaks.
 * v2 (session.md §V2.3): the on / off switch lives in the island's More menu (checkbox item); the stage shows the
 * card only while it is on. */
import { Card, TextShimmer } from "../../../ds";
import { t } from "../../../i18n";
import type { SessionSuggestion } from "../types";
import s from "./parts.module.css";

export function Suggester({ suggestion }: { suggestion?: SessionSuggestion }) {
  return (
    <Card padding="sm" className={s.suggest}>
      <div data-review-id="Session/Suggester" data-review-section="Session · Answer suggester" data-comment-target className={s.suggestInner}>
        <div className={s.suggestBody}>
          <strong>{t("session.suggest.title")}</strong>
          <span className={s.suggestStory}>{t("session.suggest.practiceOnly")}</span>
          {!suggestion || suggestion.status === "pending" ? <TextShimmer status>{t("session.suggest.pending")}</TextShimmer> : null}
          {suggestion?.status === "unavailable" ? <span>{suggestion.message}</span> : null}
          {suggestion?.status === "ready" ? (
            <>
              {suggestion.story ? <span className={s.suggestStory}>{t("session.suggest.story", { story: suggestion.story })}</span> : null}
              {suggestion.answer ? <p className={s.suggestAnswer}>{suggestion.answer}</p> : null}
              {suggestion.points?.length ? (
                <>
                  <span className={s.suggestStory}>{t("session.suggest.points")}</span>
                  <ul className={s.suggestList}>{suggestion.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
