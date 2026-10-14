"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { loadPref, useSavePref } from "@/lib/userPrefsClient";
import { useColumnPrefs, type ColumnDef } from "@/lib/useColumnPrefs";
import { ColumnSettingsMenu, ResizableTh } from "@/components/ColumnSettingsMenu";

export type UserRow = {
  id: string;
  name: string;
  client: string;
  email: string;
  company: string;
  plant: string;
  costCenter: string;
  group: string; // role label
  createdAt: string;
  modifiedAt: string;
};

type ColumnKey = "client" | "email" | "company" | "plant" | "costCenter" | "group" | "createdAt" | "modifiedAt";
type GroupBy = "none" | "client" | "company" | "plant" | "costCenter" | "group";

const GROUP_OPTIONS: GroupBy[] = ["client", "company", "plant", "costCenter", "group"];
const GROUPING_KEY = "users-list-grouping";

// The users list: choose which columns to see (and their order) and group the
// rows by client, company, plant, cost center or group.
export function UsersTable({ rows }: { rows: UserRow[] }) {
  const { t, formatDate, formatDateTime } = usePreferences();
  const defs: ColumnDef<ColumnKey>[] = [
    { key: "client", label: t("usersPage.client"), defaultWidth: 160, minWidth: 100 },
    { key: "email", label: t("usersPage.email"), defaultWidth: 220, minWidth: 120 },
    { key: "company", label: t("usersPage.company"), defaultWidth: 120, minWidth: 80 },
    { key: "plant", label: t("usersPage.plant"), defaultWidth: 120, minWidth: 80 },
    { key: "costCenter", label: t("usersPage.costCenter"), defaultWidth: 140, minWidth: 90 },
    { key: "group", label: t("usersPage.group"), defaultWidth: 170, minWidth: 100 },
    { key: "createdAt", label: t("usersPage.createdAt"), defaultWidth: 130, minWidth: 100 },
    { key: "modifiedAt", label: t("usersPage.modifiedAt"), defaultWidth: 160, minWidth: 110 },
  ];
  const columnPrefs = useColumnPrefs("users-list-columns", defs);

  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Loaded after mount so the first client render matches the server's.
  useEffect(() => {
    let cancelled = false;
    loadPref<{ groupBy?: GroupBy }>(GROUPING_KEY).then((saved) => {
      if (cancelled) return;
      if (saved?.groupBy && (saved.groupBy === "none" || GROUP_OPTIONS.includes(saved.groupBy))) {
        setGroupBy(saved.groupBy);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useSavePref(GROUPING_KEY, { groupBy }, loaded);

  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const byKey = new Map<string, UserRow[]>();
    for (const r of rows) {
      const key = r[groupBy];
      byKey.set(key, [...(byKey.get(key) ?? []), r]);
    }
    // Empty value last, the rest alphabetical.
    return [...byKey.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  }, [rows, groupBy]);

  const cell = (def: ColumnDef<ColumnKey>, u: UserRow) => {
    switch (def.key) {
      case "createdAt":
        return formatDate(u.createdAt);
      case "modifiedAt":
        return formatDateTime(u.modifiedAt);
      default:
        return u[def.key] || "—";
    }
  };

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allCollapsed = groups !== null && groups.length > 0 && groups.every(([k]) => collapsed.has(k));

  const visible = columnPrefs.visibleOrderedDefs;
  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50";

  function renderRow(u: UserRow) {
    return (
      <tr key={u.id} className="hover:bg-slate-50">
        <td className="px-5 py-4 font-medium text-slate-800">{u.name}</td>
        {visible.map((def) => (
          <td key={def.key} style={{ width: columnPrefs.widths[def.key] }} className="px-5 py-4 text-slate-600">
            {cell(def, u)}
          </td>
        ))}
        <td className="px-5 py-4 text-right">
          <Link href={`/admin/users/${u.id}`} className="text-sm font-medium text-violet-600 hover:text-violet-700">
            {t("usersPage.edit")}
          </Link>
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <p className="text-sm text-slate-500">
          {(groups ? t("usersPage.totalGrouped").replace("{groups}", String(groups.length)) : t("usersPage.total")).replace(
            "{count}",
            String(rows.length),
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {t("usersPage.groupBy")}
            <select
              className={selectClass}
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as GroupBy);
                setCollapsed(new Set());
              }}
            >
              <option value="none">{t("usersPage.noGrouping")}</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {t(`usersPage.${g}`)}
                </option>
              ))}
            </select>
          </label>
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
                      onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(([k]) => k)))}
                      title={allCollapsed ? t("usersPage.expandAll") : t("usersPage.collapseAll")}
                      aria-label={allCollapsed ? t("usersPage.expandAll") : t("usersPage.collapseAll")}
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-xs normal-case text-slate-500 hover:bg-slate-100"
                    >
                      {allCollapsed ? "▸" : "▾"}
                    </button>
                  )}
                  {t("usersPage.name")}
                </div>
              </th>
              {visible.map((def) => (
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
            {groups
              ? groups.map(([key, list]) => {
                  const isCollapsed = collapsed.has(key);
                  return (
                    <Fragment key={key || "__empty"}>
                      <tr onClick={() => toggleGroup(key)} className="cursor-pointer bg-slate-100/70 hover:bg-slate-100">
                        <td colSpan={visible.length + 2} className="px-5 py-2.5 font-semibold text-slate-700">
                          <span className="mr-2 inline-block w-3 text-slate-400">{isCollapsed ? "▸" : "▾"}</span>
                          {key || t("usersPage.noValue")}
                          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            {list.length}
                          </span>
                        </td>
                      </tr>
                      {!isCollapsed && list.map(renderRow)}
                    </Fragment>
                  );
                })
              : rows.map(renderRow)}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visible.length + 2} className="px-5 py-8 text-center text-slate-500">
                  {t("usersPage.noMatches")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
