"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { acceptMyConnection, declineMyConnection } from "./actions";

// Connections with other clients that were offered to this account: accepting
// one makes that client's RFPs show up in the same portal.
export function PendingConnections({
  offers,
}: {
  offers: { id: string; clientLabel: string; company: string }[];
}) {
  const { t } = usePreferences();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error: string } | { success: true }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-5">
      <h2 className="text-sm font-semibold text-violet-900">{t("supplierContactsPage.offersTitle")}</h2>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ul className="mt-3 divide-y divide-violet-200">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <span className="text-slate-700">
              {t("supplierContactsPage.offerText")
                .replace("{client}", o.clientLabel)
                .replace("{company}", o.company)}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => acceptMyConnection(o.id))}
                className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {t("supplierContactsPage.accept")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => declineMyConnection(o.id))}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-60"
              >
                {t("supplierContactsPage.decline")}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
