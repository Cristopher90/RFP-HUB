"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { TreePickerField } from "@/components/TreePickerField";
import { ViewGroupPicker, type ViewGroupOption } from "@/components/ViewGroupPicker";
import { makeClientKey } from "@/lib/clientKey";
import {
  createLookup,
  deleteLookup,
  renameLookup,
  saveLookupValues,
  type LookupValueInput,
} from "./actions";

type LookupItem = { id: string; name: string; count: number; usedBy: string[] };

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}
const MAX_ROWS_SHOWN = 300;
const SHEET = "Valores";

export function LookupsManager({
  clientId,
  lookups,
  selectedId,
  viewGroups,
  initialValues,
}: {
  clientId: string;
  lookups: LookupItem[];
  selectedId: string | null;
  viewGroups: ViewGroupOption[];
  initialValues: LookupValueInput[];
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [newName, setNewName] = useState("");
  const [renameTo, setRenameTo] = useState(lookups.find((l) => l.id === selectedId)?.name ?? "");
  const [rows, setRows] = useState<LookupValueInput[]>(initialValues);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = lookups.find((l) => l.id === selectedId) ?? null;

  function go(lookupId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (lookupId) params.set("lookupId", lookupId);
    else params.delete("lookupId");
    router.push(`${pathname}?${params.toString()}`);
  }

  function run(action: () => Promise<{ error: string } | { success: true }>, ok?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      else ok?.();
    });
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createLookup(newName, clientId);
      if ("error" in result) setError(result.error);
      else {
        setNewName("");
        go(result.id);
      }
    });
  }

  function patchRow(key: string, p: Partial<LookupValueInput>) {
    setNotice(null);
    setRows((prev) => prev.map((r) => (r.clientKey === key ? { ...r, ...p } : r)));
  }
  function removeRow(key: string) {
    setNotice(null);
    setRows((prev) =>
      prev
        .filter((r) => r.clientKey !== key)
        .map((r) => (r.parentClientKey === key ? { ...r, parentClientKey: null } : r)),
    );
  }
  function descendantsOf(key: string) {
    const out = new Set<string>([key]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of rows) {
        if (r.parentClientKey && out.has(r.parentClientKey) && !out.has(r.clientKey)) {
          out.add(r.clientKey);
          grew = true;
        }
      }
    }
    return out;
  }

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => `${r.code} ${r.description} ${r.descriptionEn}`.toLowerCase().includes(q))
      : rows;
    return list.slice(0, MAX_ROWS_SHOWN);
  }, [rows, filter]);

  function handleExport() {
    const groupName = new Map(viewGroups.map((g) => [g.id, g.name]));
    const codeByKey = new Map(rows.map((r) => [r.clientKey, r.code]));
    const data = rows.map((r) => ({
      ID: r.code,
      Descripcion: r.description,
      DescripcionEN: r.descriptionEn,
      PadreID: r.parentClientKey ? (codeByKey.get(r.parentClientKey) ?? "") : "",
      Grupos: r.viewGroupIds.map((id) => groupName.get(id) ?? "").filter(Boolean).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(
      data.length > 0 ? data : [{ ID: "", Descripcion: "", DescripcionEN: "", PadreID: "", Grupos: "" }],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, SHEET);
    XLSX.writeFile(wb, `${selected?.name ?? "lookup"}.xlsx`);
  }

  async function handleImport(file: File) {
    setError(null);
    setNotice(null);
    try {
      // CSV is read as UTF-8 text (as an array it would be decoded as Latin-1).
      const wb = file.name.toLowerCase().endsWith(".csv")
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[SHEET] ?? wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const norm = (row: Record<string, unknown>, ...names: string[]) => {
        for (const [k, v] of Object.entries(row)) {
          if (names.includes(k.trim().toLowerCase())) return String(v ?? "").trim();
        }
        return "";
      };
      const groupByName = new Map(viewGroups.map((g) => [g.name.trim().toLowerCase(), g.id]));
      const byCode = new Map(rows.map((r) => [r.code.toLowerCase(), r]));
      const next = [...rows];
      const parentCodes = new Map<string, string>();
      let count = 0;
      for (const row of data) {
        const code = norm(row, "id", "codigo", "código", "code");
        if (!code) continue;
        const description = norm(row, "descripcion", "descripción", "description") || code;
        const descriptionEn = norm(row, "descripcionen", "descripción en", "description_en", "en");
        const groups = norm(row, "grupos", "groups")
          .split(",")
          .map((n) => groupByName.get(n.trim().toLowerCase()))
          .filter((id): id is string => Boolean(id));
        parentCodes.set(code.toLowerCase(), norm(row, "padreid", "padre", "parent", "parentid"));
        const existing = byCode.get(code.toLowerCase());
        if (existing) {
          existing.code = code;
          existing.description = description;
          existing.descriptionEn = descriptionEn;
          existing.viewGroupIds = groups;
        } else {
          const created: LookupValueInput = {
            clientKey: makeClientKey(),
            code,
            description,
            descriptionEn,
            parentClientKey: null,
            viewGroupIds: groups,
          };
          byCode.set(code.toLowerCase(), created);
          next.push(created);
        }
        count++;
      }
      for (const [code, parentCode] of parentCodes) {
        const row = byCode.get(code);
        const parent = parentCode ? byCode.get(parentCode.toLowerCase()) : null;
        if (row) row.parentClientKey = parent && parent !== row ? parent.clientKey : null;
      }
      setRows([...next]);
      setNotice(t("lookups.importedRows").replace("{count}", String(count)));
    } catch {
      setError(t("lookups.importError"));
    }
  }

  function handleSave() {
    if (!selected) return;
    run(
      () => saveLookupValues(selected.id, rows, clientId),
      () => {
        setNotice(t("lookups.saved"));
        router.refresh();
      },
    );
  }

  const card = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className={card}>
        <h2 className="text-base font-semibold text-slate-900">{t("lookups.listTitle")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {lookups.length === 0 && <p className="text-sm text-slate-400">{t("lookups.empty")}</p>}
          {lookups.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => go(l.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                l.id === selectedId
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {l.name} <span className="opacity-70">({l.count})</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass()} !w-64`}
            placeholder={t("lookups.newName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            type="button"
            disabled={pending || !newName.trim()}
            onClick={handleCreate}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            + {t("lookups.create")}
          </button>
        </div>
      </div>

      {selected && (
        <div className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">{t("lookups.valuesOf")}</h2>
            <input
              className={`${inputClass()} !w-56`}
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
            />
            <button
              type="button"
              disabled={pending || !renameTo.trim() || renameTo.trim() === selected.name}
              onClick={() => run(() => renameLookup(selected.id, renameTo, clientId), () => router.refresh())}
              className="text-sm font-medium text-violet-600 hover:text-violet-700 disabled:opacity-40"
            >
              {t("lookups.rename")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(t("lookups.confirmDelete").replace("{name}", selected.name))) return;
                run(
                  () => deleteLookup(selected.id, clientId),
                  () => go(null),
                );
              }}
              className="ml-auto text-sm text-red-600 hover:text-red-700"
            >
              {t("lookups.delete")}
            </button>
          </div>
          {selected.usedBy.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {t("lookups.usedBy")} {selected.usedBy.join(", ")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="search"
              className={`${inputClass()} !w-64`}
              placeholder={t("lookups.search")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { clientKey: makeClientKey(), code: "", description: "", descriptionEn: "", parentClientKey: null, viewGroupIds: [] }])}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              + {t("lookups.addValue")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("lookups.importExcel")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t("lookups.exportExcel")}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t("lookups.excelHint")}</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-1.5 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-2 pb-1">{t("lookups.colCode")}</th>
                  <th className="px-2 pb-1">{t("lookups.colEs")}</th>
                  <th className="px-2 pb-1">{t("lookups.colEn")}</th>
                  <th className="px-2 pb-1">{t("lookups.colParent")}</th>
                  {viewGroups.length > 0 && <th className="px-2 pb-1">{t("viewGroups.columnLabel")}</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-sm text-slate-400">
                      {t("lookups.noValues")}
                    </td>
                  </tr>
                )}
                {shown.map((row) => (
                  <tr key={row.clientKey} className="bg-slate-50 align-middle">
                    <td className="rounded-l-lg px-2 py-1.5">
                      <input
                        className={`${inputClass()} !w-32 font-mono`}
                        value={row.code}
                        onChange={(e) => patchRow(row.clientKey, { code: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={inputClass()}
                        value={row.description}
                        onChange={(e) => patchRow(row.clientKey, { description: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={inputClass()}
                        value={row.descriptionEn}
                        onChange={(e) => patchRow(row.clientKey, { descriptionEn: e.target.value })}
                      />
                    </td>
                    <td className="min-w-[10rem] px-2 py-1.5">
                      <TreePickerField
                        nodes={rows
                          .filter((r) => !descendantsOf(row.clientKey).has(r.clientKey))
                          .map((r) => ({
                            id: r.clientKey,
                            parentId: r.parentClientKey,
                            label: r.description || r.code || "—",
                            code: r.code,
                          }))}
                        valueId={row.parentClientKey}
                        onChangeId={(id) => patchRow(row.clientKey, { parentClientKey: id })}
                        placeholder={t("lookups.noParent")}
                        clearLabel={t("lookups.noParent")}
                      />
                    </td>
                    {viewGroups.length > 0 && (
                      <td className="min-w-[10rem] px-2 py-1.5">
                        <ViewGroupPicker
                          compact
                          groups={viewGroups}
                          value={row.viewGroupIds}
                          onChange={(next) => patchRow(row.clientKey, { viewGroupIds: next })}
                        />
                      </td>
                    )}
                    <td className="rounded-r-lg px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.clientKey)}
                        className="text-sm text-slate-400 hover:text-red-600"
                      >
                        {t("lookups.remove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > MAX_ROWS_SHOWN && (
            <p className="mt-2 text-xs text-slate-400">
              {t("lookups.firstRows").replace("{count}", String(MAX_ROWS_SHOWN)).replace("{total}", String(rows.length))}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {pending ? t("lookups.saving") : t("lookups.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
