"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { RequestStatus } from "@/lib/requestStatus";
import { assignRequest, setRequestCancelled } from "./actions";

export type RequestLine = {
  id: string;
  position: string;
  itemCode: string;
  description: string;
  historicalPrice: number | null;
  quantity: number;
  unit: string;
  commodity: string;
};

export type RequestRow = {
  id: string;
  documentNumber: string;
  documentType: string;
  creator: string;
  buyerKey: string; // "u:<id>" | "g:<id>" | ""
  buyerLabel: string;
  status: RequestStatus;
  importedAt: string;
  requestDate: string;
  commodity: string;
  rfpId: string | null;
  canGenerate: boolean;
  lines: RequestLine[];
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  NEW: "bg-sky-100 text-sky-700",
  PROCESSED: "bg-amber-100 text-amber-700",
  IN_NEGOTIATION: "bg-violet-100 text-violet-700",
  NEGOTIATED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

type Option = { id: string; name: string };

export function RequestsTable({
  rows,
  currency,
  canAssign,
  buyers,
  groups,
}: {
  rows: RequestRow[];
  currency: string;
  canAssign: boolean;
  buyers: Option[];
  groups: Option[];
}) {
  const { t, formatCurrency } = usePreferences();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = rows.find((r) => r.id === openId) ?? null;

  function handleAssign(row: RequestRow, value: string) {
    setError(null);
    startTransition(async () => {
      const target = value.startsWith("u:")
        ? ({ kind: "user", id: value.slice(2) } as const)
        : value.startsWith("g:")
          ? ({ kind: "group", id: value.slice(2) } as const)
          : ({ kind: "none" } as const);
      const result = await assignRequest(row.id, target);
      if ("error" in result) setError(result.error);
    });
  }

  function handleCancel(row: RequestRow, cancelled: boolean) {
    if (cancelled && !confirm(t("requestsPage.cancelConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const result = await setRequestCancelled(row.id, cancelled);
      if ("error" in result) setError(result.error);
    });
  }

  const th = "px-4 py-3 whitespace-nowrap";
  const canReassign = (row: RequestRow) =>
    canAssign && (row.status === "NEW" || row.status === "PROCESSED");

  return (
    <div className="mt-4">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className={th}>{t("requestsPage.documentNumber")}</th>
              <th className={th}>{t("requestsPage.documentType")}</th>
              <th className={th}>{t("requestsPage.creator")}</th>
              <th className={th}>{t("requestsPage.buyer")}</th>
              <th className={th}>{t("requestsPage.status")}</th>
              <th className={th}>{t("requestsPage.importedAt")}</th>
              <th className={th}>{t("requestsPage.requestDate")}</th>
              <th className={th}>{t("requestsPage.commodity")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  {t("requestsPage.noRows")}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="align-middle hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => setOpenId(row.id)}
                    className="text-violet-600 hover:text-violet-700"
                  >
                    {row.documentNumber}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.documentType}</td>
                <td className="px-4 py-3 text-slate-600">{row.creator || "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {canReassign(row) ? (
                    <select
                      disabled={pending}
                      value={row.buyerKey}
                      onChange={(e) => handleAssign(row, e.target.value)}
                      className="max-w-[12rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="">{t("requestsPage.unassigned")}</option>
                      {buyers.length > 0 && (
                        <optgroup label={t("requestsPage.buyersOption")}>
                          {buyers.map((b) => (
                            <option key={b.id} value={`u:${b.id}`}>
                              {b.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {groups.length > 0 && (
                        <optgroup label={t("requestsPage.groupsOption")}>
                          {groups.map((g) => (
                            <option key={g.id} value={`g:${g.id}`}>
                              {g.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  ) : (
                    row.buyerLabel || "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}
                  >
                    {t(`requestStatus.${row.status}`)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.importedAt}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.requestDate || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{row.commodity || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(row.id)}
                      className="text-sm font-medium text-slate-500 hover:text-slate-700"
                    >
                      {t("requestsPage.viewLines")} ({row.lines.length})
                    </button>
                    {row.canGenerate && (
                      <Link
                        href={`/rfps/new?fromRequest=${row.id}`}
                        className="rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700"
                      >
                        {t("requestsPage.generateRfp")}
                      </Link>
                    )}
                    {row.rfpId && (
                      <Link
                        href={`/rfps/${row.rfpId}`}
                        className="text-sm font-medium text-violet-600 hover:text-violet-700"
                      >
                        {t("requestsPage.viewRfp")}
                      </Link>
                    )}
                    {canAssign && row.status === "NEW" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleCancel(row, true)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        {t("requestsPage.cancel")}
                      </button>
                    )}
                    {canAssign && row.status === "CANCELLED" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleCancel(row, false)}
                        className="text-sm font-medium text-slate-600 hover:text-slate-800"
                      >
                        {t("requestsPage.restore")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-4xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-900">
                {t("requestLines.title")} · {open.documentType} {open.documentNumber}
              </h2>
            </div>
            <div className="max-h-96 overflow-auto">
              {open.lines.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">{t("requestLines.noLines")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">{t("requestLines.position")}</th>
                      <th className="px-4 py-2">{t("requestLines.itemCode")}</th>
                      <th className="px-4 py-2">{t("requestLines.description")}</th>
                      <th className="px-4 py-2">{t("requestLines.historicalPrice")}</th>
                      <th className="px-4 py-2">{t("requestLines.quantity")}</th>
                      <th className="px-4 py-2">{t("requestLines.commodity")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {open.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-2 text-slate-500">{line.position}</td>
                        <td className="px-4 py-2 text-slate-500">{line.itemCode || "—"}</td>
                        <td className="px-4 py-2 text-slate-800">{line.description}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {line.historicalPrice !== null ? formatCurrency(line.historicalPrice, currency) : "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {line.quantity}
                          {line.unit && ` ${line.unit}`}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{line.commodity || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("requestLines.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
