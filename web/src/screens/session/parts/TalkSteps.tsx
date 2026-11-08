/* Negotiation v3 (P7): the five steps of the talk, current one highlighted. Shown only when the server sent `talk_step`. */
import { Icon } from "../../../ds";
import { t } from "../../../i18n";
import type { TalkStepsModel } from "../talkSteps";
import s from "./parts.module.css";

export function TalkSteps({ model }: { model: TalkStepsModel }) {
  return (
    <ol className={s.talkSteps} aria-label={t("session.steps.label")} data-review-id="Session/TalkSteps">
      {model.steps.map((x) => (
        <li
          key={x.n}
          className={`${s.talkStep} ${x.state === "done" ? s.talkStepDone : ""} ${x.state === "current" ? s.talkStepCurrent : ""}`}
          aria-current={x.state === "current" ? "step" : undefined}
        >
          {x.state === "done" ? <Icon name="check" size="sm" /> : <span aria-hidden="true">{x.n}</span>}
          <span>{x.label}</span>
        </li>
      ))}
    </ol>
  );
}
