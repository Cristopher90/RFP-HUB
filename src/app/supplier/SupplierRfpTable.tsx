"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { statusLabel } from "@/i18n/labels";

export type SupplierInvitationRow = {
  id: string;
  token: string;
  clientLabel: string;
  rfpNumberLabel: string;
  rfpTitle: string;
  rfpDescription: string;
  status: string;
  invitedAtLabel: string;
  responded: boolean;
  responseLabel: string | null;
};

function participationOptions(t: (key: string) => string) {
  return [
    { value: "", label: t("supplierPortal.participationAll") },
    { value: "pending", label: t("supplierPortal.participationPending") },
    { value: "responded", label: t("supplierPortal.participationResponded") },
  ];
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Filtra en el cliente sobre los datos ya cargados por el servidor — la
// cantidad de RFPs que recibe un proveedor es chica, no justifica ir al
// servidor por cada cambio de filtro.
export function SupplierRfpTable({
  invitations,
}: {
  invitations: SupplierInvitationRow[];
}) {
  const { language, t, dictionary } = usePreferences();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [participation, setParticipation] = useState("");

  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const inv of invitations) seen.set(inv.status, inv.status);
    return Array.from(seen.keys());
  }, [invitations]);

  const filtered = invitations.filter((inv) => {
    if (status && inv.status !== status) return false;
    if (participation === "pending" && inv.responded) return false;
    if (participation === "responded" && !inv.responded) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.clientLabel.toLowerCase().includes(q) ||
      inv.rfpNumberLabel.toLowerCase().includes(q) ||
      inv.rfpTitle.toLowerCase().includes(q) ||
      inv.rfpDescription.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("supplierPortal.search")}
          </label>
          <input
            className={inputClass()}
            placeholder={t("supplierPortal.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("supplierPortal.status")}
          </label>
          <select
            className={inputClass()}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("supplierPortal.allStatuses")}</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(dictionary, s)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("supplierPortal.participation")}
          </label>
          <select
            className={inputClass()}
            value={participation}
            onChange={(e) => setParticipation(e.target.value)}
          >
            {participationOptions(t).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {t("supplierPortal.noMatch")}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">{t("supplierPortal.client")}</th>
                  <th className="px-5 py-3">{t("supplierPortal.rfp")}</th>
                  <th className="px-5 py-3">{t("supplierPortal.description")}</th>
                  <th className="px-5 py-3">{t("supplierPortal.received")}</th>
                  <th className="px-5 py-3">{t("supplierPortal.status")}</th>
                  <th className="px-5 py-3">{t("supplierPortal.participation")}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-700">
                      {inv.clientLabel}
                    </td>
                    <td className="px-5 py-4">
                      <span className="mr-2 inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                        {inv.rfpNumberLabel}
                      </span>
                      <span className="font-medium text-slate-900">
                        {inv.rfpTitle}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-600">
                      {inv.rfpDescription}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {inv.invitedAtLabel}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={inv.status} language={language} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {inv.responded ? (
                        <span className="text-emerald-700">
                          {t("supplierPortal.participationResponded")} &middot; {inv.responseLabel}
                        </span>
                      ) : (
                        <span className="text-amber-600">{t("supplierPortal.participationPending")}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/respond/${inv.token}`}
                        className="text-sm font-medium text-violet-600 hover:text-violet-700"
                      >
                        {inv.responded ? t("supplierPortal.view") : t("supplierPortal.participate")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
