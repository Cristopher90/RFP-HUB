"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";

// Period filter (by RFP creation date), kept in the URL.
export function ReportsFilters() {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
  const active = searchParams.get("from") || searchParams.get("to");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <span>{t("reportsPage.period")}</span>
      <input type="date" className={field} value={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} />
      <span>–</span>
      <input type="date" className={field} value={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} />
      {active && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("from");
            params.delete("to");
            router.push(`${pathname}?${params.toString()}`);
          }}
          className="font-medium text-violet-600 hover:text-violet-700"
        >
          {t("reportsPage.clearPeriod")}
        </button>
      )}
    </div>
  );
}
