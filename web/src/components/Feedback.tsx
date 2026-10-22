/* Feedback for one question thread (owner rule: one panel per thread): content / language / delivery blocks in the
 * configured order, flag actions, and the stronger answer. Used live in the session and read-only-ish in the debrief.
 * All model and user text is rendered as React text nodes (never as HTML). */
import { Fragment, useId, useState, type ReactNode } from "react";
import { Badge, Button, Callout, Icon, InlineMark, Input, Skeleton } from "../ds";
import { t, tMaybe, tp } from "../i18n";
import { formatClock } from "../lib/format";
import type {
  ContentLayer, DeliveryLayer, FeedbackRecord, LanguageItem, LanguageLayer, LayerName, LayerOrder, LowConfWord,
} from "../lib/types";
import { languageCounts, type StrongerState, type Thread } from "../session/reducer";
import s from "./Feedback.module.css";

export type FlagAction = "confirm" | "dismiss" | "restore";

export interface ThreadFeedbackProps {
  thread: Thread;
  mode: "interview" | "english";
  layerOrder: LayerOrder;
  /** Live panel: shows "B1 rule" level labels (QA-13: the level of the rule, not of the user) (owner rule: only in the live panel). */
  live: boolean;
  onFlag?: (feedbackId: string, flagId: string, action: FlagAction) => void;
  onStronger?: (feedbackId: string) => void;
  stronger?: Record<string, StrongerState>;
  headingRef?: React.Ref<HTMLHeadingElement>;
  headingLevel?: 2 | 3;
  /** Show the question text under the heading (default true). The Session shows it on the stage, so it passes false. */
  showQuestion?: boolean;
  /** "Edit what I said" (Session, voice) / "Edit my answer" (text). Shown next to "Show your answer" when given. */
  onEdit?: () => void;
  /** "That's not what I said" / "No, I said…" open a field ("What did you say?"); Save and Skip call back. Without it
   * the flag is just removed. */
  onSaveHeard?: (feedbackId: string, flagId: string, said: string) => void;
  /** Review states: this flag starts with its "What did you say?" field open (the flag must be dismissed). */
  initialOpenHeard?: string;
  /** Review states: the answers start expanded. */
  defaultShowAnswer?: boolean;
  /** Review states: the stronger answer starts open. */
  defaultStrongerOpen?: boolean;
}

export function layerSequence(order: LayerOrder, mode: "interview" | "english"): LayerName[] {
  if (mode === "english") return ["language"];
  return order === "delivery-first" ? ["delivery", "language", "content"] : ["content", "language", "delivery"];
}

const ICON: Record<LayerName, "content" | "language" | "delivery"> = { content: "content", language: "language", delivery: "delivery" };

function isPending(record: FeedbackRecord, layer: LayerName) {
  return !record.layers[layer] && !record.complete;
}

/** The layer could not be made for any answer of the thread (the engine failed, or the record finished without it). */
function layerGone(records: FeedbackRecord[], layer: LayerName) {
  return records.length > 0 && records.every((r) => {
    const data = r.layers[layer];
    return data ? data.status === "unavailable" : r.complete;
  });
}

function fixCount(records: FeedbackRecord[], layer: "content" | "delivery") {
  let fixes = 0;
  let pending = false;
  let any = false;
  for (const r of records) {
    const l = r.layers[layer];
    if (!l) { if (!r.complete) pending = true; continue; }
    if (l.status === "unavailable") continue;
    any = true;
    if (l.status === "fix") fixes++;
  }
  return { fixes, pending, any };
}

function SummaryRow({ records, mode, order, tinted }: { records: FeedbackRecord[]; mode: "interview" | "english"; order: LayerOrder; tinted: boolean }) {
  const items = layerSequence(order, mode).map((layer) => {
    let label: string;
    if (layer === "language") {
      const { counted, toCheck } = languageCounts(records);
      const pending = records.some((r) => isPending(r, "language"));
      label = pending && !counted ? t("feedback.count.pending")
        : counted ? tp("feedback.count.phrasings", counted) : layerGone(records, "language") ? t("feedback.count.na") : t("feedback.count.good");
      if (toCheck) label += ` ${t("feedback.count.toCheck", { n: toCheck })}`;
    } else {
      const c = fixCount(records, layer);
      label = c.fixes ? tp("feedback.count.fix", c.fixes) : c.pending ? t("feedback.count.pending") : c.any ? t("feedback.count.good") : t("feedback.count.na");
    }
    return (
      <li key={layer}>
        <Badge tone={layer} icon={ICON[layer]} tinted={tinted}>{t(`feedback.layer.${layer}`)} · {label}</Badge>
      </li>
    );
  });
  return <ul className={s.summary} aria-label={t("feedback.summary")}>{items}</ul>;
}

