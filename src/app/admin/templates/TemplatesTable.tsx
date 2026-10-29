"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  clientLabel: string;
  matchKind: "RFP" | "RFI" | null;
  matchCommodity: string | null;
  matchRegion: string | null;
  items: number;
  questions: number;
  active: boolean;
};

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The templates list with filters on three columns: the template's name (and
// description), the client and the conditions (commodity / region it applies to).
export function TemplatesTable({ rows }: { rows: TemplateRow[] }) {
  const { t } = usePreferences();
  const [nameQuery, setNameQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [conditionQuery, setConditionQuery] = useState("");

  const clients = useMemo(() => {
    const map = new Map(rows.map((r) => [r.clientId, r.clientLabel]));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const nameNeedle = norm(nameQuery.trim());
    const conditionNeedle = norm(conditionQuery.trim());
    return rows.filter((r) => {
      if (clientId && r.clientId !== clientId) return false;
      if (nameNeedle && !norm(`${r.name} ${r.description ?? ""}`).includes(nameNeedle)) return false;
      if (conditionNeedle && !norm(`${r.matchKind ?? ""} ${r.matchCommodity ?? ""} ${r.matchRegion ?? ""}`).includes(conditionNeedle)) return false;
      return true;
    });
  }, [rows, nameQuery, clientId, conditionQuery]);

  const filtering = Boolean(nameQuery || clientId || conditionQuery);
  const inputClass =
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder={t("adminDashboard.filterTemplate")}
          aria-label={t("adminDashboard.filterTemplate")}
          className={`${inputClass} w-56`}
        />
        {clients.length > 1 && (
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-label={t("adminDashboard.clientHeader")}
            className={inputClass}
          >
            <option value="">{t("adminDashboard.filterAllClients")}</option>
            {clients.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          value={conditionQuery}
          onChange={(e) => setConditionQuery(e.target.value)}
          placeholder={t("adminDashboard.filterCondition")}
          aria-label={t("adminDashboard.filterCondition")}
          className={`${inputClass} w-72`}
        />
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setNameQuery("");
              setClientId("");
              setConditionQuery("");
            }}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {t("adminDashboard.filterClear")}
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {t("adminDashboard.filterShowing").replace("{shown}", String(filtered.length)).replace("{total}", String(rows.length))}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{t("adminDashboard.templateHeader")}</th>
                <th className="px-5 py-3">{t("adminDashboard.clientHeader")}</th>
                <th className="px-5 py-3">{t("adminDashboard.conditionHeader")}</th>
                <th className="px-5 py-3">{t("adminDashboard.itemsHeader")}</th>
                <th className="px-5 py-3">{t("adminDashboard.questionsHeader")}</th>
                <th className="px-5 py-3">{t("adminDashboard.statusHeader")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                    {t("adminDashboard.filterNoMatches")}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link href={`/admin/templates/${r.id}`} className="font-medium text-slate-900 hover:text-violet-600">
                      {r.name}
                    </Link>
                    {r.description && <p className="mt-0.5 text-xs text-slate-500">{r.description}</p>}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{r.clientLabel}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {r.matchKind || r.matchCommodity || r.matchRegion ? (
                      <>
                        {r.matchKind && (
                          <span className="mr-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            {r.matchKind}
                          </span>
                        )}
                        {r.matchCommodity && (
                          <span className="mr-2">
                            {t("adminDashboard.commodityPrefix")} {r.matchCommodity}
                          </span>
                        )}
                        {r.matchRegion && (
                          <span>
                            {t("adminDashboard.regionPrefix")} {r.matchRegion}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">{t("adminDashboard.anyRfp")}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{r.items}</td>
                  <td className="px-5 py-4 text-slate-600">{r.questions}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.active ? t("adminDashboard.active") : t("adminDashboard.inactive")}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <Link href={`/admin/templates/${r.id}`} className="text-sm font-medium text-violet-600 hover:text-violet-700">
                      {t("adminDashboard.edit")}
                    </Link>
                    <Link
                      href={`/admin/templates/new?copyFrom=${r.id}&clientId=${r.clientId}`}
                      className="ml-4 text-sm font-medium text-slate-500 hover:text-slate-700"
                    >
                      {t("adminDashboard.copyTemplate")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
