/* The feedback column's content (US-15): P0 first-use hint · P1 listening hint · P2 preparing · P3 layered feedback ·
 * P4 unavailable · Edit what I said · rechecking. The same content fills the wide column's Panel and the mid / narrow
 * Drawer; the footer (Next question) is built by the caller. */
import { Callout, Disclosure, Skeleton, TextShimmer } from "../../../ds";
import { t } from "../../../i18n";
import { ThreadFeedback } from "../../../components/Feedback";
import type { LayerOrder } from "../../../lib/types";
import type { PanelMode, SessionData, SessionHandlers, SessionInput, SessionVariant } from "../types";
import { EditAnswer } from "./EditAnswer";
import s from "./parts.module.css";

export type ConcretePanel = Exclude<PanelMode, "auto">;

export function PanelBody({ mode, variant, input, data, layerOrder, withChecks, handlers, initialOpenHeard, defaultShowAnswer, defaultStrongerOpen }: {
  mode: ConcretePanel;
  variant: SessionVariant;
  input: SessionInput;
  data: SessionData;
  layerOrder: LayerOrder;
  withChecks: boolean;
  handlers?: SessionHandlers;
  initialOpenHeard?: string;
  defaultShowAnswer?: boolean;
  defaultStrongerOpen?: boolean;
}) {
  const english = variant === "english";
  const number = data.thread?.number ?? 0;
  switch (mode) {
    case "p0":
      return <p className={s.panelHint}>{english ? t("feedback.p0English") : t("feedback.p0")}</p>;
    case "p1":
      return <p className={s.panelHint}>{t("feedback.p1")}</p>;
    case "p2":
      return (
        <div className={s.panelWait}>
          <TextShimmer as="p" status>{english ? t("feedback.p2English") : t("feedback.p2", { n: number })}</TextShimmer>
          <Skeleton variant="card" />
        </div>
      );
    case "recheck":
      return (
        <div className={s.panelWait}>
          <TextShimmer as="p" status>{t("session.panel.rechecking", { n: number })}</TextShimmer>
          <Skeleton variant="card" />
        </div>
      );
    case "p4":
      return <Callout tone="info">{t("feedback.p4")}</Callout>;
    case "edit":
      return (
        <EditAnswer
          number={number}
          input={input}
          answer={data.edit?.answer ?? ""}
          followUp={data.edit?.followUp}
          error={data.edit?.error}
          withChecks={withChecks}
          handlers={handlers}
        />
      );
    default:
      return data.thread ? (
        <div className={s.panelFeedback}>
          <div className="motion-card">
            <ThreadFeedback
              thread={data.thread}
              mode={english ? "english" : "interview"}
              layerOrder={layerOrder}
              live
              headingLevel={3}
              showQuestion={false}
              onFlag={handlers?.onFlag}
              onSaveHeard={handlers?.onSaveHeard}
              onStronger={handlers?.onStronger}
              stronger={data.stronger}
              onEdit={handlers?.onEdit}
              initialOpenHeard={initialOpenHeard}
              defaultShowAnswer={defaultShowAnswer}
              defaultStrongerOpen={defaultStrongerOpen}
            />
          </div>
          {data.earlier.length ? (
            <Disclosure surface="plain" track="feedback-earlier-toggle" title={`${english ? t("feedback.earlierEnglish") : t("feedback.earlier")} (${data.earlier.length})`}>
              <div className={s.earlierList}>
                {data.earlier.map((th) => (
                  <ThreadFeedback
                    key={th.key}
                    thread={th}
                    mode={english ? "english" : "interview"}
                    layerOrder={layerOrder}
                    live
                    headingLevel={3}
                    showQuestion={false}
                    onFlag={handlers?.onFlag}
                    onSaveHeard={handlers?.onSaveHeard}
                    onStronger={handlers?.onStronger}
                    stronger={data.stronger}
                  />
                ))}
              </div>
            </Disclosure>
          ) : null}
        </div>
      ) : null;
  }
}
