"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadPref, useSavePref } from "@/lib/userPrefsClient";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  deleteSystemRow,
  loadRowRelations,
  previewDelete,
  updateSystemRow,
  type DeletePreview,
  type RelationsView,
} from "../actions";

export type GridColumn = {
  name: string;
  kind: "text" | "int" | "float" | "boolean" | "timestamp" | "json" | "enum" | "array";
  nullable: boolean;
  enumValues: string[];
  editable: boolean;
};

// One row: `shown` for the table cell, `edit` the raw value for the form (null = SQL NULL).
export type GridRow = { id: string; shown: Record<string, string>; edit: Record<string, string | null> };

function inputClass() {
  return "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-500";
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-10" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

const RULE_STYLE: Record<string, string> = {
  cascade: "bg-red-100 text-red-700",
  setnull: "bg-amber-100 text-amber-700",
  restrict: "bg-slate-200 text-slate-700",
  default: "bg-amber-100 text-amber-700",
};

function RelationsPanel({ relations }: { relations: RelationsView | null }) {
  const { t } = usePreferences();
  if (!relations) return <p className="text-xs text-slate-400">{t("systemTableEditor.loadingRelations")}</p>;
  if (relations.children.length === 0 && relations.parents.length === 0) {
    return <p className="text-xs text-slate-400">{t("systemTableEditor.noRelations")}</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {relations.parents.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{t("systemTableEditor.pointsTo")}</p>
          <ul className="space-y-1">
            {relations.parents.map((p) => (
              <li key={`${p.table}${p.viaColumn}`} className="flex flex-wrap items-center gap-2">
                <span className="text-slate-600">
                  {p.viaColumn} →
                </span>
                {p.tableKey ? (
                  <Link
                    href={`/admin/system-tables/${p.tableKey}?filter=${encodeURIComponent(`${p.column}:${p.value}`)}`}
                    className="font-medium text-violet-600 hover:text-violet-700"
                  >
                    {p.table}
                  </Link>
                ) : (
                  <span>{p.table}</span>
                )}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{p.value}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {relations.children.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{t("systemTableEditor.usedBy")}</p>
          <ul className="space-y-1">
            {relations.children.map((c) => (
              <li key={`${c.table}${c.column}`} className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-slate-700">{c.count}</span>
                {c.tableKey ? (
                  <Link
                    href={`/admin/system-tables/${c.tableKey}?filter=${encodeURIComponent(`${c.column}:__ID__`)}`}
                    data-relation-link
                    className="font-medium text-violet-600 hover:text-violet-700"
                  >
                    {c.table}.{c.column}
                  </Link>
                ) : (
                  <span>
                    {c.table}.{c.column}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${RULE_STYLE[c.rule]}`}>
                  {t(`systemTableEditor.rule_${c.rule}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EditDialog({
  tableKey,
  columns,
  row,
  onClose,
}: {
  tableKey: string;
  columns: GridColumn[];
  row: GridRow;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const [values, setValues] = useState<Record<string, string | null>>(row.edit);
  const [relations, setRelations] = useState<RelationsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    loadRowRelations(tableKey, row.id).then((r) => {
      if (!cancelled && "ok" in r) setRelations(r);
    });
    return () => {
      cancelled = true;
    };
  }, [tableKey, row.id]);

  const changed = Object.fromEntries(
    columns.filter((c) => c.editable && values[c.name] !== row.edit[c.name]).map((c) => [c.name, values[c.name]]),
  );
  const changedCount = Object.keys(changed).length;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSystemRow(tableKey, row.id, changed);
      if ("error" in result) setError(result.error);
      else onClose();
    });
  }

  function field(col: GridColumn) {
    const value = values[col.name];
    const set = (v: string | null) => setValues((prev) => ({ ...prev, [col.name]: v }));
    if (!col.editable) return <input className={inputClass()} value={value ?? ""} disabled readOnly />;
    if (value === null) return <input className={inputClass()} value="" placeholder="NULL" disabled />;
    if (col.kind === "boolean") {
      return (
        <select className={inputClass()} value={value} onChange={(e) => set(e.target.value)}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }
    if (col.kind === "enum") {
      return (
        <select className={inputClass()} value={value} onChange={(e) => set(e.target.value)}>
          {col.enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );
    }
    if (col.kind === "json" || value.length > 80 || value.includes("\n")) {
      return <textarea className={inputClass()} rows={4} value={value} onChange={(e) => set(e.target.value)} />;
    }
    return <input className={inputClass()} value={value} onChange={(e) => set(e.target.value)} />;
  }

  return (
    <Modal title={`${t("systemTableEditor.editRow")} · ${row.id}`} onClose={onClose}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">{t("systemTableEditor.relations")}</p>
          <RelationsPanelWithId relations={relations} id={row.id} />
        </div>
        <p className="text-xs text-amber-700">{t("systemTableEditor.editWarning")}</p>
        <div className="space-y-3">
          {columns.map((col) => (
            <div key={col.name}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">
                  {col.name} <span className="font-normal text-slate-400">({col.kind}{col.kind === "array" ? ", a,b,c" : ""})</span>
                </label>
                {col.editable && col.nullable && (
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={values[col.name] === null}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [col.name]: e.target.checked ? null : (row.edit[col.name] ?? "") }))
                      }
                    />
                    NULL
                  </label>
                )}
              </div>
              {field(col)}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
        <span className="text-xs text-slate-500">
          {changedCount} {t("systemTableEditor.changedFields")}
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            {t("systemTableEditor.cancel")}
          </button>
          <button
            type="button"
            disabled={pending || changedCount === 0}
            onClick={save}
            className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {pending ? t("systemTableEditor.saving") : t("systemTableEditor.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Relation links to child tables carry the row id as the filter value.
function RelationsPanelWithId({ relations, id }: { relations: RelationsView | null; id: string }) {
  if (!relations) return <RelationsPanel relations={null} />;
  // Child links are built with a placeholder; substitute this row's id.
  return (
    <div
      ref={(el) => {
        el?.querySelectorAll<HTMLAnchorElement>("a[data-relation-link]").forEach((a) => {
          a.href = a.href.replace("__ID__", encodeURIComponent(id));
        });
      }}
    >
      <RelationsPanel relations={relations} />
    </div>
  );
}

function DeleteDialog({ tableKey, row, onClose }: { tableKey: string; row: GridRow; onClose: () => void }) {
  const { t } = usePreferences();
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    previewDelete(tableKey, row.id).then((r) => {
      if (cancelled) return;
      if ("error" in r) setError(r.error);
      else setPreview(r);
    });
    return () => {
      cancelled = true;
    };
  }, [tableKey, row.id]);

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSystemRow(tableKey, row.id);
      if ("success" in result) onClose();
      else {
        if (result.preview) setPreview(result.preview);
        setError(result.error === "blocked" ? t("systemTableEditor.blockedError") : result.error);
      }
    });
  }

  const blocked = (preview?.blockers.length ?? 0) > 0;
  const own = preview?.protectedReason === "own-user";

  return (
    <Modal title={`${t("systemTableEditor.deleteRow")} · ${row.id}`} onClose={onClose}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</div>}
        {!preview && !error && <p className="text-slate-400">{t("systemTableEditor.analyzing")}</p>}
        {own && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{t("systemTableEditor.ownUser")}</p>}
        {preview && (
          <>
            {blocked && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="font-medium text-red-800">{t("systemTableEditor.blockedTitle")}</p>
                <ul className="mt-2 space-y-1">
                  {preview.blockers.map((b) => (
                    <li key={`${b.table}${b.column}`} className="flex flex-wrap items-center gap-2 text-red-900">
                      <span className="tabular-nums">{b.count}</span>
                      <span>
                        {b.table}.{b.column}
                      </span>
                      {b.tableKey &&
                        b.sampleIds.map((sid) => (
                          <Link
                            key={sid}
                            href={`/admin/system-tables/${b.tableKey}?filter=${encodeURIComponent(`id:${sid}`)}`}
                            className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
                          >
                            {sid.slice(0, 10)}… →
                          </Link>
                        ))}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-red-700">{t("systemTableEditor.blockedHint")}</p>
              </div>
            )}
            {preview.cascades.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="font-medium text-amber-900">{t("systemTableEditor.cascadeTitle")}</p>
                <ul className="mt-1 list-disc pl-5 text-amber-900">
                  {preview.cascades.map((c) => (
                    <li key={c.table}>
                      {c.count} · {c.table}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview.setNull.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-800">{t("systemTableEditor.setNullTitle")}</p>
                <ul className="mt-1 list-disc pl-5 text-slate-700">
                  {preview.setNull.map((s) => (
                    <li key={s.target}>
                      {s.count} · {s.target}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!blocked && preview.cascades.length === 0 && preview.setNull.length === 0 && (
              <p className="text-slate-600">{t("systemTableEditor.noImpact")}</p>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          {t("systemTableEditor.cancel")}
        </button>
        <button
          type="button"
          disabled={pending || !preview || blocked || own}
          onClick={confirmDelete}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? t("systemTableEditor.deleting") : t("systemTableEditor.confirmDelete")}
        </button>
      </div>
    </Modal>
  );
}

// Page size (50 / 100 / no limit) and page navigation, kept in the URL.
function GridPagination({ pagination }: { pagination: { page: number; pageCount: number; pageSize: number | "all"; total: number } }) {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { page, pageCount, pageSize, total } = pagination;
  if (total === 0) return null;

  function go(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const start = pageSize === "all" ? 1 : (page - 1) * pageSize + 1;
  const end = pageSize === "all" ? total : Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
      <span>
        {t("pagination.showing")} {start}–{end} {t("pagination.of")} {total}
      </span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          {t("pagination.show")}
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={String(pageSize)}
            onChange={(e) => go({ size: e.target.value === "50" ? null : e.target.value, page: null })}
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">{t("systemTableEditor.noLimit")}</option>
          </select>
        </label>
        {pageSize !== "all" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go({ page: page - 1 <= 1 ? null : String(page - 1) })}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              {t("pagination.previous")}
            </button>
            <span className="px-1">
              {t("pagination.page")} {page} {t("pagination.pageOf")} {pageCount}
            </span>
            <button
              type="button"
              onClick={() => go({ page: String(page + 1) })}
              disabled={page >= pageCount}
              className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              {t("pagination.next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Text box that pushes its value into a URL param after a short pause.
function DebouncedParamInput({
  param,
  value,
  placeholder,
  className,
}: {
  param: string;
  value: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(value);
  const applied = useRef(value);
  useEffect(() => {
    if (value !== applied.current) {
      applied.current = value;
      setText(value); // changed from outside (e.g. "clear filters")
    }
  }, [value]);
  useEffect(() => {
    if (text.trim() === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = text.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (text.trim()) params.set(param, text.trim());
      else params.delete(param);
      params.delete("page"); // a new filter starts from the first page
      router.push(`${pathname}?${params.toString()}`);
    }, 500);
    return () => clearTimeout(timer);
    // searchParams/router change every render; only the typed text should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={className} />;
}

export function SystemTableGrid({
  tableKey,
  columns,
  rows,
  editable,
  search,
  columnFilters,
  emptyText,
  pagination,
}: {
  tableKey: string;
  columns: GridColumn[];
  rows: GridRow[];
  editable: boolean;
  search: string;
  columnFilters: Record<string, string>;
  emptyText: string;
  pagination: { page: number; pageCount: number; pageSize: number | "all"; total: number };
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<GridRow | null>(null);
  const [deleting, setDeleting] = useState<GridRow | null>(null);

  // Which columns are shown is remembered per table for this user.
  const prefKey = `system-table-cols:${tableKey}`;
  const [hidden, setHidden] = useState<string[]>([]);
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadPref<string[]>(prefKey).then((saved) => {
      if (cancelled) return;
      if (Array.isArray(saved)) setHidden(saved.filter((c) => columns.some((col) => col.name === c)));
      setPrefLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Columns are fixed for a given table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefKey]);
  useSavePref(prefKey, hidden, prefLoaded);
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const visible = columns.filter((c) => !hidden.includes(c.name));
  const hiddenWithFilter = Object.keys(columnFilters).filter((name) => hidden.includes(name));
  const hasFilters = Boolean(search) || Object.keys(columnFilters).length > 0;
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [...params.keys()]) if (key === "q" || key.startsWith("f_")) params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }
  function removeFilter(name: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(`f_${name}`);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }
  function toggleColumn(name: string) {
    setHidden((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <DebouncedParamInput param="q" value={search} placeholder={t("systemTableEditor.searchAll")} className={`${field} w-full sm:w-72`} />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            {t("systemTableEditor.columns")} ({visible.length}/{columns.length}) ▾
          </button>
          {menuOpen && (
            <div className="absolute left-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <div className="mb-1 flex gap-3 px-2 text-xs">
                <button type="button" onClick={() => setHidden([])} className="font-medium text-violet-600 hover:text-violet-700">
                  {t("systemTableEditor.showAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setHidden(columns.slice(1).map((c) => c.name))}
                  className="text-slate-500 hover:text-slate-700"
                >
                  {t("systemTableEditor.keepOnlyFirst")}
                </button>
              </div>
              {columns.map((c) => (
                <label key={c.name} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={!hidden.includes(c.name)} onChange={() => toggleColumn(c.name)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
        {hasFilters && (
          <button type="button" onClick={clearAll} className="text-sm font-medium text-violet-600 hover:text-violet-700">
            {t("systemTableEditor.clearFilters")}
          </button>
        )}
        {hiddenWithFilter.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-800">
            {name}: {columnFilters[name]}
            <button type="button" onClick={() => removeFilter(name)} aria-label="remove" className="font-bold">
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-left font-medium uppercase tracking-wide text-slate-500">
            <tr>
              {editable && <th className="px-3 py-2" />}
              {visible.map((c) => (
                <th key={c.name} className="whitespace-nowrap px-3 py-2">
                  {c.name}
                </th>
              ))}
            </tr>
            <tr className="normal-case">
              {editable && <th className="px-3 pb-2" />}
              {visible.map((c) => (
                <th key={c.name} className="px-3 pb-2 font-normal">
                  <DebouncedParamInput
                    param={`f_${c.name}`}
                    value={columnFilters[c.name] ?? ""}
                    placeholder={t("systemTableEditor.filterPlaceholder")}
                    className="w-full min-w-[6rem] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-violet-500 focus:outline-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={visible.length + (editable ? 1 : 0)} className="p-6 text-center text-sm text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {editable && (
                  <td className="whitespace-nowrap px-3 py-2">
                    <button type="button" onClick={() => setEditing(row)} className="mr-3 font-medium text-violet-600 hover:text-violet-700">
                      {t("systemTableEditor.edit")}
                    </button>
                    <button type="button" onClick={() => setDeleting(row)} className="font-medium text-red-600 hover:text-red-700">
                      {t("systemTableEditor.delete")}
                    </button>
                  </td>
                )}
                {visible.map((c) => (
                  <td key={c.name} title={row.shown[c.name]} className="max-w-xs truncate whitespace-nowrap px-3 py-2 text-slate-600">
                    {row.shown[c.name]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GridPagination pagination={pagination} />
      {editing && <EditDialog tableKey={tableKey} columns={columns} row={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteDialog tableKey={tableKey} row={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
