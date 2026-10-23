/* First-time tips (Question 1 only): static, never animated while speaking, removed after the first answer. */
import { Card, Icon } from "../../../ds";
import { t } from "../../../i18n";
import type { SessionInput } from "../types";
import s from "./parts.module.css";

export function FirstTime({ input, pauseSec, english = false }: { input: SessionInput; pauseSec: number; /** English practice has turns, not questions (F-13-9). */ english?: boolean }) {
  return (
    <Card tone="subtle" padding="sm" className={s.tips}>
      <div data-review-id="Session/Tips" data-review-section="Session · First-time tips" data-comment-target className={s.tipsInner}>
        <p className={s.tipsTitle}><Icon name="info" size="sm" />{t("session.firstTime.title")}</p>
        <ul className={s.tipsList}>
          {input === "voice" ? (
            <>
              <li>{pauseSec > 0 ? t("session.firstTime.voice1", { sec: pauseSec }) : t("session.firstTime.voice1Manual")}</li>
              <li>{t("session.firstTime.voice2")}</li>
              <li>{t("session.firstTime.voice3")}</li>
            </>
          ) : (
            <>
              <li>{t("session.firstTime.text1")}</li>
              <li>{t("session.firstTime.text2")}</li>
              <li>{t(english ? "session.firstTime.text3English" : "session.firstTime.text3")}</li>
            </>
          )}
        </ul>
      </div>
    </Card>
  );
}
