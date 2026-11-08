/* TacticCard (tough-talk map §9): one negotiation / hard-question tactic. Texts come from the server content
 * endpoint (`GET /api/tough-talk/content`), the chrome words ("Try saying", "Or", "Hint") from i18n.
 * Sizes: `tile` is a plaque in the plan-card ScrollStrip (title · rule · example in quotes · evidence) · `hint` is
 * the card in the Session's Suggester slot (head row with the bulb and a hide button, "Try saying", optional "Or"
 * block) · `inline` is a plain Disclosure inside a debrief (title toggle, body rule · example · evidence). */
import type { ReactNode } from "react";
import { t } from "../i18n";
import { Card } from "./Card";
import { Disclosure } from "./Disclosure";
import { IconButton } from "./Button";
import { Icon } from "./icons";
import s from "./TacticCard.module.css";

export interface TacticCardProps {
  size: "tile" | "hint" | "inline";
  title: string;
  /** The rule of the tactic (tough hint: the answer shape line). */
  rule?: string;
  /** A line to try saying; shown in quotes. */
  example?: string;
  /** Where the tactic comes from (study / source line). */
  evidence?: string;
  /** `hint` only: a second wording after "Or". */
  alt?: { title: string; example: string };
  /** `hint` only: the hide button. */
  onHide?: () => void;
  /** Heading level of the title (tile and hint). Default 3. `inline` uses the Disclosure heading. */
  headingLevel?: 2 | 3 | 4;
  /** Root element for `tile` (a `li` inside a ScrollStrip). */
  as?: "div" | "li";
  className?: string;
}

function Quote({ children }: { children: ReactNode }) {
  return <p className={s.example}>{"“"}{children}{"”"}</p>;
}

export function TacticCard({
  size, title, rule, example, evidence, alt, onHide, headingLevel = 3, as = "div", className,
}: TacticCardProps) {
  const H = `h${headingLevel}` as "h2" | "h3" | "h4";

  if (size === "inline") {
    return (
      <Disclosure surface="plain" title={title} headingLevel={headingLevel} className={className}>
        <div className={s.body}>
          {rule ? <p className={s.rule}>{rule}</p> : null}
          {example ? <Quote>{example}</Quote> : null}
          {evidence ? <p className={s.evidence}>{evidence}</p> : null}
        </div>
      </Disclosure>
    );
  }

  if (size === "tile") {
    const Root = as;
    return (
      <Root className={[s.tile, className ?? ""].filter(Boolean).join(" ")}>
        <H className={s.title}>{title}</H>
        {rule ? <p className={s.rule}>{rule}</p> : null}
        {example ? <Quote>{example}</Quote> : null}
        {evidence ? <p className={s.evidence}>{evidence}</p> : null}
      </Root>
    );
  }

  return (
    <Card padding="sm" className={[s.hint, className ?? ""].filter(Boolean).join(" ")} role="region" aria-label={t("tactic.hint")}>
      <div className={s.head}>
        <Icon name="bulb" size="sm" />
        <span className={s.headLabel}>{t("tactic.hint")}</span>
        {onHide ? <IconButton icon="x" size="sm" label={t("tactic.hideHint")} onClick={onHide} className={s.hide} /> : null}
      </div>
      <H className={s.title}>{title}</H>
      {rule ? <p className={s.rule}>{rule}</p> : null}
      {example ? (
        <div className={s.try}>
          <span className={s.label}>{t("tactic.trySaying")}</span>
          <Quote>{example}</Quote>
        </div>
      ) : null}
      {alt ? (
        <div className={s.alt}>
          <span className={s.label}>{t("tactic.or")}</span>
          <p className={s.altTitle}>{alt.title}</p>
          <Quote>{alt.example}</Quote>
        </div>
      ) : null}
    </Card>
  );
}
