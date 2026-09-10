"use client";

import Link from "next/link";
import { formatDate, formatRfpNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useColumnPrefs, type ColumnDef } from "@/lib/useColumnPrefs";
import { ColumnSettingsMenu, ResizableTh } from "@/components/ColumnSettingsMenu";
import type { RfpStatus } from "@/generated/prisma/enums";

export type RfpRow = {
  id: string;
  number: number;
  title: string;
  status: RfpStatus;
  commodity: string | null;
  region: string | null;
  creatorName: string;
  itemCount: number;
  invitationCount: number;
  respondedCount: number;
  deadlineAt: string;
  clientLabel: string | null;
};

type ColumnKey =
  | "cliente"
  | "estado"
  | "commodity"
  | "region"
  | "creador"
  | "articulos"
  | "proveedores"
  | "respuestas"
  | "cierre";

const ALL_COLUMN_DEFS: ColumnDef<ColumnKey>[] = [
  { key: "cliente", label: "Cliente", defaultWidth: 160, minWidth: 100 },
  { key: "estado", label: "Estado", defaultWidth: 140, minWidth: 100 },
  { key: "commodity", label: "Commodity", defaultWidth: 200, minWidth: 100 },
  { key: "region", label: "Región", defaultWidth: 140, minWidth: 90 },
  { key: "creador", label: "Creador", defaultWidth: 170, minWidth: 100 },
  { key: "articulos", label: "Artículos", defaultWidth: 100, minWidth: 80 },
  { key: "proveedores", label: "Proveedores", defaultWidth: 120, minWidth: 90 },
  { key: "respuestas", label: "Respuestas", defaultWidth: 120, minWidth: 90 },
  { key: "cierre", label: "Cierre", defaultWidth: 130, minWidth: 100 },
];

export function RfpTable({
  rfps,
  showClientColumn,
}: {
  rfps: RfpRow[];
  showClientColumn: boolean;
}) {
  const defs = showClientColumn
    ? ALL_COLUMN_DEFS
    : ALL_COLUMN_DEFS.filter((d) => d.key !== "cliente");
  const columnPrefs = useColumnPrefs("rfp-list-columns", defs);

  function cellContent(def: ColumnDef<ColumnKey>, rfp: RfpRow) {
    switch (def.key) {
      case "cliente":
        return rfp.clientLabel ?? "—";
      case "estado":
        return <StatusBadge status={rfp.status} />;
      case "commodity":
        return rfp.commodity ?? "—";
      case "region":
        return rfp.region ?? "—";
      case "creador":
        return rfp.creatorName;
      case "articulos":
        return rfp.itemCount;
      case "proveedores":
        return rfp.invitationCount;
      case "respuestas":
        return `${rfp.respondedCount} / ${rfp.invitationCount}`;
      case "cierre":
        return formatDate(rfp.deadlineAt);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-end border-b border-slate-200 px-4 py-2">
        <ColumnSettingsMenu
          defs={defs}
          order={columnPrefs.order}
          hidden={columnPrefs.hidden}
          toggleVisible={columnPrefs.toggleVisible}
          moveColumn={columnPrefs.moveColumn}
          resetPrefs={columnPrefs.resetPrefs}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">RFP</th>
              {columnPrefs.visibleOrderedDefs.map((def) => (
                <ResizableTh
                  key={def.key}
                  width={columnPrefs.widths[def.key]}
                  onResize={(w) => columnPrefs.setWidth(def.key, w)}
                >
                  {def.label}
                </ResizableTh>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rfps.map((rfp) => (
              <tr key={rfp.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <Link href={`/rfps/${rfp.id}`} className="group flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                      {formatRfpNumber(rfp.number)}
                    </span>
                    <span className="font-medium text-slate-900 group-hover:text-violet-600">
                      {rfp.title}
                    </span>
                  </Link>
                </td>
                {columnPrefs.visibleOrderedDefs.map((def) => (
                  <td
                    key={def.key}
                    style={{ width: columnPrefs.widths[def.key] }}
                    className="px-5 py-4 text-slate-600"
                  >
                    {cellContent(def, rfp)}
                  </td>
                ))}
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/rfps/${rfp.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                  >
                    Ver &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
