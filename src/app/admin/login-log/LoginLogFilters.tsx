"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";

const EVENTS = ["LOGIN", "LOGOUT", "LOGIN_FAILED"] as const;
const KINDS = ["USER", "SUPPLIER", "UNKNOWN"] as const;

export function LoginLogFilters() {
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

  // The text search is applied after a short pause, not on every keystroke.
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
  const active = ["event", "kind", "q", "from", "to"].some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        className={`${field} w-full sm:w-64`}
        placeholder={t("loginLogPage.search")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <select className={field} value={searchParams.get("event") ?? ""} onChange={(e) => setParam("event", e.target.value)}>
        <option value="">{t("loginLogPage.allEvents")}</option>
        {EVENTS.map((e) => (
          <option key={e} value={e}>
            {t(`loginLogPage.event_${e}`)}
          </option>
        ))}
      </select>
      <select className={field} value={searchParams.get("kind") ?? ""} onChange={(e) => setParam("kind", e.target.value)}>
        <option value="">{t("loginLogPage.allKinds")}</option>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`loginLogPage.kind_${k}`)}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <input type="date" className={field} value={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} />
        <span>–</span>
        <input type="date" className={field} value={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} />
      </div>
      {active && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          {t("loginLogPage.clear")}
        </button>
      )}
    </div>
  );
}