/** The user's answer with low-confidence words underlined (when the recogniser gave word confidence). */
function AnswerText({ text, low }: { text: string; low?: LowConfWord[] }) {
  if (!low?.length) return <p>{text}</p>;
  const lowSet = new Set(low.map((w) => w.w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "")));
  const parts = text.split(/(\s+)/);
  return (
    <p>
      {parts.map((part, i) => {
        const bare = part.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
        return bare && lowSet.has(bare) ? <span key={i} className={s.lowConf} title={t("feedback.language.mayBeMisheard")}>{part}</span> : part;
      })}
    </p>
  );
}

function answerLabel(r: FeedbackRecord) {
  if (r.answer_kind === "follow_up") return t("feedback.followUpAnswer");
  if (r.answer_kind === "turn") return t("feedback.turnAnswer");
  return t("feedback.mainAnswer");
}

/* ---------- word diff for the Heard as / Say pair (G20 InlineMark) ---------- */

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

interface Marked { text: string; mark: boolean }

/** Compare the heard words with the corrected ones (longest common subsequence of words). The words that differ are
 * marked on both sides; when a word was only removed or only added, the word next to it carries the mark. */
export function diffMarks(heard: string, say: string): { heard: Marked[]; say: Marked[] } {
  const a = heard.split(/\s+/).filter(Boolean);
  const b = say.split(/\s+/).filter(Boolean);
  const ka = a.map(bare);
  const kb = b.map(bare);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = ka[i] === kb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const markA = a.map(() => false);
  const markB = b.map(() => false);
  let i = 0;
  let j = 0;
  const gaps: [number, number, number, number][] = [];
  let gi = 0;
  let gj = 0;
  while (i < a.length && j < b.length) {
    if (ka[i] === kb[j]) {
      if (i > gi || j > gj) gaps.push([gi, i, gj, j]);
      i++; j++; gi = i; gj = j;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  if (a.length > gi || b.length > gj) gaps.push([gi, a.length, gj, b.length]);
  for (const [a0, a1, b0, b1] of gaps) {
    for (let k = a0; k < a1; k++) markA[k] = true;
    for (let k = b0; k < b1; k++) markB[k] = true;
    if (a1 === a0 && a.length) markA[Math.min(a0, a.length - 1)] = true; // only added: mark the neighbour in what was heard
    if (b1 === b0 && b.length) markB[Math.min(b0, b.length - 1)] = true; // only removed: mark the neighbour in the fix
  }
  const merge = (words: string[], marks: boolean[]): Marked[] => {
    const out: Marked[] = [];
    words.forEach((w, k) => {
      const last = out[out.length - 1];
      if (last && last.mark === marks[k]) last.text += ` ${w}`;
      else out.push({ text: w, mark: marks[k]! });
    });
    return out;
  };
  return { heard: merge(a, markA), say: merge(b, markB) };
}

function Marks({ parts, kind, srLabel }: { parts: Marked[]; kind: "fix" | "heard" | "unsure"; srLabel: string }) {
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i ? " " : ""}
          {p.mark ? <InlineMark kind={kind} srLabel={srLabel}>{p.text}</InlineMark> : p.text}
        </Fragment>
      ))}
    </>
  );
}

/** STAR row (live panel): the four parts of the answer; the ones the engine says are missing read "Result: missing". */
const STAR = ["situation", "task", "action", "result"] as const;
function starMissing(missing: string[] | undefined): Set<(typeof STAR)[number]> {
  const out = new Set<(typeof STAR)[number]>();
  for (const m of missing ?? []) {
    if (m === "no_result" || m === "vague_result") out.add("result");
    else if (m === "no_star_action") out.add("action");
  }
  return out;
}

