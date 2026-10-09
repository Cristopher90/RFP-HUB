"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function SystemLogFilters({ tables }: { tables: string[] }) {
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

  const qParam = searchParams.get("q") ?? "";
  const [text, setText] = useState(qParam);
  const applied = useRef(qParam);
  useEffect(() => {
    if (text.trim() === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = text.trim();
      setParam("q", text.trim());
    }, 500);
    return () => clearTimeout(timer);
    // setParam changes every render; only the typed text should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
  const active = ["table", "action", "q"].some((k) => searchParams.get(k));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        className={`${field} w-full sm:w-64`}
        placeholder={t("systemTableLogPage.search")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <select className={field} value={searchParams.get("table") ?? ""} onChange={(e) => setParam("table", e.target.value)}>
        <option value="">{t("systemTableLogPage.allTables")}</option>
        {tables.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select className={field} value={searchParams.get("action") ?? ""} onChange={(e) => setParam("action", e.target.value)}>
        <option value="">{t("systemTableLogPage.allActions")}</option>
        <option value="UPDATE">{t("systemTableLogPage.edited")}</option>
        <option value="DELETE">{t("systemTableLogPage.deleted")}</option>
      </select>
      {active && (
        <button type="button" onClick={() => router.push(pathname)} className="text-sm font-medium text-violet-600 hover:text-violet-700">
          {t("systemTableLogPage.clear")}
        </button>
      )}
    </div>
  );
}
