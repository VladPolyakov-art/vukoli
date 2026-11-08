/* The negotiate numbers form (tough-talk.md §2.4, US-63): role (when N-1 did not give it), the job's range, the target,
 * the currency, the competing-offer box, the note. One set of fields, two homes: the card inside Mike's message
 * (`NumbersCard`, ends in "Use these numbers") and the plan's "Change your numbers" dialog (`NumbersDialog`).
 * Errors show on blur and on submit (inline, role="alert"); the button waits until the numbers are valid. */
import { useState, type FormEvent } from "react";
import { Button, Card, Checkbox, Dialog, Icon, Input, Select } from "../../../ds";
import { formatAmountText } from "../../../lib/amount";
import { t } from "../../../i18n";
import type { NegotiateScenario } from "../../../lib/types";
import { currencyOf, DEFAULT_SCENARIO, LEAVE_REASONS, OTHER_CURRENCY, SCENARIO_FIELDS, validateNumbers, type NumbersField, type NumbersValues } from "../numbers";
import s from "./parts.module.css";

const AMOUNTS = ["low", "high", "target", "currentPay", "ask", "newOffer"] as const;
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

interface FieldsProps {
  values: NumbersValues;
  onValues: (v: NumbersValues) => void;
  roleField: boolean;
  fromPost: boolean;
  currencies: string[];
  /** Errors for every field (after a submit attempt); otherwise a field shows its error once it was left. */
  submitted: boolean;
  /** Negotiation v2: which fields the call needs. A start without a scenario is the offer call. */
  scenario?: NegotiateScenario;
}

function NumbersFields({ values, onValues, roleField, fromPost, currencies, submitted, scenario = DEFAULT_SCENARIO }: FieldsProps) {
  const fields = SCENARIO_FIELDS[scenario];
  const has = (f: (typeof fields)[number]) => fields.includes(f);
  const [touched, setTouched] = useState<Partial<Record<NumbersField, boolean>>>({});
  const check = validateNumbers(values, { roleRequired: roleField, scenario });
  const set = (patch: Partial<NumbersValues>) => onValues({ ...values, ...patch });
  const leave = (field: NumbersField) => {
    setTouched((x) => ({ ...x, [field]: true }));
    if ((AMOUNTS as readonly string[]).includes(field)) {
      const key = field as (typeof AMOUNTS)[number];
      const next = formatAmountText(values[key]);
      if (next !== values[key]) set({ [key]: next });
    }
  };
  const shown = (field: NumbersField) => {
    const e = submitted || touched[field] ? check.errors[field] : undefined;
    return e ? t(e.key, e.vars) : undefined;
  };
  const code = currencyOf(values);
  const adorn = code ? <span className={s.adornText}>{code}</span> : undefined;
  const options = [...currencies.map((c) => ({ value: c, label: c })), { value: OTHER_CURRENCY, label: t("home.talk.numbersCard.other") }];

  return (
    <div className={s.numbersGrid}>
      {roleField ? (
        <div className={s.numbersFull}>
          <Input
            label={t("home.talk.numbersCard.role")}
            value={values.role}
            maxLength={80}
            autoComplete="off"
            error={shown("role")}
            onChange={(e) => set({ role: e.target.value })}
            onBlur={() => leave("role")}
          />
        </div>
      ) : null}
      {has("currentPay") ? (
        <Input
          label={t(scenario === "internship" ? "home.talk.numbersCard.internPay" : "home.talk.numbersCard.currentPay")}
          inputMode="decimal"
          autoComplete="off"
          value={values.currentPay}
          adornment={adorn}
          error={shown("currentPay")}
          onChange={(e) => set({ currentPay: e.target.value })}
          onBlur={() => leave("currentPay")}
        />
      ) : null}
      {has("newOffer") ? (
        <Input
          label={t("home.talk.numbersCard.newOffer")}
          inputMode="decimal"
          autoComplete="off"
          value={values.newOffer}
          adornment={adorn}
          error={shown("newOffer")}
          onChange={(e) => set({ newOffer: e.target.value })}
          onBlur={() => leave("newOffer")}
        />
      ) : null}
      {has("ask") ? (
        <Input
          label={t("home.talk.numbersCard.ask")}
          inputMode="decimal"
          autoComplete="off"
          value={values.ask}
          adornment={adorn}
          error={shown("ask")}
          onChange={(e) => set({ ask: e.target.value })}
          onBlur={() => leave("ask")}
        />
      ) : null}
      {has("range") ? (
        <>
          <Input
            label={t("home.talk.numbersCard.from")}
            inputMode="decimal"
            autoComplete="off"
            value={values.low}
            adornment={adorn}
            error={shown("low")}
            onChange={(e) => set({ low: e.target.value })}
            onBlur={() => leave("low")}
          />
          <Input
            label={t("home.talk.numbersCard.to")}
            inputMode="decimal"
            autoComplete="off"
            value={values.high}
            adornment={adorn}
            error={shown("high")}
            onChange={(e) => set({ high: e.target.value })}
            onBlur={() => leave("high")}
          />
          {fromPost ? (
            <p className={`${s.numbersNote} ${s.numbersFull}`}><Icon name="info" size="sm" />{t("numbers.fromPost")}</p>
          ) : null}
        </>
      ) : null}
      {has("target") ? (
        <Input
          label={t(scenario === "internship" ? "home.talk.numbersCard.targetFullTime" : "home.talk.numbersCard.target")}
          inputMode="decimal"
          autoComplete="off"
          value={values.target}
          error={shown("target")}
          onChange={(e) => set({ target: e.target.value })}
          onBlur={() => leave("target")}
        />
      ) : null}
      {has("reason") ? (
        <div className={s.numbersFull}>
          <Select
            label={t("home.talk.numbersCard.reason")}
            options={LEAVE_REASONS.map((r) => ({ value: r, label: t(`home.talk.leaveReason.${r}`) }))}
            placeholder={t("home.talk.numbersCard.reasonPick")}
            value={values.reason}
            track="numbers-reason"
            error={shown("reason")}
            onChange={(v) => set({ reason: v as NumbersValues["reason"] })}
          />
        </div>
      ) : null}
      {has("month") ? (
        <Select
          label={t("home.talk.numbersCard.month")}
          options={[{ value: "none", label: t("home.talk.numbersCard.monthNone") }, ...MONTHS.map((m) => ({ value: m, label: t(`home.talk.month.${m}` as "home.talk.month.1") }))]}
          value={values.month || "none"}
          track="numbers-month"
          onChange={(v) => set({ month: v === "none" ? "" : v })}
        />
      ) : null}
      <Select
        label={t("home.talk.numbersCard.currency")}
        options={options}
        value={values.currency}
        track="numbers-currency"
        onChange={(v) => set({ currency: v })}
      />
      {values.currency === OTHER_CURRENCY ? (
        <Input
          label={t("home.talk.numbersCard.code")}
          value={values.code}
          maxLength={3}
          autoComplete="off"
          error={shown("code")}
          onChange={(e) => set({ code: e.target.value.replace(/[^A-Za-z]/g, "") })}
          onBlur={() => leave("code")}
        />
      ) : null}
      <p className={`${s.perYear} ${s.numbersFull}`}>{t("home.talk.numbersCard.perYear")}</p>
      {check.hint && has("target") ? <p className={`${s.numbersNote} ${s.numbersFull}`}><Icon name="info" size="sm" />{t(check.hint)}</p> : null}
      {has("offer") ? (
        <div className={s.numbersFull}>
          <Checkbox
            label={t("home.talk.numbersCard.realOffer")}
            description={t("home.talk.numbersCard.realOfferHint")}
            checked={values.hasOffer}
            onChange={(e) => set({ hasOffer: e.target.checked })}
          />
        </div>
      ) : null}
      <p className={`${s.numbersNote} ${s.numbersFull}`}><Icon name="info" size="sm" />{t("home.talk.numbersCard.note")}</p>
    </div>
  );
}

