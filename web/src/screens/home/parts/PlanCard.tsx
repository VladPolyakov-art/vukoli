/* PlanCard (home.md v2 §4.9): the end of the setup chat. A subtle card with a `<dl>` of what Mike will do, a Change
 * link per editable row (listbox for the job, radio menus for round / strictness / level / topic / focus) and the
 * screen's one primary button. Start becomes the connecting pill once pressed (motion D2). */
import { useState, type ReactNode, type Ref } from "react";
import { Button, Card, Dots, Icon, Menu, ScrollStrip, TacticCard, TextShimmer, type ListboxOption, type MenuEntry } from "../../../ds";
import { t, tp } from "../../../i18n";
import { joinTitle } from "../../../components/vacancyTitle";
import { formatAmount } from "../../../lib/amount";
import { numbersFromStart, type NumbersValues } from "../numbers";
import { levelValue, roundValue, strictnessValue } from "../script";
import type { HomeViewProps, JobItem, Level, PlanModel, PlanRow, RoundType, Strictness } from "../types";
import { NumbersDialog } from "./NumbersForm";
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
  onNumbers?: HomeViewProps["onNumbers"];
  onTactics?: HomeViewProps["onTactics"];
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

const lowerFirst = (v: string) => (v ? v[0]!.toLowerCase() + v.slice(1) : v);

/** The plan's rows for Tough questions / Negotiate salary (tough-talk.md §2.6), the numbers dialog and the tactic strip. */
function TalkPlan({ plan, jobs, initialOverlay, onChange, onNumbers, onTactics, onRemoveNote }: Pick<PlanCardProps, "plan" | "jobs" | "initialOverlay" | "onChange" | "onNumbers" | "onTactics" | "onRemoveNote">) {
  const talk = plan.talk!;
  const neg = plan.negotiate;
  const negotiate = plan.kind === "negotiate";
  const [dialog, setDialog] = useState(initialOverlay === "change-numbers");
  const [draft, setDraft] = useState<NumbersValues | null>(null);
  const fromPlan: NumbersValues | null = neg ? numbersFromStart(neg, talk.currencies) : null;
  const radio = (row: PlanRow, items: { id: string; label: string; description?: string }[], current: string): MenuEntry[] =>
    items.map((o) => ({ id: o.id, track: `plan-${row}-${o.id}`, label: o.label, description: o.description, checked: o.id === current, onSelect: () => onChange?.(row, o.id) }));

  const style = neg?.style ?? "friendly";
  const mike = negotiate
    ? style === "surprise" ? t("home.talk.style.surprise.blurb") : `${talk.styles.find((x) => x.id === style)?.label ?? ""}: ${lowerFirst(t(`home.talk.style.${style}.blurb` as "home.talk.style.firm.blurb"))}`
    : t("home.talk.tough.mike");
  const numbersText = neg
    ? neg.job_low !== undefined && neg.job_high !== undefined
      ? t("home.talk.plan.numbersRange", { low: formatAmount(neg.job_low), high: formatAmount(neg.job_high), currency: neg.currency, target: formatAmount(neg.target) })
      : t("home.talk.plan.numbersNoRange", { target: formatAmount(neg.target), currency: neg.currency })
    : "";
  const jobOptions: ListboxOption[] = [
    ...jobs.map((j) => ({ id: j.id, track: "job-option", label: j.company, description: j.role, icon: "briefcase" as const })),
    { id: "type", track: "role-option-type", label: t("home.talk.plan.typeRole"), icon: "edit" as const },
  ];
  const tactics = plan.tactics ?? [];

  return (
    <>
      <dl className={s.rows}>
        {negotiate ? (
          <>
            <Row
              term={t("home.talk.plan.role")}
              action={(
                <Menu
                  kind="listbox"
                  label={t("home.talk.plan.changeLabel", { what: t("home.talk.plan.role").toLowerCase() })}
                  options={jobOptions}
                  value={plan.job?.id ?? "type"}
                  onChange={(id) => { onChange?.("role", id); if (id === "type") setDialog(true); }}
                  matchWidth={false}
                  placement="bottom-end"
                  defaultOpen={initialOverlay === "change-job"}
                  className={s.rowAction}
                  trigger={(p) => <Button {...p} variant="link" size="sm" data-track="plan-change-role" aria-label={t("home.talk.plan.changeLabel", { what: t("home.talk.plan.role").toLowerCase() })}>{t("home.talk.change")}</Button>}
                />
              )}
            >
              {plan.job ? joinTitle(plan.job) : neg?.role}
            </Row>
            <Row
              term={t("home.talk.plan.numbers")}
              action={<Button variant="link" size="sm" className={s.rowAction} aria-label={t("home.talk.plan.changeLabel", { what: t("home.talk.plan.numbers").toLowerCase() })} data-track="plan-change-numbers" onClick={() => setDialog(true)}>{t("home.talk.change")}</Button>}
            >
              {numbersText}
            </Row>
            <Row term={t("home.talk.plan.mike")} action={<ChangeMenu row="style" open={initialOverlay === "change-style"} label={t("home.talk.plan.changeLabel", { what: t("home.talk.plan.mike") })} items={radio("style", talk.styles.map((x) => ({ id: x.id, label: x.label, description: x.difficulty || undefined })), style)} />}>
              {mike}
            </Row>
            <Row term={t("home.talk.plan.offer")} action={<Button variant="link" size="sm" className={s.rowAction} aria-label={t("home.talk.plan.changeLabel", { what: t("home.talk.plan.offer").toLowerCase() })} data-track="plan-change-offer" onClick={() => onChange?.("offer", neg?.has_real_offer ? "off" : "on")}>{t("home.talk.change")}</Button>}>
              {t(neg?.has_real_offer ? "home.talk.plan.offerYes" : "home.talk.plan.offerNo")}
            </Row>
            <Row term={t("home.talk.plan.length")}>{t("home.talk.negotiate.length")}</Row>
          </>
        ) : (
          <>
            <Row term={t("home.talk.plan.theme")} action={<ChangeMenu row="theme" open={initialOverlay === "change-theme"} label={t("home.talk.plan.changeLabel", { what: t("home.talk.plan.theme").toLowerCase() })} items={radio("theme", talk.themes, plan.tough?.theme ?? "mix")} />}>
              {plan.tough?.themeName}
            </Row>
            <Row term={t("home.talk.plan.mike")}>{mike}</Row>
            <Row term={t("home.talk.plan.length")}>{t("home.talk.tough.length", { n: plan.questions, min: plan.minutes })}</Row>
            <Row term={t("home.talk.plan.afterCall")}>{t("home.talk.tough.afterCall")}</Row>
          </>
        )}
        {plan.note ? (
          <Row term={t("chat.plan.note")} action={<Button variant="link" size="sm" className={s.rowAction} aria-label={t("chat.plan.removeNote")} data-track="plan-remove-note" onClick={onRemoveNote}>{t("chat.plan.remove")}</Button>}>
            {plan.note}
          </Row>
        ) : null}
      </dl>
      {plan.tacticsHidden ? (
        <p className={s.tacticsHidden} data-review-id="Home/Plan/Tactics">
          {t("tactic.hidden")}
          <Button variant="link" size="sm" data-track="tactics-show" onClick={() => onTactics?.(false)}>{t("tactic.show")}</Button>
        </p>
      ) : tactics.length ? (
        <ScrollStrip
          label={t("tactic.forThisCall")}
          className={s.tactics}
          actions={<Button variant="link" size="sm" data-track="tactics-hide" onClick={() => onTactics?.(true)}>{t("tactic.hide")}</Button>}
        >
          {tactics.map((c) => <TacticCard key={c.id} as="li" size="tile" title={c.title} rule={c.rule} example={c.example} evidence={c.evidence} />)}
        </ScrollStrip>
      ) : null}
      {negotiate && fromPlan ? (
        <NumbersDialog
          open={dialog}
          values={draft ?? fromPlan}
          roleField={talk.roleEditable}
          fromPost={talk.fromPost}
          currencies={talk.currencies}
          onValues={setDraft}
          onClose={() => setDialog(false)}
          onSave={() => { onNumbers?.(null, draft ?? fromPlan); setDraft(null); setDialog(false); }}
        />
      ) : null}
    </>
  );
}

