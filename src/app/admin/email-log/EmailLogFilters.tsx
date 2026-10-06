"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { EMAIL_KINDS } from "@/lib/emailKinds";

const STATUSES = ["SENT", "FAILED", "NOT_SENT"] as const;

export function EmailLogFilters({
  clients,
}: {
  clients: { id: string; code: string; description: string }[];
}) {
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

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
  const statusLabel = (s: (typeof STATUSES)[number]) =>
    s === "SENT"
      ? t("emailLogPage.sent")
      : s === "FAILED"
        ? t("emailLogPage.failed")
        : t("emailLogPage.notSent");

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className={selectClass}
        value={searchParams.get("clientId") ?? ""}
        onChange={(e) => setParam("clientId", e.target.value)}
      >
        <option value="">{t("emailLogPage.allClients")}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.description}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">{t("emailLogPage.allStatuses")}</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        value={searchParams.get("kind") ?? ""}
        onChange={(e) => setParam("kind", e.target.value)}
      >
        <option value="">{t("emailLogPage.allTypes")}</option>
        {EMAIL_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`emailKindLabels.${k}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
