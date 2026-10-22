/* PlanCard (home.md v2 §4.9): the end of the setup chat. A subtle card with a `<dl>` of what Mike will do, a Change
 * link per editable row (listbox for the job, radio menus for round / strictness / level / topic / focus) and the
 * screen's one primary button. Start becomes the connecting pill once pressed (motion D2). */
import type { ReactNode, Ref } from "react";
import { Button, Card, Dots, Icon, Menu, TextShimmer, type ListboxOption, type MenuEntry } from "../../../ds";
import { t, tp } from "../../../i18n";
import { joinTitle } from "../../../components/vacancyTitle";
import { levelValue, roundValue, strictnessValue } from "../script";
import type { HomeViewProps, JobItem, Level, PlanModel, PlanRow, RoundType, Strictness } from "../types";
import s from "./parts.module.css";

const ROUNDS: RoundType[] = ["hr", "behavioural", "technical", "mix"];
const STRICT: Strictness[] = [1, 2, 3];
const STRICT_KEY = { 1: "gentle", 2: "standard", 3: "tough" } as const;
const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];
const TOPICS = ["free", "work", "small"] as const;

export interface PlanCardProps {
  plan: PlanModel;
  jobs: JobItem[];
  engineReady: boolean;
  textMode?: boolean;
  starting?: boolean;
  initialOverlay?: HomeViewProps["initialOverlay"];
  headingRef?: Ref<HTMLHeadingElement>;
  onChange?: (row: PlanRow, value: string) => void;
  onRemoveNote?: () => void;
  onRetryPrep?: () => void;
  onAddCv?: () => void;
  onStart?: () => void;
  onTypeInstead?: () => void;
}

function ChangeMenu({ row, label, items, open }: { row: PlanRow; label: string; items: MenuEntry[]; open?: boolean }) {
  return (
    <Menu
      label={label}
      items={items}
      placement="bottom-end"
      defaultOpen={open}
      className={s.rowAction}
      trigger={(p) => (
        <Button {...p} variant="link" size="sm" aria-label={label} data-row={row} data-track={`plan-change-${row}`}>{t("chat.plan.change")}</Button>
      )}
    />
  );
}

function Row({ term, children, action }: { term: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.row}>
      <dt className={s.term}>{term}</dt>
      {/* QA-08: the Change action lives inside the dd, so the list stays `dl > div > dt + dd`. */}
      <dd className={s.value}>
        <div className={s.valueBody}>{children}</div>
        {action}
      </dd>
    </div>
  );
}

