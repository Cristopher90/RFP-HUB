"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate, formatRfpNumber } from "@/lib/format";

export type PendingApprovalRow = {
  rfpId: string;
  rfpNumber: number;
  rfpTitle: string;
  stage: "PUBLISH" | "AWARD";
  approvalId: string;
  createdAt: string;
};

type SortKey = "id" | "title" | "date";

const STAGE_LABEL: Record<PendingApprovalRow["stage"], string> = {
  PUBLISH: "Publicar",
  AWARD: "Adjudicar",
};

export function PendingApprovalsBox({ items }: { items: PendingApprovalRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (i) =>
            formatRfpNumber(i.rfpNumber).toLowerCase().includes(q) ||
            i.rfpTitle.toLowerCase().includes(q),
        )
      : items;
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "id") cmp = a.rfpNumber - b.rfpNumber;
      else if (sortKey === "title") cmp = a.rfpTitle.localeCompare(b.rfpTitle);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, search, sortKey, sortDir]);

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null;
    return <span className="ml-1 text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  return (
    <div className="mb-8 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-900">
            RFPs pendientes de validar
          </h2>
          <p className="mt-0.5 text-xs text-amber-700">
            Solicitudes que esperan tu aprobación de publicación o
            adjudicación.
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ID o título..."
          className="w-56 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>
      <table className="min-w-full divide-y divide-amber-100 text-sm">
        <thead className="text-left text-xs font-medium uppercase tracking-wide text-amber-800">
          <tr>
            <th
              className="cursor-pointer select-none px-5 py-2"
              onClick={() => toggleSort("id")}
            >
              RFP{sortIndicator("id")}
            </th>
            <th
              className="cursor-pointer select-none px-5 py-2"
              onClick={() => toggleSort("title")}
            >
              Título{sortIndicator("title")}
            </th>
            <th className="px-5 py-2">Etapa</th>
            <th
              className="cursor-pointer select-none px-5 py-2"
              onClick={() => toggleSort("date")}
            >
              Fecha{sortIndicator("date")}
            </th>
            <th className="px-5 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-100">
          {visible.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-4 text-center text-amber-700">
                No hay resultados.
              </td>
            </tr>
          ) : (
            visible.map((i) => (
              <tr key={i.approvalId} className="hover:bg-amber-100/40">
                <td className="px-5 py-3 font-medium text-slate-900">
                  {formatRfpNumber(i.rfpNumber)}
                </td>
                <td className="px-5 py-3 text-slate-700">{i.rfpTitle}</td>
                <td className="px-5 py-3 text-slate-600">
                  {STAGE_LABEL[i.stage]}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {formatDate(i.createdAt)}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={
                      i.stage === "AWARD"
                        ? `/rfps/${i.rfpId}/compare`
                        : `/rfps/${i.rfpId}`
                    }
                    className="text-sm font-medium text-violet-600 hover:text-violet-700"
                  >
                    Revisar &rarr;
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
