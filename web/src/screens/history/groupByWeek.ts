/* Week groups of the History list: "This week", "Last week", then one group per earlier month (debrief.md §4).
 * Weeks start on Monday. Pure: `now` is passed in, so a story never drifts and the rule is unit-tested. */
import { t } from "../../i18n";
import type { HistoryRowModel } from "./types";

export interface WeekGroup { key: string; label: string; rows: HistoryRowModel[] }

const DAY = 24 * 60 * 60 * 1000;

/** Local midnight of the Monday of the week that holds `d`. */
export function weekStart(d: Date): number {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return day.getTime() - ((day.getDay() + 6) % 7) * DAY;
}

const monthName = (d: Date, withYear: boolean) =>
  d.toLocaleDateString("en-US", withYear ? { month: "long", year: "numeric" } : { month: "long" });

export function groupByWeek(rows: HistoryRowModel[], now: Date): WeekGroup[] {
  const thisWeek = weekStart(now);
  const lastWeek = thisWeek - 7 * DAY;
  const sorted = [...rows].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const groups: WeekGroup[] = [];
  const put = (key: string, label: string, row: HistoryRowModel) => {
    const g = groups.find((x) => x.key === key);
    if (g) g.rows.push(row);
    else groups.push({ key, label, rows: [row] });
  };
  for (const row of sorted) {
    const d = new Date(row.startedAt);
    const time = d.getTime();
    if (Number.isNaN(time)) { put("earlier", t("history.week.earlier"), row); continue; }
    if (time >= thisWeek) put("this", t("history.week.this"), row);
    else if (time >= lastWeek) put("last", t("history.week.last"), row);
    else {
      const sameYear = d.getFullYear() === now.getFullYear();
      put(`m${d.getFullYear()}-${d.getMonth()}`, t("history.week.earlierIn", { month: monthName(d, !sameYear) }), row);
    }
  }
  return groups;
}