export function ThreadFeedback({
  thread, mode, layerOrder, live, onFlag, onStronger, stronger, headingRef, headingLevel = 2,
  showQuestion = true, onEdit, onSaveHeard, initialOpenHeard, defaultShowAnswer, defaultStrongerOpen,
}: ThreadFeedbackProps) {
  const [showAnswer, setShowAnswer] = useState(Boolean(defaultShowAnswer));
  const answersId = useId();
  const H = headingLevel === 2 ? "h2" : "h3";
  const records = thread.records;
  const followUps = records.filter((r) => r.answer_kind === "follow_up").length;
  const voiced = records.some((r) => r.source === "voice");
  const title = mode === "english" ? t("feedback.turn", { n: thread.number }) : t("feedback.question", { n: thread.number || "" });

  if (!records.length) {
    return (
      <div className={`${s.thread} ${live ? s.live : ""}`}>
        <div className={s.head}>
          <H className={s.headTitle} ref={headingRef} tabIndex={-1}>{title}</H>
          {showQuestion && thread.question ? <p className={s.question}>{thread.question}</p> : null}
        </div>
        {thread.pendingIds.length ? (
          /* Feedback on its way (3.5): the waiting line shimmers over a ghost of the card. */
          <>
            <p className={s.pending} role="status">
              <span className="shimmer-text">{mode === "english" ? t("feedback.p2English") : t("feedback.p2", { n: thread.number })}</span>
            </p>
            <Skeleton variant="card" />
          </>
        ) : (
          <Callout tone="info">{t("feedback.p4")}</Callout>
        )}
      </div>
    );
  }

  const sub = mode === "english" ? "" : followUps === 0 ? tp("feedback.answers", 1) : followUps === 1 ? t("feedback.answersOneFollowUp") : tp("feedback.answers", followUps);
  const main = records.find((r) => r.answer_kind === "main") ?? records[0]!;

  return (
    <div className={`${s.thread} ${live ? s.live : ""}`}>
      <div className={s.head}>
        <H className={s.headTitle} ref={headingRef} tabIndex={-1}>{title}{sub ? <span className={s.headSub}> · {sub}</span> : null}</H>
        {showQuestion && thread.question ? <p className={s.question}>{thread.question}</p> : null}
      </div>
      <SummaryRow records={records} mode={mode} order={layerOrder} tinted={!live} />
      <div className={s.answerRow}>
        <Button variant="link" size="sm" icon="eye" className={s.answerToggle} data-track="feedback-show-answer" aria-expanded={showAnswer} aria-controls={answersId} onClick={() => setShowAnswer(!showAnswer)}>
          {showAnswer ? t("feedback.hideAnswer") : voiced ? t("feedback.showAnswer") : t("feedback.showTyped")}
        </Button>
        {onEdit ? (
          <Button variant="link" size="sm" icon="edit" data-track="edit-what-i-said" onClick={onEdit}>{voiced ? t("feedback.edit") : t("feedback.editTyped")}</Button>
        ) : null}
      </div>
      {showAnswer ? (
        <div id={answersId} className={`${s.answers} motion-rise-base`}>
          {records.map((r) => (
            <div key={r.id}>
              <div className={s.answerLabel}>{answerLabel(r)}</div>
              <AnswerText text={r.answer} low={r.heard_as_words} />
            </div>
          ))}
        </div>
      ) : null}
      {layerSequence(layerOrder, mode).map((layer) => (
        <LayerBlock key={layer} layer={layer} records={records} live={live} onFlag={onFlag} onSaveHeard={onSaveHeard} initialOpenHeard={initialOpenHeard} />
      ))}
      {thread.unavailable.length ? <Callout tone="info">{t("feedback.p4")}</Callout> : null}
      {mode === "interview" && onStronger && main.complete ? (
        <Stronger record={main} state={stronger?.[main.id]} onRequest={() => onStronger(main.id)} defaultOpen={defaultStrongerOpen} />
      ) : null}
    </div>
  );
}

/** Does this record add anything to the layer? A follow-up with nothing to fix stays out of the live panel's way. */
function hasContent(layer: LayerName, r: FeedbackRecord): boolean {
  const data = r.layers[layer];
  if (!data) return !r.complete;
  if (data.status === "unavailable") return false;
  if (layer === "content") {
    const c = data as ContentLayer;
    return c.status === "fix" || Boolean(c.missing?.length || c.tips?.length || c.praise || c.evidence);
  }
  if (layer === "delivery") {
    const d = data as DeliveryLayer;
    return d.status === "fix" || Boolean(d.metrics && (d.metrics.words || d.metrics.fillers != null || d.metrics.wpm));
  }
  return Boolean((data as LanguageLayer).items?.length || (data as LanguageLayer).phrase_to_keep?.phrase);
}

