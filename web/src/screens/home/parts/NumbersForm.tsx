/* The negotiate numbers form (tough-talk.md §2.4, US-63): role (when N-1 did not give it), the job's range, the target,
 * the currency, the competing-offer box, the note. One set of fields, two homes: the card inside Mike's message
 * (`NumbersCard`, ends in "Use these numbers") and the plan's "Change your numbers" dialog (`NumbersDialog`).
 * Errors show on blur and on submit (inline, role="alert"); the button waits until the numbers are valid. */
import { useState, type FormEvent } from "react";
import { Button, Card, Checkbox, Dialog, Icon, Input, Select } from "../../../ds";
import { formatAmountText } from "../../../lib/amount";
import { t } from "../../../i18n";
import { currencyOf, OTHER_CURRENCY, validateNumbers, type NumbersField, type NumbersValues } from "../numbers";
import s from "./parts.module.css";

const AMOUNTS = ["low", "high", "target"] as const;

interface FieldsProps {
  values: NumbersValues;
  onValues: (v: NumbersValues) => void;
  roleField: boolean;
  fromPost: boolean;
  currencies: string[];
  /** Errors for every field (after a submit attempt); otherwise a field shows its error once it was left. */
  submitted: boolean;
}

function NumbersFields({ values, onValues, roleField, fromPost, currencies, submitted }: FieldsProps) {
  const [touched, setTouched] = useState<Partial<Record<NumbersField, boolean>>>({});
  const check = validateNumbers(values, { roleRequired: roleField });
  const set = (patch: Partial<NumbersValues>) => onValues({ ...values, ...patch });
  const leave = (field: NumbersField) => {
    setTouched((x) => ({ ...x, [field]: true }));
    if ((AMOUNTS as readonly string[]).includes(field)) {
      const key = field as "low" | "high" | "target";
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
      <Input
        label={t("home.talk.numbersCard.target")}
        inputMode="decimal"
        autoComplete="off"
        value={values.target}
        error={shown("target")}
        onChange={(e) => set({ target: e.target.value })}
        onBlur={() => leave("target")}
      />
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
      {check.hint ? <p className={`${s.numbersNote} ${s.numbersFull}`}><Icon name="info" size="sm" />{t(check.hint)}</p> : null}
      <div className={s.numbersFull}>
        <Checkbox
          label={t("home.talk.numbersCard.realOffer")}
          description={t("home.talk.numbersCard.realOfferHint")}
          checked={values.hasOffer}
          onChange={(e) => set({ hasOffer: e.target.checked })}
        />
      </div>
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
  onSubmit: (values: NumbersValues) => void;
}

/** Inside Mike's message (N-2). */
export function NumbersCard({ initial, roleField, fromPost, currencies, showErrors, onSubmit }: NumbersCardProps) {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(Boolean(showErrors));
  const ready = validateNumbers(values, { roleRequired: roleField }).ok;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (ready) onSubmit(values);
  };
  return (
    <Card tone="subtle" padding="md">
      <form className={s.numbersForm} onSubmit={submit} noValidate data-review-id="Home/Setup/Numbers">
        <NumbersFields values={values} onValues={setValues} roleField={roleField} fromPost={fromPost} currencies={currencies} submitted={submitted} />
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
  onValues: (v: NumbersValues) => void;
  onSave: () => void;
  onClose: () => void;
}

/** "Change your numbers" on the plan card. Cancel, Esc and the backdrop keep what was typed as a draft (D108). */
export function NumbersDialog({ open, values, roleField, fromPost, currencies, inline, onValues, onSave, onClose }: NumbersDialogProps) {
  const [submitted, setSubmitted] = useState(false);
  const ready = validateNumbers(values, { roleRequired: roleField }).ok;
  const save = () => {
    setSubmitted(true);
    if (ready) onSave();
  };
  return (
    <Dialog
      open={open}
      inline={inline}
      title={t("home.talk.numbersCard.dialogTitle")}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" data-track="numbers-cancel" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" data-track="numbers-save" disabled={!ready} onClick={save}>{t("home.talk.numbersCard.save")}</Button>
        </>
      )}
    >
      <form className={s.numbersForm} onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <NumbersFields values={values} onValues={onValues} roleField={roleField} fromPost={fromPost} currencies={currencies} submitted={submitted} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
