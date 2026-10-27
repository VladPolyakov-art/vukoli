/* Question numbers as link buttons: every number jumps to its card (open + scroll + focus). Used by the weak-spot
 * evidence ("Questions 1, 2, 4") and by the scorecard ("Lost points in questions 1, 2").
 * Reads "1, 2, 3": the comma sits right after its number (D98 live check). Each "n," is one unbreakable unit and the
 * last number is joined to the one before it with a no-break space, so a number never wraps on its own. */
import { Button } from "../../../ds";
import { t } from "../../../i18n";
import s from "./questionLinks.module.css";

export function QuestionLinks({ ids, onJump }: { ids: number[]; onJump: (n: number) => void }) {
  const list = [...new Set(ids)];
  return (
    <span className={s.links}>
      {list.map((n, i) => (
        <span key={n}>
          {i === 0 ? "" : i === list.length - 1 ? " " : " "}
          <span className={s.unit}>
            <Button variant="link" size="sm" className={s.num} aria-label={t("debrief.evidence.goTo", { n })} data-track="debrief-evidence-jump" onClick={() => onJump(n)}>{n}</Button>
            {i < list.length - 1 ? "," : ""}
          </span>
        </span>
      ))}
    </span>
  );
}
