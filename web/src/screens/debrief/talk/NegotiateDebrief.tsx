/* Negotiate salary debrief (ds/screens/tough-talk.md §5): Your result · What moved the offer · Say it better.
 * Practice numbers, not market data. The deal line and its "in the offer letter" mark come from the server; levers are
 * shown beside the base figure and never added to it. The frames with nothing to say are left out. */
import { Badge, Button, Callout, Icon, TacticCard, Tooltip } from "../../../ds";
import { t } from "../../../i18n";
import type { NegotiateDebrief as Debrief } from "../../../lib/types";
import { Frame } from "../parts/Frame";
import type { ToughTalkDebriefProps } from "../types";
import {
  conversationTurns, hintsLine, homeworkModel, movesEmpty, negotiateMeta, negotiateMoves, negotiateResult, negotiateTitle, objectionRows, type NegotiateResult, type TalkContent,
} from "./model";
import { TalkPage } from "./TalkPage";
import s from "./talk.module.css";

function Figure({ value, label, tip }: { value: string; label: string; tip?: string }) {
  const caption = tip ? (
    <Tooltip content={tip} placement="bottom-start"><span className={s.figureLabel} tabIndex={0}>{label}</span></Tooltip>
  ) : <span className={s.figureLabel}>{label}</span>;
  return <li className={s.figure}><span className={s.figureValue}>{value}</span>{caption}</li>;
}

function ResultFrame({ d, r, id = "neg-result", title, review = "Debrief/Negotiate/Result" }: { d: Debrief; r: NegotiateResult; id?: string; title?: string; review?: string }) {
  const noOffer = r.edge === "noOffer";
  // Screening and the counteroffer have no figure for "room captured"; they show how the call went instead.
  const bare = noOffer || r.edge === "screening" || r.edge === "counter";
  return (
    <Frame id={id} title={title ?? t("debrief.negotiate.result.title")} data-review-id={review} data-review-section="Debrief · Your result" data-comment-target="">
      <p className={s.headline}>{r.headline}</p>
      {r.dealLine ? (
        <p className={s.dealLine} data-testid="deal-line">
          <span>{r.dealLine}</span>
          {r.inWriting === undefined ? null : r.inWriting ? (
            <span className={s.writing}><Icon name="check" size="sm" />{r.writingLabel}</span>
          ) : (
            <span className={`${s.writing} ${s.writingNo}`}><Icon name="x" size="sm" />{t("debrief.negotiate.result.notInWriting")}</span>
          )}
        </p>
      ) : null}
      {r.note ? <p className={s.quiet}>{r.note}</p> : null}
      {r.compare ? (
        <dl className={s.rows} aria-label={t("debrief.negotiate.counter.title")} data-testid="counter-compare">
          {r.compare.map((row) => (<div key={row.id} className={s.row}><dt>{row.label}</dt><dd>{row.value}</dd></div>))}
        </dl>
      ) : null}
      {bare ? null : (
        <ul className={s.figures} aria-label={t("debrief.negotiate.result.captured")}>
          <Figure value={r.now} label={t("debrief.negotiate.result.captured")} tip={t("debrief.negotiate.result.figureTip")} />
          {r.later ? <Figure value={r.later.value} label={t("debrief.negotiate.result.capturedLater", { months: r.later.months })} /> : null}
        </ul>
      )}
      {r.yearOne ? <p className={s.quiet}>{r.yearOne}</p> : null}
      {bare ? null : (
        <dl className={s.rows}>
          {r.rows.map((row) => (<div key={row.id} className={s.row}><dt>{row.label}</dt><dd>{row.value}</dd></div>))}
        </dl>
      )}
      {r.facts.length ? (
        <div>
          <h3 className={s.sub}>{t("debrief.negotiate.facts.title")}</h3>
          <dl className={s.rows} data-testid="scenario-facts">
            {r.facts.map((row) => (<div key={row.id} className={s.row}><dt>{row.label}</dt><dd>{row.value}</dd></div>))}
          </dl>
        </div>
      ) : null}
      {bare ? null : (
        <div>
          <h3 className={s.sub}>{t("debrief.negotiate.result.levers")}</h3>
          {r.levers.length ? (
            <ul className={s.chips}>{r.levers.map((l) => <li key={l}><Badge>{l}</Badge></li>)}</ul>
          ) : <p className={s.quiet}>{t("debrief.negotiate.result.noLevers")}</p>}
        </div>
      )}
      <p className={s.quiet}>{d.practice_note || t("debrief.talk.footer")}</p>
    </Frame>
  );
}

