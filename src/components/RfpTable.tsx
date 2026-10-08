"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatRfpNumber } from "@/lib/format";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import { StatusBadge } from "@/components/StatusBadge";
import { statusLabel } from "@/i18n/labels";
import { loadPref, useSavePref } from "@/lib/userPrefsClient";
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
  startsAt: string | null;
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
  | "inicio"
  | "cierre";

type SortKey = ColumnKey | "rfp";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

type GroupBy = "none" | "estado" | "commodity" | "region" | "creador" | "inicio" | "cierre";
type DatePart = "day" | "month" | "year";

const GROUP_OPTIONS: GroupBy[] = ["estado", "commodity", "region", "creador", "inicio", "cierre"];
const GROUPING_STORAGE_KEY = "rfp-list-grouping";

function allColumnDefs(dictionary: Dictionary): ColumnDef<ColumnKey>[] {
  return [
    { key: "cliente", label: dictionary.rfpTable.cliente, defaultWidth: 160, minWidth: 100 },
    { key: "estado", label: dictionary.rfpTable.estado, defaultWidth: 140, minWidth: 100 },
    { key: "commodity", label: dictionary.rfpTable.commodity, defaultWidth: 200, minWidth: 100 },
    { key: "region", label: dictionary.rfpTable.region, defaultWidth: 140, minWidth: 90 },
    { key: "creador", label: dictionary.rfpTable.creador, defaultWidth: 170, minWidth: 100 },
    { key: "articulos", label: dictionary.rfpTable.articulos, defaultWidth: 100, minWidth: 80 },
    { key: "proveedores", label: dictionary.rfpTable.proveedores, defaultWidth: 120, minWidth: 90 },
    { key: "respuestas", label: dictionary.rfpTable.respuestas, defaultWidth: 120, minWidth: 90 },
    { key: "inicio", label: dictionary.rfpTable.inicio, defaultWidth: 130, minWidth: 100 },
    { key: "cierre", label: dictionary.rfpTable.cierre, defaultWidth: 130, minWidth: 100 },
  ];
}

type Group = {
  key: string;
  label: string;
  rows: RfpRow[];
  articulos: number;
  proveedores: number;
  respuestas: number;
};

