/* Verdict, weak spots and actions (debrief.md §3.2–3.4, §3.7). Section labels are h2 (Section style).
 * D80: in a saved interview the verdict is a folded bar above the conversation (VerdictBar): "Verdict · Getting there"
 * with a small scale; a press opens the summary, the scale, what to fix first and the next step. */
import type { ReactNode } from "react";
import { Badge, Button, Callout, Disclosure, Skeleton, TextShimmer, WeakSpotStrip, type WeakSpot } from "../../../ds";
import { t, tp } from "../../../i18n";
import { layerSequence, type DebriefModel, type DebriefVariant, type EnglishModel, type Evidence, type Layer, type VerdictModel } from "../types";
import type { LayerOrder } from "../../../lib/types";
import s from "./sections.module.css";

const SCALE: { step: 0 | 1 | 2; key: "scale.notReady" | "scale.gettingThere" | "scale.ready" }[] = [
  { step: 0, key: "scale.notReady" },
  { step: 1, key: "scale.gettingThere" },
  { step: 2, key: "scale.ready" },
];

export function SectionHead({ id, title, sub, action }: { id: string; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.head}>
      <div className={s.headText}>
        <h2 id={id} className={s.label}>{title}</h2>
        {sub ? <p className={s.sub}>{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function VerdictBar({ verdict, id, open, onOpenChange, children }: {
  verdict: VerdictModel; id: string; open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode;
}) {
  const sr = verdict.step !== undefined ? t("debrief.scale.sr", { n: verdict.step + 1 }) : null;
  return (
    <section className={s.verdictBar} aria-labelledby={id} data-review-id="Debrief/VerdictBar" data-review-section="Debrief · Verdict" data-comment-target="">
      <Disclosure
        id={id}
        track="debrief-verdict-toggle"
        headingLevel={2}
        open={open}
        defaultOpen={false}
        onOpenChange={onOpenChange}
        title={(
          <span className={s.barTitle}>
            <span className={s.barLabel}>{t("debrief.verdict")}</span>
            <span className={s.barHeadline}>{verdict.headline}{sr ? <span className="visually-hidden">, {sr}</span> : null}</span>
            {verdict.step !== undefined ? (
              <span className={s.miniScale} aria-hidden="true">
                {SCALE.map(({ step }) => <span key={step} className={step <= verdict.step! ? s.miniOn : undefined} />)}
              </span>
            ) : null}
          </span>
        )}
      >
        <div className={s.barBody}>{children}</div>
      </Disclosure>
    </section>
  );
}

export function Verdict({ verdict, id, note, bare }: { verdict: VerdictModel; id: string; note?: ReactNode; bare?: boolean }) {
  const sr = verdict.step !== undefined ? t("debrief.scale.sr", { n: verdict.step + 1 }) : null;
  return (
    <section className={s.verdict} aria-labelledby={bare ? undefined : id} aria-label={bare ? t("debrief.verdict") : undefined} data-review-id="Debrief/Verdict" data-review-section={bare ? undefined : "Debrief · Verdict"} data-comment-target={bare ? undefined : ""}>
      {bare ? null : <SectionHead id={id} title={t("debrief.verdict")} />}
      {bare ? null : <p className={s.headline}>{verdict.headline}{sr ? <span className="visually-hidden">, {sr}</span> : null}</p>}
      {verdict.line ? <p className={s.line}>{verdict.line}</p> : null}
      {note}
      {verdict.step !== undefined ? (
        <ol className={s.scale} aria-hidden="true" data-review-id="Debrief/VerdictScale">
          {SCALE.map(({ step, key }) => (
            <li key={step} aria-current={step === verdict.step ? "true" : undefined}>
              {step === verdict.step ? <Badge tone="live" icon="check">{t(`debrief.${key}`)}</Badge> : <Badge tone="outline">{t(`debrief.${key}`)}</Badge>}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

/** Live only: the verdict is being written, or could not be written. (A template verdict is a note inside Verdict.) */
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

/** "Questions 1, 2, 4" or "Most in question 4 (12)": every number jumps to its card (open + scroll + focus). */
function EvidenceLine({ e, onJump }: { e: Evidence; onJump: (n: number) => void }) {
  const links = e.ids.map((n, i) => (
    <span key={n}>
      <Button variant="link" size="sm" aria-label={t("debrief.evidence.goTo", { n })} data-track="debrief-evidence-jump" onClick={() => onJump(n)}>{n}</Button>
      {i < e.ids.length - 1 ? "," : ""}
    </span>
  ));
  return (
    <>
      {e.kind === "most" ? t("debrief.evidence.mostIn") : tp("debrief.evidence.questions", e.ids.length)}
      {links}
      {e.trail ? <span>{e.trail}</span> : null}
    </>
  );
}

export function WeakSpots({ model, order, onJump, id }: { model: DebriefModel; order: LayerOrder; onJump: (n: number) => void; id: string }) {
  const seq = layerSequence(order);
  const sorted = [...model.weakSpots].sort((a, b) => seq.indexOf(a.layer) - seq.indexOf(b.layer));
  const items: WeakSpot[] = sorted.map((w) => ({
    id: w.id,
    layer: w.layer,
    layerLabel: t(`feedback.layer.${w.layer}`),
    title: w.title,
    evidence: w.evidence ? <EvidenceLine e={w.evidence} onJump={onJump} /> : undefined,
    fix: w.fix ? <><strong className={s.lead}>{t("debrief.fixLead")}</strong> {w.fix}</> : undefined,
    also: w.also ? (
      <>
        <strong className={s.lead}>{t("debrief.alsoLead")}</strong> {w.also.text} {tp("debrief.inQuestion", w.also.ids.length)}{" "}
        {w.also.ids.map((n, i) => (
          <span key={n}>
            <Button variant="link" size="sm" aria-label={t("debrief.evidence.goTo", { n })} data-track="debrief-evidence-jump" onClick={() => onJump(n)}>{n}</Button>
            {i < w.also!.ids.length - 1 ? "," : ""}
          </span>
        ))}
        {w.also.fix ? <> — {w.also.fix}</> : null}
      </>
    ) : undefined,
  }));
  return (
    <section className={s.block} aria-labelledby={id} data-review-id="Debrief/WeakSpots" data-review-section="Debrief · What to work on" data-comment-target="">
      <SectionHead id={id} title={t("debrief.workOn")} sub={t("debrief.workOnSub")} />
      <WeakSpotStrip context="debrief" items={items} headingLevel={2} />
    </section>
  );
}

export interface ActionsProps {
  variant: DebriefVariant;
  model: DebriefModel;
  /** The storage is not writable: Download is the only primary, Drill drops to secondary (one primary per page). */
  storageError?: boolean;
  partial?: boolean;
  onDrill?: () => void;
  onPractise?: () => void;
  onStartFirst?: () => void;
  english?: EnglishModel;
  id: string;
}

export function Actions({ variant, model, storageError, partial, onDrill, onPractise, onStartFirst, english, id }: ActionsProps) {
  let body: ReactNode;
  if (variant === "example") {
    body = (
      <>
        <p className={s.exampleHint}>{t("debrief.example.own")}</p>
        <Button variant="link" data-track="debrief-example-start" onClick={onStartFirst}>{t("debrief.example.start")}</Button>
      </>
    );
  } else if (variant === "english") {
    // No phrases to practise (a clean session): a plain "Practise again", never "uses these 0 phrases".
    const count = english?.phrases.length ?? 0;
    body = (
      <>
        <div className={s.action}>
          <Button variant="primary" size="lg" icon="refresh" data-track="practise-again" onClick={onPractise}>
            {count ? t("debrief.english.practise") : t("debrief.practiceAgain")}
          </Button>
          {count ? (
            <p className={s.hint}>
              {english?.practiseMinutes !== undefined
                ? tp("debrief.english.practiseHint", count, { minutes: english.practiseMinutes })
                : tp("debrief.english.practiseHintNoTime", count)}
            </p>
          ) : null}
        </div>
      </>
    );
  } else if (partial) {
    body = (
      <>
        <div className={s.action}>
          <Button variant="primary" size="lg" icon="refresh" data-track="practise-again" onClick={onPractise}>{t("debrief.practiceAgain")}</Button>
          <p className={s.hint}>{t("debrief.practiseHint")}</p>
        </div>
      </>
    );
  } else {
    const d = model.drill;
    body = (
      <>
        {d ? (
          <div className={s.action}>
            <Button variant={storageError ? "secondary" : "primary"} size="lg" icon="play" data-track="drill-start" onClick={onDrill}>{t("debrief.drill")}</Button>
            <p className={s.hint}>
              {d.questions === undefined
                ? tp("debrief.drillHintPoints", d.points)
                : d.minutes !== undefined
                  ? t("debrief.drillHint", { questions: d.questions, points: d.points, minutes: d.minutes })
                  : t("debrief.drillHintNoTime", { questions: d.questions, points: d.points })}
            </p>
          </div>
        ) : null}
        <div className={s.action}>
          <Button variant="secondary" size="lg" icon="refresh" data-track="practise-again" onClick={onPractise}>{t("debrief.practiceAgain")}</Button>
          <p className={s.hint}>{t("debrief.practiseHint")}</p>
        </div>
      </>
    );
  }
  return (
    <section className={s.actions} aria-labelledby={id} data-review-id="Debrief/Actions" data-review-section="Debrief · Actions" data-comment-target="">
      <h2 id={id} className="visually-hidden">{t("debrief.actions")}</h2>
      {body}
    </section>
  );
}

export type { Layer };