/** Negotiation v2: the objections Mike raised, and whether your next line answered each (code-judged: may be wrong). */
function ObjectionsFrame({ d, id = "neg-objections" }: { d: Debrief; id?: string }) {
  const rows = objectionRows(d);
  const answered = rows.filter((x) => x.answered).length;
  return (
    <Frame id={id} title={t("debrief.negotiate.objections.title")} data-review-id="Debrief/Negotiate/Objections" data-review-section="Debrief · Objections" data-comment-target="">
      <p className={s.quiet}>{t("debrief.negotiate.objections.summary", { answered, total: rows.length })}</p>
      <ol className={s.list}>
        {rows.map((row) => (
          <li key={row.id} className={s.item}>
            <div className={s.itemHead}>
              <span className={s.itemMeta}>{t("debrief.negotiate.moves.turn", { n: row.turn })}</span>
              <Badge tone={row.answered ? "success" : "neutral"}>{row.answered ? t("debrief.negotiate.objections.answered") : t("debrief.negotiate.objections.notAnswered")}</Badge>
              {row.mayBeWrong ? (
                <Tooltip content={t("debrief.negotiate.objections.mayBeWrongTip")} placement="bottom-start"><span tabIndex={0}><Badge tone="outline">{t("debrief.negotiate.objections.mayBeWrong")}</Badge></span></Tooltip>
              ) : null}
            </div>
            <p className={s.said}><span className={s.label}>{t("debrief.negotiate.objections.mike")} </span>{"“"}{row.mike}{"”"}</p>
            <p className={s.said}><span className={s.label}>{t("debrief.negotiate.objections.you")} </span>{row.reply ? <>{"“"}{row.reply}{"”"}</> : t("debrief.negotiate.objections.silent")}</p>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

function MovesFrame({ d }: { d: Debrief }) {
  const m = negotiateMoves(d);
  return (
    <Frame id="neg-moves" title={t("debrief.negotiate.moves.title")} data-review-id="Debrief/Negotiate/Moves" data-review-section="Debrief · What moved the offer" data-comment-target="">
      {m.rows.length ? (
        <ol className={s.list}>
          {m.rows.map((row) => (
            <li key={row.id} className={s.item}>
              <div className={s.itemHead}>
                <span className={s.itemMeta}>{t("debrief.negotiate.moves.turn", { n: row.turn })}</span>
                <span className={s.itemTitle}>{row.amounts}</span>
                <Badge>{row.cause}</Badge>
              </div>
              {row.sub ? <p className={s.quiet}>{row.sub}</p> : null}
              {row.quote ? <p className={s.said}>{"“"}{row.quote}{"”"}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {m.below ? <p className={s.note}><Icon name="alert" size="sm" />{m.below}</p> : null}
      {m.pressure.map((x) => <p key={x} className={s.note}><Icon name="clock" size="sm" />{x}</p>)}
      {m.notes.map((x) => <p key={x} className={s.note}><Icon name="clock" size="sm" />{x}</p>)}
      {m.offerIgnored ? <Callout tone="info">{t("debrief.negotiate.moves.offerIgnored")}</Callout> : null}
      {m.unasked.length ? (
        <div>
          <h3 className={s.sub}>{t("debrief.negotiate.moves.unasked")}</h3>
          <ul className={s.chips}>{m.unasked.map((x) => <li key={x}><Badge tone="neutral">{x}</Badge></li>)}</ul>
        </div>
      ) : null}
    </Frame>
  );
}

/** Negotiation v3: homework, in the existing list frame. The quote uses the same style as "You said". */
function HomeworkFrame({ d, onPractise }: { d: Debrief; onPractise?: () => void }) {
  const h = homeworkModel(d);
  if (!h) return null;
  return (
    <Frame id="neg-homework" title={t("debrief.negotiate.homework.title")} data-review-id="Debrief/Negotiate/Homework" data-review-section="Debrief · Before the real talk" data-comment-target="">
      <ol className={s.list} data-testid="homework">
        {h.rows.map((row) => (
          <li key={row.id} className={s.item}>
            <p className={s.body}><span className={s.label}>{row.n}. </span>{row.text}</p>
            {row.quote ? <p className={s.said}>{"“"}{row.quote}{"”"}</p> : null}
          </li>
        ))}
      </ol>
      {h.repeat ? <p className={s.quiet} data-testid="homework-repeat">{t("debrief.negotiate.homework.repeat", { n: h.repeat.count, quote: h.repeat.quote })}</p> : null}
      {h.prepSkipped && onPractise ? (
        <div>
          <Button variant="link" size="sm" data-track="debrief-practise-with-prep" onClick={onPractise}>{t("debrief.negotiate.homework.practiseWithPrep")}</Button>
        </div>
      ) : null}
    </Frame>
  );
}

function BetterFrame({ d, noOffer, content }: { d: Debrief; noOffer: boolean; content?: TalkContent }) {
  const used = hintsLine(d.hints_used);
  const tiles = (noOffer ? ["N2", "N1"] : []).flatMap((id) => (content?.cards[id] ? [content.cards[id]] : []));
  return (
    <Frame id="neg-better" title={t("debrief.negotiate.better.title")} data-review-id="Debrief/Negotiate/Better" data-review-section="Debrief · Say it better" data-comment-target="">
      {noOffer ? (
        <>
          <p className={s.body}>{t("debrief.negotiate.edge.noOfferBody")}</p>
          {tiles.length ? (
            <ul className={s.tiles}>
              {tiles.map((c) => (<li key={c.id}><TacticCard size="tile" title={c.title} rule={c.rule} example={c.example} evidence={c.evidence} /></li>))}
            </ul>
          ) : null}
        </>
      ) : (
        <ul className={s.list}>
          {d.say_it_better.map((x) => {
            const card = content?.cards[x.card_id];
            return (
              <li key={x.id} className={s.item}>
                <h3 className={s.itemTitle}>{x.title}</h3>
                <p className={s.body}>{x.what_happened}</p>
                {x.you_said ? <p className={s.said}><span className={s.label}>{t("tactic.youSaid")} </span>{"“"}{x.you_said}{"”"}</p> : null}
                <p className={s.say}><span className={s.label}>{t("tactic.try")} </span>{"“"}{x.try}{"”"}</p>
                {x.why || card?.rule ? <TacticCard size="inline" title={t("tactic.whyItWorks")} rule={x.why || card?.rule} evidence={x.why ? undefined : card?.evidence} headingLevel={4} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      {used ? <p className={s.quiet}>{used}</p> : null}
    </Frame>
  );
}

export function NegotiateDebrief(p: ToughTalkDebriefProps<Debrief> & { content?: TalkContent }) {
  const { record, debrief: d } = p;
  const turns = conversationTurns(record);
  const result = d ? negotiateResult(d) : null;
  const moves = d && (!d.no_offer || d.version === 2) ? negotiateMoves(d) : null;
  const objections = d ? objectionRows(d) : [];
  const noOfferView = Boolean(d?.no_offer) && result?.edge === "noOffer";
  return (
    <TalkPage
      variant="negotiate"
      title={negotiateTitle(record, d)}
      meta={negotiateMeta(record, d)}
      turns={turns}
      view={p.view}
      onViewChange={p.onViewChange}
      buildUp={p.buildUp}
      storageError={p.storageError}
      notice={p.notice}
      onRename={p.onRename}
      onDownload={p.onDownload}
      onArchive={p.onArchive}
      onTrash={p.onTrash}
      onPractise={p.onPractise}
    >
      {d && result ? (
        <>
          <ResultFrame d={d} r={result} />
          {objections.length ? <ObjectionsFrame d={d} /> : null}
          {moves && !movesEmpty(moves) ? <MovesFrame d={d} /> : null}
          {noOfferView || d.say_it_better.length ? <BetterFrame d={d} noOffer={noOfferView} content={p.content} /> : null}
          <HomeworkFrame d={d} onPractise={p.onPractise} />
        </>
      ) : null}
    </TalkPage>
  );
}

/** Interview with a salary part: the same result and objections frames, headed "Salary talk" (the page keeps one debrief). */
export function SalaryTalkFrames({ d }: { d: Debrief }) {
  const r = negotiateResult(d);
  const hasObjections = objectionRows(d).length > 0;
  return (
    <>
      <ResultFrame d={d} r={r} id="money-result" title={t("debrief.moneyTalk.title")} review="Debrief/MoneyTalk" />
      {hasObjections ? <ObjectionsFrame d={d} id="money-objections" /> : null}
    </>
  );
}
