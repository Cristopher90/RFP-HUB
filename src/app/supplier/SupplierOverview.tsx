"use client";

import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { Chart } from "@/components/charts/ChartKit";
import { CountdownTimer } from "@/app/rfps/[id]/CountdownTimer";

export type ExpiringRow = { token: string; rfpNumberLabel: string; rfpTitle: string; clientLabel: string; deadline: string };
export type UnreadRow = { token: string; rfpNumberLabel: string; rfpTitle: string; count: number };

// Top of the supplier's home: the RFPs about to expire (with the time left), the
// RFPs per client, and any unread messages from the buyers.
export function SupplierOverview({
  expiring,
  byClient,
  unread,
}: {
  expiring: ExpiringRow[];
  byClient: { label: string; value: number }[];
  unread: UnreadRow[];
}) {
  const { t } = usePreferences();
  return (
    <div className="mt-6 space-y-4">
      {unread.length > 0 && (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h2 className="text-sm font-semibold text-violet-800">{t("supplierOverview.unreadTitle")}</h2>
          <ul className="mt-2 space-y-1.5">
            {unread.map((u) => (
              <li key={u.token} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  <span className="font-medium">{u.rfpNumberLabel}</span> · {u.rfpTitle}
                </span>
                <Link href={`/respond/${u.token}#mensajes`} className="shrink-0 font-medium text-violet-700 hover:text-violet-900">
                  {t("supplierOverview.unreadItem").replace("{n}", String(u.count))} · {t("supplierOverview.openChat")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">{t("supplierOverview.expiringTitle")}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{t("supplierOverview.expiringHint")}</p>
          {expiring.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{t("supplierOverview.noneExpiring")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {expiring.map((e) => (
                <li key={e.token} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {e.rfpNumberLabel} · {e.rfpTitle}
                    </p>
                    <p className="truncate text-xs text-slate-500">{e.clientLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <CountdownTimer deadline={e.deadline} />
                    <Link href={`/respond/${e.token}`} className="text-xs font-medium text-violet-600 hover:text-violet-700">
                      {t("supplierOverview.respond")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">{t("supplierOverview.byClientTitle")}</h2>
          <Chart type="bar" data={byClient} format={(v) => String(Math.round(v))} />
        </section>
      </div>
    </div>
  );
}
