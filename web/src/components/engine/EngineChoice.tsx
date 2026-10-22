/* Setup step 1 (D82): the four engines as a choice, nothing picked for you on the first run. Picking one that isn't
 * ready opens its setup right under it (Ollama not installed → "Download Ollama"; not running → how to start it; a key
 * for Gemini, and so on), and the status re-checks every 5 s until it is Ready. Picking doesn't switch the engine:
 * the step's Continue does, once the picked engine is Ready. A Ready pick shows Disconnect (D84). */
import { useEffect } from "react";
import { Badge, Icon, SettingGroup, Skeleton } from "../../ds";
import { t } from "../../i18n";
import { useInterval } from "../../lib/hooks";
import { useApp } from "../../lib/store";
import type { EngineId } from "../../lib/types";
import { DisconnectButton } from "./bodies";
import { EngineBody, Facts } from "./EngineSettings";
import { EngineLogo } from "./EngineLogo";
import { engineStatusWord } from "./EngineStatus";
import { RECOMMENDED, engineLine, engineModel, engineName } from "./meta";
import s from "./engine.module.css";

export interface EngineChoiceProps {
  value: EngineId | null;
  onChange: (id: EngineId) => void;
}

export function EngineChoice({ value, onChange }: EngineChoiceProps) {
  const { engines, settings, refreshEngines } = useApp();
  useEffect(() => { void refreshEngines(); }, [refreshEngines]);
  const picked = engines?.engines.find((e) => e.id === value) ?? null;
  useInterval(() => { void refreshEngines(); }, 5000, Boolean(picked && !picked.status.ready));
  if (!engines) return <Skeleton variant="row" rows={4} label={t("common.checking")} />;

  return (
    <SettingGroup title={t("engines.choice.title")} hideTitle headingLevel={2} flush>
      <div role="radiogroup" aria-label={t("engines.choice.title")}>
        {engines.engines.map((e) => {
          const on = e.id === value;
          const model = e.status.ready ? engineModel(e, settings) : "";
          return (
            <div key={e.id} className={`${s.item} ${s.choiceItem}`} data-picked={on || undefined}>
              <button type="button" role="radio" aria-checked={on} data-track={`engine-${e.id.replace(/_/g, "-")}`} className={`${s.itemHead} ${s.choiceHead}`} onClick={() => onChange(e.id)}>
                <span className={s.optIcon}><EngineLogo id={e.id} /></span>
                <span className={s.optText}>
                  <span className={s.optName}>
                    {engineName(e)}
                    {e.id === RECOMMENDED ? <Badge>{t("engines.recommended")}</Badge> : null}
                  </span>
                  <span className={s.optLine}>{engineLine(e.id)}</span>
                  <span className={`${s.status} ${e.status.ready ? s.statusReady : ""}`}>
                    {e.status.ready ? <Icon name="check" size="sm" /> : null}
                    {model ? `${engineStatusWord(e)} · ${model}` : engineStatusWord(e)}
                  </span>
                </span>
                <span className={s.radio} aria-hidden="true">{on ? <Icon name="check" size="sm" strokeWidth={3} /> : null}</span>
              </button>
              {on && !e.status.ready ? (
                <div className={s.itemBody}>
                  <EngineBody engine={e} />
                  <Facts engine={e} />
                  {e.status.code !== "not_configured" && e.status.code !== "disconnected" ? <span className={s.note} aria-live="polite">{t("engines.recheckNote")}</span> : null}
                </div>
              ) : null}
              {on && e.status.ready ? (
                <div className={`${s.itemBody} ${s.connectedRow}`}>
                  <span className={s.note}>{t("engines.connected")}</span>
                  <DisconnectButton engine={e} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SettingGroup>
  );
}
