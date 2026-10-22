/* The plan limit (D88): how much of the user's own plan is used, under the engine in use, details in its facts.
 * Codex and Claude report a percent of their limit; Antigravity and Gemini publish no number, so Vukoli shows its own
 * count of requests and says so. "Sessions left" is an estimate from past sessions; other apps share the same plan. */
import { createContext, useContext, useEffect, useState } from "react";
import { Icon } from "../../ds";
import { t, tMaybe, tp } from "../../i18n";
import { api } from "../../lib/api";
import type { EngineId, EngineInfo, EngineLimits, LimitWindow } from "../../lib/types";
import s from "./engine.module.css";

/** Below this share left, the line turns into a warning. */
export const LOW_LEFT = 20;

/** Stories and the review page: fixed limits per engine instead of the server. */
export const LimitsOverride = createContext<Partial<Record<EngineId, EngineLimits>> | null>(null);

const cache = new Map<EngineId, { at: number; value: Promise<EngineLimits> }>();
const CACHE_MS = 30_000;

/** The engine's limit; nothing while it loads, when it isn't ready, or when the server can't tell. */
export function useEngineLimits(engine: EngineInfo): EngineLimits | null {
  const override = useContext(LimitsOverride);
  const [limits, setLimits] = useState<EngineLimits | null>(null);
  const fixed = override ? override[engine.id] ?? { engine: engine.id, kind: "none" as const } : null;
  useEffect(() => {
    if (override || !engine.status.ready) return;
    let alive = true;
    const hit = cache.get(engine.id);
    const value = hit && Date.now() - hit.at < CACHE_MS ? hit.value : api.engineLimits(engine.id);
    if (value !== hit?.value) cache.set(engine.id, { at: Date.now(), value });
    value.then((v) => { if (alive) setLimits(v); }, () => { cache.delete(engine.id); });
    return () => { alive = false; };
  }, [engine.id, engine.status.ready, override]);
  if (fixed) return engine.status.ready ? fixed : null;
  return engine.status.ready ? limits : null;
}

export const windowName = (id: string) => tMaybe(`engines.limits.window.${id}`, t("engines.limits.window.plan"));

/** "3:40 PM" when the reset is within a day, otherwise "Nov 20". */
export function resetWhen(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.getTime() - now < 86_400_000) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const percent = (n: number) => (n > 0 && n < 1 ? t("engines.limits.underOne") : `${Math.round(n)}%`);

export interface LimitLine {
  tone: "plain" | "warning";
  text: string;
}

/** The one line under the engine; null when there is nothing to say. Pure, unit-tested. */
export function limitLine(limits: EngineLimits | null, now = Date.now()): LimitLine | null {
  if (!limits || limits.kind === "none") return null;
  if (limits.kind === "pending") return { tone: "plain", text: t("engines.limits.pending") };
  if (limits.kind === "count") {
    return limits.period === "day"
      ? { tone: "plain", text: tp("engines.limits.countDay", limits.requests, { time: resetWhen(limits.resets_at, now) }) }
      : { tone: "plain", text: tp("engines.limits.countWeek", limits.requests) };
  }
  const live = limits.windows.filter((w) => !w.stale);
  if (!live.length) return { tone: "plain", text: t("engines.limits.reset") };
  const tight = live.reduce((a, b) => (b.used_percent > a.used_percent ? b : a));
  const vars = { window: windowName(tight.id), when: resetWhen(tight.resets_at, now) };
  const plan = limits.plan ? t("engines.limits.plan", { plan: cap(limits.plan) }) : "";
  const left = 100 - tight.used_percent;
  if (left <= 0) return { tone: "warning", text: plan + t("engines.limits.usedUp", vars) };
  const main = left < LOW_LEFT
    ? t("engines.limits.low", { ...vars, left: `${Math.round(left)}%` })
    : t("engines.limits.used", { ...vars, used: percent(tight.used_percent) });
  const est = limits.estimate;
  const more = est ? t(est.at_least ? "engines.limits.sessionsAtLeast" : "engines.limits.sessions", { n: est.sessions }) : "";
  return { tone: left < LOW_LEFT ? "warning" : "plain", text: plan + main + more };
}

/** Under the engine in use: one line, warning-toned when little is left. */
export function PlanLimit({ engine }: { engine: EngineInfo }) {
  const line = limitLine(useEngineLimits(engine));
  if (!line) return null;
  return (
    <span className={`${s.limit} ${line.tone === "warning" ? s.limitLow : ""}`} data-testid="plan-limit">
      {line.tone === "warning" ? <Icon name="alert" size="sm" /> : null}
      {line.text}
    </span>
  );
}

function windowFact(w: LimitWindow, now: number): string {
  const window = cap(windowName(w.id));
  if (w.stale) return t("engines.limits.windowReset", { window });
  return t("engines.limits.windowLine", { window, used: percent(w.used_percent), when: resetWhen(w.resets_at, now) });
}

/** The "Plan limit" row in the engine's facts: every window, and what the numbers mean. */
export function LimitFacts({ engine }: { engine: EngineInfo }) {
  const limits = useEngineLimits(engine);
  if (!limits || limits.kind === "none") return null;
  const now = Date.now();
  const windows = limits.kind === "percent" ? limits.windows.map((w) => windowFact(w, now)) : [];
  const note = limits.kind === "pending" ? t("engines.limits.pending")
    : limits.kind === "count" ? t(limits.period === "day" ? "engines.limits.aboutDay" : "engines.limits.aboutWeek")
      : t("engines.limits.aboutPercent");
  return (
    <>
      <dt>{t("engines.limits.label")}</dt>
      <dd>
        {windows.map((l) => <p key={l} className={s.factLine}>{l}</p>)}
        <p className={`${s.factLine} ${windows.length ? s.factNote : ""}`}>{note}</p>
      </dd>
    </>
  );
}
