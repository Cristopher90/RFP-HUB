"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type CalendarEvent = {
  id: string;
  number: number;
  title: string;
  closesAt: string; // ISO instant
  startsAt: string | null; // ISO instant
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dayKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// Month grid of the RFPs that close (red) and start (green) each day. Days
// are the viewer's own calendar days (their timezone), so an RFP closing at
// 23:00 for them is shown on that day, not on the server's.
export function RfpCalendar({ events }: { events: CalendarEvent[] }) {
  const { t, locale, timeZone } = usePreferences();

  const keyOf = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return (iso: string | Date) => formatter.format(typeof iso === "string" ? new Date(iso) : iso);
  }, [timeZone]);

  const todayKey = keyOf(new Date());
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const closing = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = keyOf(e.closesAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events, keyOf]);
  const starting = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!e.startsAt) continue;
      const key = keyOf(e.startsAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events, keyOf]);

  const rawMonthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));
  const monthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  // Jan 1, 2024 is a Monday: week starts on Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + i)),
    ),
  );

  const firstWeekday = (new Date(Date.UTC(cursor.year, cursor.month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    setSelected(null);
    setCursor((prev) => {
      const d = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  function goToday() {
    const [y, m] = todayKey.split("-").map(Number);
    setSelected(null);
    setCursor({ year: y, month: m - 1 });
  }

  const selectedClosing = selected ? (closing.get(selected) ?? []) : [];
  const selectedStarting = selected ? (starting.get(selected) ?? []) : [];
  const buttonClass =
    "rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={t("rfpCalendar.previousMonth")}
            className={buttonClass}
          >
            ‹
          </button>
          <button type="button" onClick={goToday} className={buttonClass}>
            {t("rfpCalendar.today")}
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={t("rfpCalendar.nextMonth")}
            className={buttonClass}
          >
            ›
          </button>
          <span className="ml-2 text-base font-semibold text-slate-800">
            {monthLabel}
          </span>
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

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-sm">
        {weekdays.map((w) => (
          <div
            key={w}
            className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            {w}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="min-h-[3.5rem] border-b border-r border-slate-100 bg-slate-50/50" />;
          }
          const key = dayKey(cursor.year, cursor.month, day);
          const closeCount = closing.get(key)?.length ?? 0;
          const startCount = starting.get(key)?.length ?? 0;
          const hasEvents = closeCount + startCount > 0;
          const isToday = key === todayKey;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              disabled={!hasEvents}
              onClick={() => setSelected(isSelected ? null : key)}
              className={`min-h-[3.5rem] border-b border-r border-slate-100 p-1.5 text-left align-top ${
                hasEvents ? "cursor-pointer hover:bg-violet-50" : "cursor-default"
              } ${isSelected ? "bg-violet-50 ring-2 ring-inset ring-violet-400" : "bg-white"}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-violet-600 font-semibold text-white" : "text-slate-600"
                }`}
              >
                {day}
              </span>
              {hasEvents && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {closeCount > 0 && (
                    <span
                      title={`${closeCount} ${t("rfpCalendar.closing").toLowerCase()}`}
                      className="rounded-full bg-red-500 px-1.5 text-xs font-semibold leading-5 text-white"
                    >
                      {closeCount}
                    </span>
                  )}
                  {startCount > 0 && (
                    <span
                      title={`${startCount} ${t("rfpCalendar.starting").toLowerCase()}`}
                      className="rounded-full bg-emerald-500 px-1.5 text-xs font-semibold leading-5 text-white"
                    >
                      {startCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-red-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              {t("rfpCalendar.closing")} ({selectedClosing.length})
            </h3>
            {selectedClosing.length === 0 ? (
              <p className="text-xs text-slate-400">{t("rfpCalendar.none")}</p>
            ) : (
              <ul className="space-y-0.5">
                {selectedClosing.map((e) => (
                  <li key={e.id}>
                    <Link href={`/rfps/${e.id}`} className="text-violet-700 hover:underline">
                      RFP-{e.number} — {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {t("rfpCalendar.starting")} ({selectedStarting.length})
            </h3>
            {selectedStarting.length === 0 ? (
              <p className="text-xs text-slate-400">{t("rfpCalendar.none")}</p>
            ) : (
              <ul className="space-y-0.5">
                {selectedStarting.map((e) => (
                  <li key={e.id}>
                    <Link href={`/rfps/${e.id}`} className="text-violet-700 hover:underline">
                      RFP-{e.number} — {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