interface FlagHandlers {
  onFlag?: ThreadFeedbackProps["onFlag"];
  onSaveHeard?: ThreadFeedbackProps["onSaveHeard"];
  initialOpenHeard?: string;
}

function LayerBlock({ layer, records, live, onFlag, onSaveHeard, initialOpenHeard }: { layer: LayerName; records: FeedbackRecord[]; live: boolean } & FlagHandlers) {
  // Live panel: only records that add something are listed; the rest is one "nothing to fix" line.
  const shown = live ? records.filter((r) => hasContent(layer, r)) : records;
  const multi = shown.length > 1;
  let count: ReactNode = null;
  if (layer === "language") {
    const { counted, toCheck } = languageCounts(records);
    count = counted || toCheck
      ? `${counted ? tp("feedback.count.phrasings", counted) : ""}${toCheck ? ` ${t("feedback.count.toCheck", { n: toCheck })}` : ""}`.trim()
      : null;
  } else {
    const c = fixCount(records, layer);
    count = c.fixes ? tp("feedback.count.fix", c.fixes) : null;
  }
  const gone = layerGone(records, layer);
  const empty = live && !shown.length && !gone;
  return (
    <section className={`${s.block} ${s[layer]}`} aria-label={t(`feedback.layer.${layer}`)} data-review-id={`Feedback/${layer}`}>
      <div className={s.blockHead}>
        <h4 className={s.blockTitle}><Icon name={ICON[layer]} size="sm" />{t(`feedback.layer.${layer}`)}{count ? ` · ${count}` : ""}</h4>
      </div>
      {live && gone ? <p className={s.ok}>{t("feedback.layerUnavailable")}</p> : null}
      {empty ? <p className={s.ok}>{layer === "delivery" ? t("feedback.delivery.nothing") : t("feedback.content.nothing")}</p> : null}
      {(live ? shown : records).map((r) => (
        <div key={r.id} className={s.sub}>
          {multi ? <span className={s.subLabel}>{answerLabel(r)}</span> : null}
          <LayerBody layer={layer} record={r} live={live} onFlag={onFlag} onSaveHeard={onSaveHeard} initialOpenHeard={initialOpenHeard} />
        </div>
      ))}
    </section>
  );
}

function LayerBody({ layer, record, live, onFlag, onSaveHeard, initialOpenHeard }: { layer: LayerName; record: FeedbackRecord; live: boolean } & FlagHandlers) {
  const data = record.layers[layer];
  if (!data) {
    return record.complete ? <p className={s.ok}>{t("feedback.layerUnavailable")}</p> : <Skeleton lines={2} label={t("feedback.stillChecking")} />;
  }
  if (data.status === "unavailable") return <p className={s.ok}>{t("feedback.layerUnavailable")}</p>;
  if (layer === "content") return <ContentBody data={data as ContentLayer} live={live} showStar={record.answer_kind !== "follow_up"} />;
  if (layer === "delivery") return <DeliveryBody data={data as DeliveryLayer} live={live} />;
  return <LanguageBody data={data as LanguageLayer} record={record} live={live} onFlag={onFlag} onSaveHeard={onSaveHeard} initialOpenHeard={initialOpenHeard} />;
}