export function RfpTable({
  rfps,
  showClientColumn,
}: {
  rfps: RfpRow[];
  showClientColumn: boolean;
}) {
  const { formatDate, language, dictionary, locale, timeZone } = usePreferences();
  const allColumns = allColumnDefs(dictionary);
  const defs = showClientColumn
    ? allColumns
    : allColumns.filter((d) => d.key !== "cliente");
  const columnPrefs = useColumnPrefs("rfp-list-columns", defs);

  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [datePart, setDatePart] = useState<DatePart>("month");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState>(null);
  const [groupingLoaded, setGroupingLoaded] = useState(false);

  // Loaded from the server after mount so the first client render matches
  // the server-rendered markup.
  useEffect(() => {
    let cancelled = false;
    loadPref<{ groupBy?: GroupBy; datePart?: DatePart; sort?: SortState }>(GROUPING_STORAGE_KEY).then((saved) => {
      if (cancelled) return;
      if (saved?.groupBy && (saved.groupBy === "none" || GROUP_OPTIONS.includes(saved.groupBy))) {
        setGroupBy(saved.groupBy);
      }
      if (saved?.datePart && ["day", "month", "year"].includes(saved.datePart)) {
        setDatePart(saved.datePart);
      }
      if (saved?.sort && saved.sort.key && ["asc", "desc"].includes(saved.sort.dir)) {
        setSort(saved.sort);
      }
      setGroupingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useSavePref(GROUPING_STORAGE_KEY, { groupBy, datePart, sort }, groupingLoaded);

  // Clicking a header sorts by it, largest first; a second click flips to
  // smallest first, a third goes back to the default order.
  function cycleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }

  const sortedRfps = useMemo(() => {
    if (!sort) return rfps;
    const sign = sort.dir === "asc" ? 1 : -1;
    function value(rfp: RfpRow): number | string | null {
      switch (sort!.key) {
        case "rfp":
          return rfp.number;
        case "cliente":
          return rfp.clientLabel;
        case "estado":
          return statusLabel(dictionary, rfp.status);
        case "commodity":
          return rfp.commodity;
        case "region":
          return rfp.region;
        case "creador":
          return rfp.creatorName;
        case "articulos":
          return rfp.itemCount;
        case "proveedores":
          return rfp.invitationCount;
        case "respuestas":
          return rfp.respondedCount;
        case "inicio":
          return rfp.startsAt ? new Date(rfp.startsAt).getTime() : null;
        case "cierre":
          return new Date(rfp.deadlineAt).getTime();
      }
    }
    return [...rfps].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || va === "") return vb === null || vb === "" ? 0 : 1; // empty last
      if (vb === null || vb === "") return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sign;
      return String(va).localeCompare(String(vb), locale) * sign;
    });
  }, [rfps, sort, dictionary, locale]);

  function sortIndicator(key: SortKey) {
    return sort?.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : "";
  }

  const isDateGroup = groupBy === "inicio" || groupBy === "cierre";

  const groups = useMemo<Group[] | null>(() => {
    if (groupBy === "none") return null;
    const dayFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    function capitalize(text: string) {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    function dateGroup(iso: string | null): { key: string; label: string } {
      if (!iso) return { key: "", label: dictionary.rfpTable.noValue };
      const day = dayFormatter.format(new Date(iso)); // YYYY-MM-DD in the viewer's zone
      const [y, m, d] = day.split("-").map(Number);
      const anchor = new Date(Date.UTC(y, m - 1, d));
      if (datePart === "year") return { key: String(y), label: String(y) };
      if (datePart === "month") {
        return {
          key: day.slice(0, 7),
          label: capitalize(
            new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(anchor),
          ),
        };
      }
      return {
        key: day,
        label: new Intl.DateTimeFormat(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(anchor),
      };
    }
    function keyFor(rfp: RfpRow): { key: string; label: string } {
      switch (groupBy) {
        case "estado":
          return { key: rfp.status, label: statusLabel(dictionary, rfp.status) };
        case "commodity":
          return rfp.commodity
            ? { key: rfp.commodity, label: rfp.commodity }
            : { key: "", label: dictionary.rfpTable.noValue };
        case "region":
          return rfp.region
            ? { key: rfp.region, label: rfp.region }
            : { key: "", label: dictionary.rfpTable.noValue };
        case "creador":
          return rfp.creatorName && rfp.creatorName !== "—"
            ? { key: rfp.creatorName, label: rfp.creatorName }
            : { key: "", label: dictionary.rfpTable.noValue };
        case "inicio":
          return dateGroup(rfp.startsAt);
        default:
          return dateGroup(rfp.deadlineAt);
      }
    }
    const byKey = new Map<string, Group>();
    for (const rfp of sortedRfps) {
      const { key, label } = keyFor(rfp);
      let group = byKey.get(key);
      if (!group) {
        group = { key, label, rows: [], articulos: 0, proveedores: 0, respuestas: 0 };
        byKey.set(key, group);
      }
      group.rows.push(rfp);
      group.articulos += rfp.itemCount;
      group.proveedores += rfp.invitationCount;
      group.respuestas += rfp.respondedCount;
    }
    const dateSorted = groupBy === "inicio" || groupBy === "cierre";
    return [...byKey.values()].sort((a, b) => {
      if (a.key === "" || b.key === "") return a.key === "" ? 1 : -1; // "sin valor" last
      return dateSorted ? a.key.localeCompare(b.key) : a.label.localeCompare(b.label, locale);
    });
  }, [groupBy, datePart, sortedRfps, dictionary, locale, timeZone]);

  const allCollapsed =
    groups !== null && groups.length > 0 && groups.every((g) => collapsed.has(g.key));

  function toggleAllGroups() {
    setCollapsed(allCollapsed || !groups ? new Set() : new Set(groups.map((g) => g.key)));
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function cellContent(def: ColumnDef<ColumnKey>, rfp: RfpRow) {
    switch (def.key) {
      case "cliente":
        return rfp.clientLabel ?? "—";
      case "estado":
        return <StatusBadge status={rfp.status} language={language} />;
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
      case "inicio":
        return rfp.startsAt ? formatDate(rfp.startsAt) : "—";
      case "cierre":
        return formatDate(rfp.deadlineAt);
    }
  }

  function groupLabel(option: GroupBy) {
    return dictionary.rfpTable[option === "none" ? "noGrouping" : option];
  }

  function subtotalContent(def: ColumnDef<ColumnKey>, group: Group) {
    switch (def.key) {
      case "articulos":
        return group.articulos;
      case "proveedores":
        return group.proveedores;
      case "respuestas":
        return `${group.respuestas} / ${group.proveedores}`;
      default:
        return null;
    }
  }

  function renderRow(rfp: RfpRow) {
    return (
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
            {dictionary.rfpTable.view}
          </Link>
        </td>
      </tr>
    );
  }

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <p className="text-sm text-slate-500">
          {(groups
            ? (groups.length === 1
                ? dictionary.rfpTable.totalGroupedOne
                : dictionary.rfpTable.totalGrouped
              ).replace("{groups}", String(groups.length))
            : dictionary.rfpTable.total
          ).replace("{count}", String(rfps.length))}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {dictionary.rfpTable.groupBy}
            <select
              className={selectClass}
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as GroupBy);
                setCollapsed(new Set());
              }}
            >
              {(["none", ...GROUP_OPTIONS] as GroupBy[]).map((option) => (
                <option key={option} value={option}>
                  {groupLabel(option)}
                </option>
              ))}
            </select>
          </label>
          {isDateGroup && (
            <select
              aria-label={dictionary.rfpTable.groupDatePart}
              className={selectClass}
              value={datePart}
              onChange={(e) => {
                setDatePart(e.target.value as DatePart);
                setCollapsed(new Set());
              }}
            >
              <option value="day">{dictionary.rfpTable.byDay}</option>
              <option value="month">{dictionary.rfpTable.byMonth}</option>
              <option value="year">{dictionary.rfpTable.byYear}</option>
            </select>
          )}
        <ColumnSettingsMenu
          defs={defs}
          order={columnPrefs.order}
          hidden={columnPrefs.hidden}
          toggleVisible={columnPrefs.toggleVisible}
          moveColumn={columnPrefs.moveColumn}
          resetPrefs={columnPrefs.resetPrefs}
        />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">
                <div className="flex items-center gap-2">
                  {groups && groups.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllGroups}
                      title={allCollapsed ? dictionary.rfpTable.expandAll : dictionary.rfpTable.collapseAll}
                      aria-label={allCollapsed ? dictionary.rfpTable.expandAll : dictionary.rfpTable.collapseAll}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-xs normal-case text-slate-500 hover:bg-slate-100"
                    >
                      {allCollapsed ? "▸" : "▾"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cycleSort("rfp")}
                    title={dictionary.rfpTable.sortHint}
                    className="uppercase tracking-wide hover:text-slate-800"
                  >
                    {dictionary.rfpTable.rfpColumn}
                    {sortIndicator("rfp")}
                  </button>
                </div>
              </th>
              {columnPrefs.visibleOrderedDefs.map((def) => (
                <ResizableTh
                  key={def.key}
                  width={columnPrefs.widths[def.key]}
                  onResize={(w) => columnPrefs.setWidth(def.key, w)}
                  onSort={() => cycleSort(def.key)}
                  sortHint={dictionary.rfpTable.sortHint}
                >
                  {def.label}
                  {sortIndicator(def.key)}
                </ResizableTh>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups
              ? groups.map((group) => {
                  const isCollapsed = collapsed.has(group.key);
                  return (
                    <Fragment key={group.key || "__empty"}>
                      <tr
                        onClick={() => toggleGroup(group.key)}
                        className="cursor-pointer bg-slate-100/70 hover:bg-slate-100"
                      >
                        <td className="px-5 py-2.5 font-semibold text-slate-700">
                          <span className="mr-2 inline-block w-3 text-slate-400">
                            {isCollapsed ? "▸" : "▾"}
                          </span>
                          {group.label}
                          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            {group.rows.length}
                          </span>
                        </td>
                        {columnPrefs.visibleOrderedDefs.map((def) => (
                          <td key={def.key} className="px-5 py-2.5 text-sm font-semibold text-slate-600">
                            {subtotalContent(def, group)}
                          </td>
                        ))}
                        <td />
                      </tr>
                      {!isCollapsed && group.rows.map(renderRow)}
                    </Fragment>
                  );
                })
              : sortedRfps.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
