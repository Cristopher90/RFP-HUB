"use client";

import { useId, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type BarChartDatum = {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  color: string;
};

export function BarChart({
  data,
  valueFormatter = (v: number) => String(v),
  bestId,
  bestLabel,
  emptyMessage,
}: {
  data: BarChartDatum[];
  valueFormatter?: (value: number) => string;
  bestId?: string | null;
  bestLabel?: string;
  emptyMessage?: string;
}) {
  const { t } = usePreferences();
  const uid = useId();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        {emptyMessage ?? t("barChart.noDataYet")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = Math.max(2, (d.value / max) * 100);
        const isBest = bestId === d.id;
        const isHover = hoverId === d.id;
        return (
          <div
            key={d.id}
            className="group"
            onMouseEnter={() => setHoverId(d.id)}
            onMouseLeave={() => setHoverId(null)}
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium text-slate-700">
                  {d.label}
                </span>
                {d.sublabel && (
                  <span className="shrink-0 truncate text-xs text-slate-400">
                    {d.sublabel}
                  </span>
                )}
                {isBest && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    {bestLabel ?? t("barChart.best")}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                {valueFormatter(d.value)}
              </span>
            </div>
            <div className="relative h-5 rounded-sm bg-slate-100">
              <div
                className="h-5 rounded-r-[4px] transition-[width] duration-300 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: d.color,
                  opacity: isHover ? 1 : 0.88,
                }}
              />
              {isHover && (
                <div
                  className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg"
                  style={{ left: `${pct}%` }}
                >
                  {d.label}: {valueFormatter(d.value)}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <p className="sr-only" id={uid}>
        {t("barChart.horizontalBarChart")}
      </p>
    </div>
  );
}