export interface NumbersCardProps {
  initial: NumbersValues;
  roleField: boolean;
  fromPost: boolean;
  currencies: string[];
  showErrors?: boolean;
  scenario?: NegotiateScenario;
  onSubmit: (values: NumbersValues) => void;
}

/** Inside Mike's message (N-2). */
export function NumbersCard({ initial, roleField, fromPost, currencies, showErrors, scenario, onSubmit }: NumbersCardProps) {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(Boolean(showErrors));
  const ready = validateNumbers(values, { roleRequired: roleField, scenario }).ok;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (ready) onSubmit(values);
  };
  return (
    <Card padding="md">
      <form className={s.numbersForm} onSubmit={submit} noValidate data-review-id="Home/Setup/Numbers">
        <NumbersFields values={values} onValues={setValues} roleField={roleField} fromPost={fromPost} currencies={currencies} submitted={submitted} scenario={scenario} />
        <div className={s.numbersActions}>
          <Button type="submit" variant="secondary" data-track="numbers-use" aria-disabled={!ready || undefined} disabled={!ready} aria-describedby={ready ? undefined : "neg-card-need"}>
            {t("home.talk.numbersCard.use")}
          </Button>
          {!ready ? <span id="neg-card-need" className={s.actionsNote}>{t("home.talk.numbersCard.need")}</span> : null}
        </div>
      </form>
    </Card>
  );
}

export interface NumbersDialogProps {
  open: boolean;
  values: NumbersValues;
  roleField: boolean;
  fromPost: boolean;
  currencies: string[];
  inline?: boolean;
  scenario?: NegotiateScenario;
  title?: string;
  onValues: (v: NumbersValues) => void;
  onSave: () => void;
  onClose: () => void;
}

/** "Change your numbers" on the plan card. Cancel, Esc and the backdrop keep what was typed as a draft (D108). */
export function NumbersDialog({ open, values, roleField, fromPost, currencies, inline, scenario, title, onValues, onSave, onClose }: NumbersDialogProps) {
  const [submitted, setSubmitted] = useState(false);
  const ready = validateNumbers(values, { roleRequired: roleField, scenario }).ok;
  const save = () => {
    setSubmitted(true);
    if (ready) onSave();
  };
  return (
    <Dialog
      open={open}
      inline={inline}
      title={title ?? t("home.talk.numbersCard.dialogTitle")}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" data-track="numbers-cancel" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" data-track="numbers-save" disabled={!ready} onClick={save}>{t("home.talk.numbersCard.save")}</Button>
        </>
      )}
    >
      <form className={s.numbersForm} onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <NumbersFields values={values} onValues={onValues} roleField={roleField} fromPost={fromPost} currencies={currencies} submitted={submitted} scenario={scenario} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
