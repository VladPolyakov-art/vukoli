/* The Setup chrome (D81): brand, the steps (three, or four with Install first: D104), one content column; a step's heading and its footer. */
import type { ReactNode, RefObject } from "react";
import { Icon } from "../../ds";
import { t } from "../../i18n";
import { Wordmark } from "../../components/Wordmark";
import { setupSteps, type SetupStep } from "./types";
import s from "./Setup.module.css";

export interface SetupFrameProps {
  /** The current step; `null` while the wizard decides whether to start with Install (a quiet frame). */
  step: SetupStep | null;
  /** The steps of this run (default: the three without Install). */
  steps?: readonly SetupStep[];
  children?: ReactNode;
}

export function SetupFrame({ step, steps = setupSteps(false), children }: SetupFrameProps) {
  const index = step ? steps.indexOf(step) : -1;
  return (
    <div className={s.screen}>
      <header className={s.header}>
        <span className={s.brand}><Wordmark /></span>
        <nav aria-label={t("setup.steps")}>
          <ol className={s.steps}>
            {steps.map((x, i) => (
              <li key={x} className={`${s.step} ${i < index ? s.stepDone : ""}`} aria-current={x === step ? "step" : undefined}>
                <span className={s.num} aria-hidden="true">{i < index ? <Icon name="check" size="sm" /> : i + 1}</span>
                <span className={s.stepLabel}>{t(`setup.step.${x}`)}</span>
                {i < index ? <span className="visually-hidden">({t("setup.stepDone")})</span> : null}
              </li>
            ))}
          </ol>
        </nav>
      </header>
      <main className={s.main} id="main">
        {children}
      </main>
    </div>
  );
}

export type HeadingRef = RefObject<HTMLHeadingElement | null>;

export function StepHead({ headingRef, title, sub }: { headingRef?: HeadingRef; title: string; sub?: string }) {
  return (
    <div className={s.head}>
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      {sub ? <p className={s.sub}>{sub}</p> : null}
    </div>
  );
}

/** Back on the left (when there is one), the step's actions on the right. */
export function StepFooter({ back, children }: { back?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.footer}>
      {back}
      <div className={s.footerRight}>{children}</div>
    </div>
  );
}