export function PlanCard(props: PlanCardProps) {
  const { plan, jobs, engineReady, textMode, starting, initialOverlay, headingRef, onChange } = props;
  const english = plan.kind === "english";
  const drill = plan.kind === "drill";
  const talk = plan.kind === "tough" || plan.kind === "negotiate";
  const startLabel = english ? t("english.start") : drill ? t("chat.plan.startDrill") : plan.kind === "negotiate" ? t("home.talk.negotiate.start") : plan.kind === "tough" ? t("home.talk.tough.start") : t("home.start");
  // QA-02: while Mike writes the job's questions the plan says so, and a session started now would use general ones.
  const waiting = !english && !talk && plan.jobStatus === "preparing" && Boolean(plan.job);
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
        {talk ? (
          <TalkPlan plan={plan} jobs={jobs} initialOverlay={initialOverlay} onChange={onChange} onNumbers={props.onNumbers} onTactics={props.onTactics} onRemoveNote={props.onRemoveNote} />
        ) : (
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
        )}
        {!english && !talk && !plan.hasCv ? (
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
              data-track={english ? "start-english" : drill ? "start-drill" : plan.kind === "negotiate" ? "start-negotiate" : plan.kind === "tough" ? "start-tough" : "start-interview"}
              disabled={(!engineReady && !talk) || waiting}
              aria-describedby={(!engineReady && !talk) || waiting ? reasonId : undefined}
              onClick={props.onStart}
            >
              {startLabel}
            </Button>
          )}
          {!engineReady && !talk ? <span id={reasonId} className={s.actionsNote}>{t("home.engine.reason")}</span> : null}
          {engineReady && waiting && !starting ? <span id={reasonId} className={s.actionsNote}>{t("chat.plan.startWaits")}</span> : null}
          {textMode && !waiting && (engineReady || talk) ? <span className={s.actionsNote}>{t("home.browser.typing")}</span> : null}
          {(engineReady || talk) && !textMode && !starting ? (
            <Button variant="ghost" size="sm" icon="keyboard" data-track="type-instead" disabled={waiting} aria-describedby={waiting ? reasonId : undefined} onClick={props.onTypeInstead}>{t("home.typeInstead")}</Button>
          ) : null}
        </div>
        {talk && !engineReady ? (
          <p className={s.planLine}><Icon name="info" size="sm" />{t(plan.kind === "negotiate" ? "home.talk.negotiate.engineOff" : "home.talk.tough.engineOff")}</p>
        ) : null}
      </section>
    </Card>
  );
}