function ContentBody({ data, live, showStar }: { data: ContentLayer; live: boolean; showStar: boolean }) {
  const star = live && showStar && data.status === "fix";
  const missingStar = starMissing(data.missing);
  const otherMissing = (data.missing ?? []).filter((m) => m !== "no_result" && m !== "vague_result" && m !== "no_star_action");
  const chips = star ? otherMissing : (data.missing ?? []);
  return (
    <>
      {data.status === "fix" && data.fix ? <p className={s.fix}>{data.fix}</p> : <p className={s.ok}>{t("feedback.content.nothing")}</p>}
      {star ? (
        <ul className={s.star} aria-label={t("feedback.star.label")}>
          {STAR.map((part) => {
            const miss = missingStar.has(part);
            const name = t(`feedback.star.${part}`);
            return (
              <li key={part}>
                <Badge tone="outline" icon={miss ? undefined : "check"}>{miss ? t("feedback.star.missing", { name }) : name}</Badge>
              </li>
            );
          })}
        </ul>
      ) : null}
      {chips.length ? (
        <div className={s.chips}>
          <span className={s.subLabel}>{t("feedback.content.missing")}</span>
          {chips.map((m) => <Badge key={m} tone="outline">{tMaybe(`feedback.missing.${m}`, m.replace(/_/g, " "))}</Badge>)}
        </div>
      ) : null}
      {data.evidence ? <p className={s.quote}>“{data.evidence}”</p> : null}
      {data.praise ? (
        <div className={s.sub}>
          <span className={s.subLabel}>{t("feedback.content.praise")}</span>
          <p className={s.quote}>“{data.praise}”</p>
        </div>
      ) : null}
      {data.tips?.length ? (
        <div className={s.sub}>
          {live ? null : <span className={s.subLabel}>{t("feedback.content.tips")}</span>}
          <ul className={s.list}>{data.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      ) : null}
    </>
  );
}

/** Pace bands for interview English, words per minute (🟡 provisional, from the session wireframe). */
export function paceVerdict(wpm: number): "slow" | "comfortable" | "fast" {
  if (wpm < 110) return "slow";
  if (wpm > 160) return "fast";
  return "comfortable";
}

function DeliveryBody({ data, live }: { data: DeliveryLayer; live: boolean }) {
  const m = data.metrics ?? {};
  const words = tp("common.words", m.words ?? 0);
  const textMode = m.mode === "text";
  if (live) {
    /* Live panel: a muted block, three columns (label above, value below), no "·" strings (invariant 7). */
    return (
      <>
        <dl className={`${s.metricsGrid} ${textMode ? s.metricsOne : ""}`}>
          {textMode ? (
            <div><dt>{t("feedback.delivery.lengthLabel")}</dt><dd>{words}</dd></div>
          ) : (
            <>
              {m.fillers != null ? <div><dt>{t("feedback.delivery.fillersLabel")}</dt><dd>{m.fillers}</dd></div> : null}
              {m.seconds != null ? <div><dt>{t("feedback.delivery.lengthLabel")}</dt><dd>{t("feedback.delivery.lengthValue", { time: formatClock(m.seconds), words })}</dd></div> : null}
              {m.wpm ? <div><dt>{t("feedback.delivery.paceLabel")}</dt><dd>{t("feedback.delivery.paceValue", { wpm: m.wpm, verdict: t(`feedback.delivery.${paceVerdict(m.wpm)}`) })}</dd></div> : null}
            </>
          )}
        </dl>
        {data.status === "fix" && data.fix ? <p className={s.fixSm}>{data.fix}</p> : null}
        {textMode ? <p className={s.note}>{t("feedback.delivery.textMode")}</p> : null}
        {!textMode && m.fillers_note ? <p className={s.note}>{m.fillers_note}</p> : null}
      </>
    );
  }
  return (
    <>
      <ul className={s.metrics}>
        {textMode ? <li>{t("feedback.delivery.lengthText", { words })}</li> : (
          <>
            {m.fillers != null ? <li>{t("feedback.delivery.fillers", { n: m.fillers })}</li> : null}
            {m.seconds != null ? <li>{t("feedback.delivery.length", { time: formatClock(m.seconds), words })}</li> : null}
            {m.wpm ? <li>{t("feedback.delivery.pace", { wpm: m.wpm, verdict: t(`feedback.delivery.${paceVerdict(m.wpm)}`) })}</li> : null}
            {m.long_pauses ? <li>{t("feedback.delivery.pauses", { n: m.long_pauses })}</li> : null}
          </>
        )}
      </ul>
      {data.status === "fix" && data.fix ? <p className={s.fix}>{data.fix}</p> : null}
      {textMode ? <p className={s.note}>{t("feedback.delivery.textMode")}</p> : null}
      {!textMode && m.fillers_note ? <p className={s.note}>{m.fillers_note}</p> : null}
    </>
  );
}

const MAX_ITEMS = 3;

/** One corrected phrasing: "Heard as" / "Say" / "Why" with the differing words marked inside the sentences. */
function FlagGrid({ item, voiced, check }: { item: LanguageItem; voiced: boolean; check?: boolean }) {
  const heard = item.heard_as || item.original;
  const best = item.better[0] ?? "";
  const diff = diffMarks(heard, best);
  const rest = item.better.slice(1);
  return (
    <dl className={s.grid}>
      <dt>{voiced ? t("feedback.language.heardAs") : t("feedback.language.youTyped")}</dt>
      <dd>
        “<Marks parts={diff.heard} kind={check ? "unsure" : "heard"} srLabel={check ? t("feedback.language.mayBeMisheard") : t("feedback.language.heardAs")} />”
        {check ? <> <span className={s.note}>{t("feedback.language.mayBeMisheard")}</span></> : null}
      </dd>
      <dt>{t("feedback.language.say")}</dt>
      <dd>
        “<Marks parts={diff.say} kind="fix" srLabel={t("feedback.language.say")} />”
        {rest.map((b) => <span key={b}> · “{b}”</span>)}
      </dd>
      {!check && item.reason ? (<><dt>{t("feedback.language.why")}</dt><dd>{item.reason}</dd></>) : null}
    </dl>
  );
}

function LanguageBody({ data, record, live, onFlag, onSaveHeard, initialOpenHeard }: { data: LanguageLayer; record: FeedbackRecord; live: boolean } & FlagHandlers) {
  /* "open" = the removed flag shows its "What did you say?" field; "misheard" = removed as "not what I said". */
  const [misheard, setMisheard] = useState<Record<string, "open" | "done">>(initialOpenHeard ? { [initialOpenHeard]: "open" } : {});
  const [said, setSaid] = useState<Record<string, string>>({});
  const voiced = record.source === "voice";
  const items = data.items ?? [];
  const visible = items.filter((i) => i.status !== "dismissed");
  // A check decides what counts, so it is never the item that collapses (wireframe rule).
  const ordered = [...visible.filter((i) => i.status === "unconfirmed"), ...visible.filter((i) => i.status !== "unconfirmed")];
  const shown = ordered.slice(0, Math.max(MAX_ITEMS, ordered.filter((i) => i.status === "unconfirmed").length));
  const hidden = ordered.length - shown.length;
  const dismissed = items.filter((i) => i.status === "dismissed");
  const act = (item: LanguageItem, action: FlagAction, asMisheard = false) => {
    if (asMisheard) setMisheard((m) => ({ ...m, [item.id]: onSaveHeard ? "open" : "done" }));
    if (action === "restore") setMisheard((m) => { const next = { ...m }; delete next[item.id]; return next; });
    onFlag?.(record.id, item.id, action);
  };
  const closeField = (item: LanguageItem, save: boolean) => {
    if (save) onSaveHeard?.(record.id, item.id, said[item.id] ?? item.heard_as ?? item.original);
    setMisheard((m) => ({ ...m, [item.id]: "done" }));
  };
  return (
    <>
      {voiced && items.length ? <p className={s.note}>{t("feedback.language.misheard")}</p> : null}
      {!items.length || (!visible.length && !dismissed.length) ? <p className={s.ok}>{t("feedback.language.nothing")}</p> : null}
      {shown.map((item) => (
        item.status === "unconfirmed" ? (
          <div key={item.id} className={`${s.item} ${s.check}`}>
            <span className={s.checkTitle}>{t("feedback.language.checkTitle")}</span>
            <FlagGrid item={item} voiced={voiced} check />
            {onFlag ? (
              <div className={s.itemFoot}>
                <span className={s.subLabel}>{t("feedback.language.didYouSay")}</span>
                <div className={s.itemActions}>
                  <Button size="sm" data-track="misheard-yes-said" onClick={() => act(item, "confirm")}>{t("feedback.language.yesSaid")}</Button>
                  <Button size="sm" variant="ghost" data-track="not-what-i-said" onClick={() => act(item, "dismiss", true)}>{t("feedback.language.noSaid")}</Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div key={item.id} className={s.item}>
            <FlagGrid item={item} voiced={voiced} />
            <div className={s.itemFoot}>
              {live && item.level ? <Badge tone="neutral" title={t("feedback.language.grammarLevelHint")}>{t("feedback.language.grammarLevel", { level: item.level })}<span className="visually-hidden"> ({t("feedback.language.grammarLevelHint")})</span></Badge> : <span />}
              {item.status === "confirmed" ? <span className={s.note}>{t("feedback.language.confirmed")}</span> : null}
            </div>
            {onFlag && item.status === "active" ? (
              <div className={s.itemActions}>
                <Button size="sm" variant="ghost" data-track="flag-said-right" onClick={() => act(item, "dismiss")}>{t(voiced ? "feedback.language.saidRight" : "feedback.language.typedRight")}</Button>
                <Button size="sm" variant="ghost" data-track="flag-name-or-term" onClick={() => act(item, "dismiss")}>{t("feedback.language.nameOrTerm")}</Button>
                {voiced ? <Button size="sm" variant="ghost" data-track="not-what-i-said" onClick={() => act(item, "dismiss", true)}>{t("feedback.language.notWhatISaid")}</Button> : null}
              </div>
            ) : null}
          </div>
        )
      ))}
      {hidden > 0 ? <p className={s.note}>{tp("feedback.language.more", hidden)}</p> : null}
      {dismissed.map((item) => (
        misheard[item.id] === "open" ? (
          <div key={item.id} className={`${s.item} ${s.saidField} motion-rise-base`}>
            <p className={s.checkTitle}>{t("feedback.language.heardOpenTitle")}</p>
            <Input
              label={t("feedback.language.whatDidYouSay")}
              value={said[item.id] ?? item.heard_as ?? item.original}
              onChange={(e) => setSaid((v) => ({ ...v, [item.id]: e.target.value }))}
              autoFocus={!initialOpenHeard}
            />
            <div className={s.itemActions}>
              <Button size="sm" data-track="recheck-heard" onClick={() => closeField(item, true)}>{t("feedback.language.saveHeard")}</Button>
              <Button size="sm" variant="ghost" data-track="heard-skip" onClick={() => closeField(item, false)}>{t("feedback.language.skip")}</Button>
            </div>
          </div>
        ) : (
          <div key={item.id} className={s.removed}>
            <span>{misheard[item.id] ? t("feedback.language.removedMisheard", { text: item.heard_as || item.original }) : t("feedback.language.removed")}</span>
            {onFlag ? <Button size="sm" variant="link" data-track="flag-undo" onClick={() => act(item, "restore")}>{t("common.undo")}</Button> : null}
          </div>
        )
      ))}
      {data.phrase_to_keep?.phrase ? (
        <div className={s.sub}>
          <span className={s.subLabel}>{t("feedback.language.phraseToKeep")}</span>
          <p className={s.fix}>“{data.phrase_to_keep.phrase}”</p>
          {data.phrase_to_keep.why ? <p className={s.note}>{data.phrase_to_keep.why}</p> : null}
        </div>
      ) : null}
    </>
  );
}

/** Highlight [placeholders] in the rewrite as text spans (no HTML parsing). */
function Rewrite({ text, placeholders }: { text: string; placeholders: string[] }) {
  if (!placeholders.length) return <p className={s.rewrite}>{text}</p>;
  const escaped = placeholders.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return (
    <p className={s.rewrite}>
      {parts.map((part, i) => (placeholders.includes(part) ? <mark key={i} className={s.placeholder}>{part}</mark> : part))}
    </p>
  );
}

function Stronger({ record, state, onRequest, defaultOpen }: { record: FeedbackRecord; state?: StrongerState; onRequest: () => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const ready = state?.status === "ready" ? state : record.stronger ? { status: "ready" as const, ...record.stronger } : undefined;
  const toggle = () => {
    if (!open && !ready && state?.status !== "loading") onRequest();
    setOpen(!open);
  };
  return (
    <div className={s.stronger}>
      {/* A disclosure, not an "AI" button: a chevron that turns (session.md §2.7), no sparkle. */}
      <Button variant="secondary" size="sm" iconRight="chevronDown" data-track="show-sample-answer" className={s.strongerBtn} aria-expanded={open} onClick={toggle}>
        {open ? t("feedback.stronger.hide") : t("feedback.stronger.show")}
      </Button>
      {open ? (
        state?.status === "loading" && !ready ? <Skeleton lines={3} label={t("feedback.stronger.loading")} /> :
        ready?.rewrite ? (
          <>
            <Rewrite text={ready.rewrite} placeholders={ready.placeholders ?? []} />
            {ready.placeholders?.length ? <p className={s.note}>{t("feedback.stronger.placeholders")}</p> : null}
          </>
        ) : state?.status === "unavailable" ? <p className={s.ok}>{state.message || t("feedback.stronger.unavailable")}</p> : null
      ) : null}
    </div>
  );
}
