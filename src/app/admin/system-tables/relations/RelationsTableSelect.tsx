"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function RelationsTableSelect({ tables }: { tables: string[] }) {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <label className="flex items-center gap-3 text-sm text-slate-600">
      {t("systemTableRelations.table")}
      <select
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        value={searchParams.get("table") ?? ""}
        onChange={(e) => router.push(e.target.value ? `${pathname}?table=${e.target.value}` : pathname)}
      >
        <option value="">{t("systemTableRelations.allTables")}</option>
        {tables.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