export function PlanCard(props: PlanCardProps) {
  const { plan, jobs, engineReady, textMode, starting, initialOverlay, headingRef, onChange } = props;
  const english = plan.kind === "english";
  const drill = plan.kind === "drill";
  const startLabel = english ? t("english.start") : drill ? t("chat.plan.startDrill") : t("home.start");
  // QA-02: while Mike writes the job's questions the plan says so, and a session started now would use general ones.
  const waiting = !english && plan.jobStatus === "preparing" && Boolean(plan.job);
  const reasonId = "home-start-reason";

  const radio = <V extends string | number>(row: PlanRow, values: readonly V[], current: V, label: (v: V) => string, desc?: (v: V) => string): MenuEntry[] =>
    values.map((v) => ({ id: String(v), track: `plan-${row}-${String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, label: label(v), description: desc?.(v), checked: v === current, onSelect: () => onChange?.(row, String(v)) }));

  const jobOptions: ListboxOption[] = [
    ...jobs.map((j) => ({ id: j.id, track: "job-option", label: j.company, description: j.role, icon: "briefcase" as const })),
    { id: "general", track: "job-option-general", label: t("chat.plan.general"), description: t("home.vacancies.generalHint") },
  ];

  const jobStatus = !plan.job ? null : plan.jobStatus === "preparing"
    ? <TextShimmer status>{t("chat.plan.preparing")}</TextShimmer>
    : plan.jobStatus === "error"
      ? (
        <span className={s.valueRow}>
          <span className={s.valueSub}>{t("chat.plan.prepError")}</span>
          <Button variant="link" size="sm" icon="refresh" data-track="plan-retry-prep" onClick={props.onRetryPrep}>{t("chat.plan.tryAgain")}</Button>
        </span>
      )
      : plan.questionsReady ? <span className={s.valueSub}>{tp("chat.plan.ready", plan.questionsReady)}</span> : null;

  const basis = plan.basis === "cv+job" ? t("home.basis.job", { job: plan.job?.company ?? "" })
    : plan.basis === "job" ? t("home.basis.jobNoCv", { job: plan.job?.company ?? "" })
      : plan.basis === "cv" ? t("home.basis.cv") : t("home.basis.general");

  return (
    <Card tone="subtle" padding="md">
      <section className={s.plan} aria-labelledby="home-plan" data-review-id="Home/Plan" data-review-section="Home · Plan" data-comment-target>
        <h2 id="home-plan" ref={headingRef} tabIndex={-1} className={s.planTitle}>{t("chat.plan.title")}</h2>
        <dl className={s.rows}>
          {english ? (
            <>
              <Row term={t("chat.plan.level")} action={plan.level ? <ChangeMenu row="level" label={t("chat.plan.changeLevel")} items={radio("level", LEVELS, plan.level, (l) => l, (l) => t(`english.levels.${l}`))} /> : undefined}>
                {plan.level ? levelValue(plan.level) : null}
              </Row>
              <Row term={t("chat.plan.topic")} action={<ChangeMenu row="topic" label={t("chat.plan.changeTopic")} items={radio("topic", TOPICS, (TOPICS.find((x) => t(`english.topics.${x}`) === plan.topic) ?? "free"), (x) => t(`english.topics.${x}`))} />}>
                {plan.topic}
              </Row>
              <Row term={t("chat.plan.corrections")}>{t("chat.plan.correctionsValue")}</Row>
              <Row term={t("chat.plan.length")}>{t("chat.plan.lengthEnglish")}</Row>
              {plan.phrases?.length ? <Row term={t("chat.plan.phrases")}>{plan.phrases.join(" · ")}</Row> : null}
            </>
          ) : (
            <>
              {drill && plan.focus ? (
                <Row term={t("chat.plan.focus")} action={plan.focusOptions ? <ChangeMenu row="focus" label={t("chat.plan.changeFocus")} items={radio("focus", plan.focusOptions.map((o) => o.id), plan.focus.id, (id) => plan.focusOptions!.find((o) => o.id === id)!.label)} /> : undefined}>
                  {plan.focus.label}
                </Row>
              ) : null}
              <Row
                term={t("chat.plan.job")}
                action={(
                  <Menu
                    kind="listbox"
                    label={t("chat.plan.jobs")}
                    options={jobOptions}
                    value={plan.job?.id ?? "general"}
                    onChange={(id) => onChange?.("job", id)}
                    matchWidth={false}
                    placement="bottom-end"
                    defaultOpen={initialOverlay === "change-job"}
                    className={s.rowAction}
                    trigger={(p) => <Button {...p} variant="link" size="sm" data-track="plan-change-job" aria-label={t("chat.plan.changeJob")}>{t("chat.plan.change")}</Button>}
                  />
                )}
              >
                <span>{plan.job ? joinTitle(plan.job) : t("chat.plan.general")}</span>
                {jobStatus}
              </Row>
              {!drill ? (
                <>
                  <Row term={t("chat.plan.round")} action={<ChangeMenu row="round" open={initialOverlay === "change-round"} label={t("chat.plan.changeRound")} items={radio("round", ROUNDS, plan.round, (r) => t(`home.round.${r}`), (r) => t(`home.round.${r}Hint`))} />}>
                    {roundValue(plan.round)}
                  </Row>
                  <Row term={t("chat.plan.strictness")} action={<ChangeMenu row="strictness" open={initialOverlay === "change-strictness"} label={t("chat.plan.changeStrictness")} items={radio("strictness", STRICT, plan.strictness, (v) => t(`home.strictness.${STRICT_KEY[v]}.label`), (v) => t(`home.strictness.${STRICT_KEY[v]}.desc`))} />}>
                    {strictnessValue(plan.strictness)}
                  </Row>
                </>
              ) : null}
              <Row term={t("chat.plan.length")}>
                {drill ? t("chat.plan.drillLength", { n: plan.questions, min: plan.minutes }) : t("chat.plan.lengthValue", { n: plan.questions, min: plan.minutes })}
              </Row>
              {!drill ? <Row term={t("chat.plan.basis")}>{`${basis}.`}</Row> : null}
              {plan.note ? (
                <Row term={t("chat.plan.note")} action={<Button variant="link" size="sm" className={s.rowAction} aria-label={t("chat.plan.removeNote")} data-track="plan-remove-note" onClick={props.onRemoveNote}>{t("chat.plan.remove")}</Button>}>
                  {plan.note}
                </Row>
              ) : null}
              {plan.watch ? <Row term={t("chat.plan.watch")}>{plan.watch}</Row> : null}
            </>
          )}
        </dl>
        {!english && !plan.hasCv ? (
          <p className={s.planLine}>
            <Icon name="info" size="sm" />
            <span>{t("chat.plan.noCv")}</span>
            <Button variant="link" size="sm" data-track="plan-add-cv" onClick={props.onAddCv}>{t("chat.plan.addCv")}</Button>
          </p>
        ) : null}
        <div className={s.actions} data-review-id="Home/Start" data-review-section="Home · Start" data-comment-target>
          {starting ? (
            <span className={s.startSlot}><Dots variant="pill" shimmer showLabel label={t("home.connecting")} /></span>
          ) : (
            <Button
              variant="primary"
              size="lg"
              icon={textMode ? "keyboard" : "mic"}
              data-track={english ? "start-english" : drill ? "start-drill" : "start-interview"}
              disabled={!engineReady || waiting}
              aria-describedby={!engineReady || waiting ? reasonId : undefined}
              onClick={props.onStart}
            >
              {startLabel}
            </Button>
          )}
          {!engineReady ? <span id={reasonId} className={s.actionsNote}>{t("home.engine.reason")}</span> : null}
          {engineReady && waiting && !starting ? <span id={reasonId} className={s.actionsNote}>{t("chat.plan.startWaits")}</span> : null}
          {engineReady && textMode && !waiting ? <span className={s.actionsNote}>{t("home.browser.typing")}</span> : null}
          {engineReady && !textMode && !starting ? (
            <Button variant="ghost" size="sm" icon="keyboard" data-track="type-instead" disabled={waiting} aria-describedby={waiting ? reasonId : undefined} onClick={props.onTypeInstead}>{t("home.typeInstead")}</Button>
          ) : null}
        </div>
      </section>
    </Card>
  );
}
