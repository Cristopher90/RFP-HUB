"use client";

import { useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { statusLabel } from "@/i18n/labels";
import { Chart, ChartToggle, type ChartType } from "@/components/charts/ChartKit";

// The user's own RFPs by status, as a chart.
export function StatusSummary({ counts }: { counts: { status: string; count: number }[] }) {
  const { dictionary, t } = usePreferences();
  const [type, setType] = useState<ChartType>("donut");
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {total} {t("homePage.rfpsTotal")}
        </p>
        <ChartToggle allowed={["donut", "bar", "column"]} value={type} onChange={setType} />
      </div>
      <Chart
        type={type}
        data={counts.map((c) => ({ label: statusLabel(dictionary, c.status), value: c.count }))}
        format={(v) => String(Math.round(v))}
      />
    </div>
  );
}
