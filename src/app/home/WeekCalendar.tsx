"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type WeekEvent = {
  id: string;
  number: number;
  title: string;
  closesAt: string;
  startsAt: string | null;
};

const DAY_MS = 86_400_000;

// This week's RFPs, day by day: what closes (red) and what opens (green), in
// the viewer's own timezone. Arrows move to other weeks.
export function WeekCalendar({ events }: { events: WeekEvent[] }) {
  const { t, locale, timeZone } = usePreferences();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [offset, setOffset] = useState(0);

  const keyOf = useMemo(() => {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    return (value: string | Date) => f.format(typeof value === "string" ? new Date(value) : value);
  }, [timeZone]);

  const byDay = useMemo(() => {
    const closing = new Map<string, WeekEvent[]>();
    const starting = new Map<string, WeekEvent[]>();
    for (const e of events) {
      const c = keyOf(e.closesAt);
      closing.set(c, [...(closing.get(c) ?? []), e]);
      if (e.startsAt) {
        const s = keyOf(e.startsAt);
        starting.set(s, [...(starting.get(s) ?? []), e]);
      }
    }
    return { closing, starting };
  }, [events, keyOf]);

  if (!mounted) return <div className="h-48" aria-hidden />;

  const todayKey = keyOf(new Date());
  // Monday of the displayed week, as a UTC date at midnight (pure calendar math).
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  const mondayShift = (new Date(today).getUTCDay() + 6) % 7;
  const monday = today - mondayShift * DAY_MS + offset * 7 * DAY_MS;
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday + i * DAY_MS));
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  const fmt = (options: Intl.DateTimeFormatOptions) => (d: Date) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(d);
  const rangeLabel = `${fmt({ day: "numeric", month: "short" })(days[0])} – ${fmt({ day: "numeric", month: "short", year: "numeric" })(days[6])}`;

  const buttonClass =
    "rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label={t("rfpCalendar.previousMonth")} className={buttonClass}>
            ‹
          </button>
          <button type="button" onClick={() => setOffset(0)} className={buttonClass}>
            {t("homePage.thisWeek")}
          </button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label={t("rfpCalendar.nextMonth")} className={buttonClass}>
            ›
          </button>
          <span className="ml-2 text-base font-semibold text-slate-800">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            {t("rfpCalendar.closing")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {t("rfpCalendar.starting")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-slate-200 text-sm sm:grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const closing = byDay.closing.get(key) ?? [];
          const starting = byDay.starting.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`min-h-[8rem] border-b border-slate-100 p-2 sm:border-r ${isToday ? "bg-violet-50" : "bg-white"}`}
            >
              <p className="mb-1.5 flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {fmt({ weekday: "short" })(day)}
                </span>
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-violet-600 font-semibold text-white" : "text-slate-700"
                  }`}
                >
                  {day.getUTCDate()}
                </span>
              </p>
              <ul className="space-y-1">
                {closing.map((e) => (
                  <li key={`c-${e.id}`}>
                    <Link
                      href={`/rfps/${e.id}`}
                      title={`${t("rfpCalendar.closing")}: RFP-${e.number} — ${e.title}`}
                      className="flex items-start gap-1.5 rounded px-1 py-0.5 text-xs text-slate-700 hover:bg-red-50"
                    >
                      <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span className="line-clamp-2">RFP-{e.number} {e.title}</span>
                    </Link>
                  </li>
                ))}
                {starting.map((e) => (
                  <li key={`s-${e.id}`}>
                    <Link
                      href={`/rfps/${e.id}`}
                      title={`${t("rfpCalendar.starting")}: RFP-${e.number} — ${e.title}`}
                      className="flex items-start gap-1.5 rounded px-1 py-0.5 text-xs text-slate-700 hover:bg-emerald-50"
                    >
                      <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <span className="line-clamp-2">RFP-{e.number} {e.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
