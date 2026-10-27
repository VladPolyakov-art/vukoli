/* Shared bits of the debrief page (debrief.md): section heads, the verdict notices (pending / missing / template), the quote
 * (`Said`), Practise again and the actions block. The verdict, the plan, the skills and the questions are their own parts
 * (layout D, 2026-10-27). Section labels are h2. */
import type { ReactNode } from "react";
import { Button, Callout, Skeleton, TextShimmer, Tooltip } from "../../../ds";
import { t, tp } from "../../../i18n";
import type { DebriefModel, DebriefVariant, EnglishModel, Layer, SaidModel } from "../types";
import { drillHintText } from "./drillHint";
import s from "./sections.module.css";

export function SectionHead({ id, title, sub, note, action }: { id: string; title: ReactNode; sub?: ReactNode; note?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.head}>
      <div className={s.headText}>
        <h2 id={id} className={s.label}>{title}</h2>
        {sub ? <p className={s.sub}>{sub}</p> : null}
        {note ? <p className={s.sub}>{note}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Live only: the verdict came from the template, not from the model: offer to write it again. */
export function TemplateNote({ rerunning, onRerun }: { rerunning?: boolean; onRerun?: () => void }) {
  return (
    <Callout tone="warning" actions={onRerun ? <Button size="sm" variant="secondary" icon="refresh" data-track="debrief-rerun" loading={rerunning} onClick={onRerun}>{rerunning ? t("debrief.rerunning") : t("debrief.rerun")}</Button> : undefined}>
      {t("debrief.template")}
    </Callout>
  );
}

export function VerdictNotice({ kind, id, rerunning, onRerun }: { kind: "pending" | "missing"; id: string; rerunning?: boolean; onRerun?: () => void }) {
  const rerun = onRerun ? (
    <Button size="sm" variant="secondary" icon="refresh" data-track="debrief-rerun" loading={rerunning} onClick={onRerun}>{rerunning ? t("debrief.rerunning") : t("debrief.rerun")}</Button>
  ) : null;
  return (
    <section className={s.verdict} aria-labelledby={id} data-review-id="Debrief/VerdictNotice" data-review-section="Debrief · Verdict" data-comment-target="">
      <SectionHead id={id} title={t("debrief.verdict")} />
      {kind === "pending" ? (
        <>
          <TextShimmer as="p" status size="md">{t("debrief.pending")}</TextShimmer>
          <Skeleton lines={2} label={t("debrief.pending")} />
        </>
      ) : (
        rerun ?? <p className={s.line}>{t("debrief.noFeedback")}</p>
      )}
    </section>
  );
}

/** D98: an exact fragment is a quote (quotation marks); a delivery number is plain text. */
export function Said({ said }: { said: SaidModel }) {
  return said.kind === "quote" ? <q className={s.quote}>{said.text}</q> : <span className={s.metric}>{said.text}</span>;
}

/** The hint behind "Practise again" (a tooltip and the button's description, no longer a line under it). */
export function practiseHint(variant: DebriefVariant, english?: EnglishModel): string | undefined {
  if (variant !== "english") return t("debrief.practiseHint");
  const count = english?.phrases.length ?? 0;
  if (!count) return undefined;
  return english?.practiseMinutes !== undefined
    ? tp("debrief.english.practiseHint", count, { minutes: english.practiseMinutes })
    : tp("debrief.english.practiseHintNoTime", count);
}

/** One "Practise again" for the whole page, next to the view switch (both views). English with phrases to review: "Practise these phrases". */
export function PractiseAgain({ variant, english, partial, storageError, onPractise }: {
  variant: DebriefVariant; english?: EnglishModel; partial?: boolean; storageError?: boolean; onPractise?: () => void;
}) {
  if (variant === "example") return null;
  const phrases = variant === "english" && (english?.phrases.length ?? 0) > 0;
  // With no drill on the page (English, a too-short session) this is the one primary; otherwise the drill is.
  const primary = (variant === "english" || partial) && !storageError;
  const hint = practiseHint(variant, english);
  const button = (
    <Button variant={primary ? "primary" : "secondary"} icon="refresh" data-track="practise-again" aria-description={hint} onClick={onPractise}>
      {phrases ? t("debrief.english.practise") : t("debrief.practiceAgain")}
    </Button>
  );
  return hint ? <Tooltip content={hint} placement="bottom-start">{button}</Tooltip> : button;
}

export interface ActionsProps {
  variant: DebriefVariant;
  model: DebriefModel;
  /** The storage is not writable: Download is the only primary, Drill drops to secondary (one primary per page). */
  storageError?: boolean;
  /** D98: the plan's first step carries the drill action, so this block does not repeat it (and the example's hint moves there too). */
  drillInPlan?: boolean;
  partial?: boolean;
  onDrill?: () => void;
  id: string;
}

/** What is left of the old Actions block (Practise again moved to the top of the page): the drill of an older debrief with no plan, and the example's hint (its way in is the banner button). */
export function Actions({ variant, model, storageError, drillInPlan, partial, onDrill, id }: ActionsProps) {
  let body: ReactNode = null;
  /* The example's way in ("Start your first interview") is the ExampleBanner button at the top; no second link here. */
  if (variant === "example") {
    body = drillInPlan ? null : <p className={s.exampleHint}>{t("debrief.example.own")}</p>;
  } else if (variant === "interview" && !partial && model.drill && !drillInPlan) {
    body = (
      <div className={s.action}>
        <Button variant={storageError ? "secondary" : "primary"} size="lg" icon="play" data-track="drill-start" onClick={onDrill}>{t("debrief.drill")}</Button>
        <p className={s.hint}>{drillHintText(model.drill)}</p>
      </div>
    );
  }
  if (!body) return null;
  return (
    <section className={s.actions} aria-labelledby={id} data-review-id="Debrief/Actions" data-review-section="Debrief · Actions" data-comment-target="">
      <h2 id={id} className="visually-hidden">{t("debrief.actions")}</h2>
      {body}
    </section>
  );
}

export type { Layer };
