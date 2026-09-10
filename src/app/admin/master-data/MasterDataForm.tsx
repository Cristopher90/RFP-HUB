"use client";

import { useRef, useState, useTransition } from "react";
import {
  saveMasterDataList,
  clearMasterDataTable,
  type MasterDataItemInput,
} from "./actions";
import { parseMasterDataExcelFile } from "./masterDataImport";
import { downloadMasterDataExcel } from "./masterDataExport";
import { buildTreeOrder } from "@/lib/masterDataTree";
import { makeClientKey } from "@/lib/clientKey";
import { TreePickerField } from "@/components/TreePickerField";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useColumnPrefs, type ColumnDef } from "@/lib/useColumnPrefs";
import {
  ColumnSettingsMenu,
  ResizableTh,
} from "@/components/ColumnSettingsMenu";
import { PaginationBar, usePagination } from "@/components/Pagination";
import { useClearTableAction } from "@/lib/useClearTableAction";
import type { MasterDataKind } from "@/lib/masterDataSchema";

type ColumnKey = "code" | "description" | "parent" | "selectable";

const COLUMN_DEFS: ColumnDef<ColumnKey>[] = [
  { key: "code", label: "Código", defaultWidth: 140, minWidth: 90 },
  { key: "description", label: "Descripción", defaultWidth: 320, minWidth: 140 },
  { key: "parent", label: "Padre", defaultWidth: 280, minWidth: 160 },
];

// Solo "commodity" tiene esta columna: si un nivel del árbol es un valor
// elegible en una RFP/plantilla, o solo sirve para agrupar sus hijos (para
// armar una jerarquía donde, por ejemplo, solo el último nivel es
// seleccionable).
const SELECTABLE_COLUMN_DEF: ColumnDef<ColumnKey> = {
  key: "selectable",
  label: "Seleccionable en RFP",
  defaultWidth: 160,
  minWidth: 120,
};

function emptyRow(): MasterDataItemInput {
  return {
    clientKey: makeClientKey(),
    code: "",
    description: "",
    parentClientKey: null,
    selectable: true,
  };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function MasterDataForm({
  kind,
  label,
  initial,
  targetClientId,
  isSuperAdmin = false,
}: {
  kind: MasterDataKind;
  label: string;
  initial: MasterDataItemInput[];
  targetClientId?: string;
  isSuperAdmin?: boolean;
}) {
  const [rows, setRows] = useState<MasterDataItemInput[]>(
    initial.length > 0 ? initial : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const deleteImportInputRef = useRef<HTMLInputElement>(null);
  const [deleteImporting, setDeleteImporting] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const clearTable = useClearTableAction(() =>
    clearMasterDataTable(kind, targetClientId),
  );

  const columnDefs =
    kind === "commodity" ? [...COLUMN_DEFS, SELECTABLE_COLUMN_DEF] : COLUMN_DEFS;
  const columnPrefs = useColumnPrefs(`masterdata-columns-${kind}`, columnDefs);

  function updateRow(clientKey: string, patch: Partial<MasterDataItemInput>) {
    setSuccess(false);
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
  }

  function removeRow(clientKey: string) {
    setSuccess(false);
    setRows((prev) =>
      prev
        .filter((r) => r.clientKey !== clientKey)
        .map((r) =>
          r.parentClientKey === clientKey
            ? { ...r, parentClientKey: null }
            : r,
        ),
    );
    setEditingKeys((prev) => {
      const next = new Set(prev);
      next.delete(clientKey);
      return next;
    });
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(clientKey);
      return next;
    });
  }

  function removeRows(clientKeys: Set<string>) {
    setSuccess(false);
    setRows((prev) => {
      const kept = prev
        .filter((r) => !clientKeys.has(r.clientKey))
        .map((r) =>
          r.parentClientKey && clientKeys.has(r.parentClientKey)
            ? { ...r, parentClientKey: null }
            : r,
        );
      return kept.length > 0 ? kept : [emptyRow()];
    });
    setSelectedKeys(new Set());
  }

  function toggleSelected(clientKey: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(clientKey)) next.delete(clientKey);
      else next.add(clientKey);
      return next;
    });
  }

  function toggleSelectPage() {
    const pageKeys = pagedTree.map(({ item }) => item.row.clientKey);
    const allSelected = pageKeys.every((k) => selectedKeys.has(k));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function toggleEditing(clientKey: string) {
    setEditingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(clientKey)) next.delete(clientKey);
      else next.add(clientKey);
      return next;
    });
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const imported = await parseMasterDataExcelFile(file);
      if (imported.length === 0) {
        setImportError(
          "No se encontraron filas con columnas 'ID' y 'Descripcion'.",
        );
        return;
      }
      setSuccess(false);
      setRows((prev) => {
        const kept = prev.filter(
          (r) => r.code.trim().length > 0 || r.description.trim().length > 0,
        );
        // Parent references in the file are by code (ID), since a fresh
        // import can't know another row's internal clientKey — resolve
        // against both the rows already in the editor and the newly
        // imported ones.
        const codeToKey = new Map<string, string>();
        for (const r of kept) codeToKey.set(r.code.toLowerCase(), r.clientKey);
        for (const r of imported)
          codeToKey.set(r.code.toLowerCase(), r.clientKey);
        const withParents: MasterDataItemInput[] = imported.map((r) => ({
          clientKey: r.clientKey,
          code: r.code,
          description: r.description,
          parentClientKey: r.parentCode
            ? (codeToKey.get(r.parentCode.toLowerCase()) ?? null)
            : null,
        }));
        return [...kept, ...withParents];
      });
    } catch {
      setImportError("No se pudo leer el archivo. Verifica que sea un .xlsx.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  // Segundo modo de importación: en vez de agregar/actualizar, borra (de
  // la lista local, pendiente de "Guardar cambios") las filas cuyo código
  // coincida con alguno del archivo — para dar de baja en lote sin tener
  // que tildarlas una por una.
  async function handleDeleteImportExcel(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setDeleteImporting(true);
    try {
      const imported = await parseMasterDataExcelFile(file);
      if (imported.length === 0) {
        setImportError(
          "No se encontraron filas con columnas 'ID' y 'Descripcion'.",
        );
        return;
      }
      const codesToDelete = new Set(
        imported.map((r) => r.code.toLowerCase()),
      );
      removeRows(
        new Set(
          rows
            .filter((r) => codesToDelete.has(r.code.toLowerCase()))
            .map((r) => r.clientKey),
        ),
      );
    } catch {
      setImportError("No se pudo leer el archivo. Verifica que sea un .xlsx.");
    } finally {
      setDeleteImporting(false);
      if (deleteImportInputRef.current) deleteImportInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveMasterDataList(kind, rows, targetClientId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  const treeOrder = buildTreeOrder(
    rows.map((r) => ({ id: r.clientKey, parentId: r.parentClientKey, row: r })),
  );

  // A row can't become its own ancestor: exclude itself and its whole
  // subtree from the "Padre" picker's options.
  function descendantsOf(clientKey: string): Set<string> {
    const result = new Set<string>([clientKey]);
    let added = true;
    while (added) {
      added = false;
      for (const r of rows) {
        if (
          r.parentClientKey &&
          result.has(r.parentClientKey) &&
          !result.has(r.clientKey)
        ) {
          result.add(r.clientKey);
          added = true;
        }
      }
    }
    return result;
  }

  function parentLabel(row: MasterDataItemInput): string {
    if (!row.parentClientKey) return "—";
    const parent = rows.find((r) => r.clientKey === row.parentClientKey);
    return parent ? parent.description || parent.code || "(sin nombre)" : "—";
  }

  const filteredTree = treeOrder.filter(({ item }) => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.row.code.toLowerCase().includes(q) ||
      item.row.description.toLowerCase().includes(q)
    );
  });
  const pagination = usePagination(filteredTree.length);
  const pagedTree = filteredTree.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Cambios guardados.
        </div>
      )}
      {clearTable.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {clearTable.error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Cargar {label.toLowerCase()} desde Excel
          </p>
          <p className="text-xs text-slate-400">
            Archivo con columnas &quot;ID&quot;, &quot;Descripcion&quot; y
            &quot;PadreID&quot; (opcional, ID de otra fila). Se agrega a lo
            que ya tengas.
          </p>
          {importError && (
            <p className="mt-1 text-xs text-red-600">{importError}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadMasterDataExcel(`${label}.xlsx`, rows)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Exportar Excel
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {importing ? "Importando..." : "Importar Excel"}
          </button>
          <input
            ref={deleteImportInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleDeleteImportExcel}
          />
          <button
            type="button"
            disabled={deleteImporting}
            onClick={() => deleteImportInputRef.current?.click()}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleteImporting ? "Borrando..." : "Importar para borrar"}
          </button>
        </div>
      </div>

      <CollapsibleSection
        title={label}
        storageKey={`masterdata-section-${kind}`}
        right={
          <div className="flex items-center gap-3">
            <ColumnSettingsMenu
              defs={columnDefs}
              order={columnPrefs.order}
              hidden={columnPrefs.hidden}
              toggleVisible={columnPrefs.toggleVisible}
              moveColumn={columnPrefs.moveColumn}
              resetPrefs={columnPrefs.resetPrefs}
            />
            {selectedKeys.size > 0 && (
              <button
                type="button"
                onClick={() => removeRows(selectedKeys)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Borrar seleccionados ({selectedKeys.size})
              </button>
            )}
            {isSuperAdmin && (
              <button
                type="button"
                disabled={clearTable.pending}
                onClick={() =>
                  clearTable.run(
                    `Esto borra TODOS los registros de "${label}" de este cliente de forma permanente. ¿Continuar?`,
                    () => {
                      setRows([emptyRow()]);
                      setSelectedKeys(new Set());
                      setSuccess(false);
                    },
                  )
                }
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {clearTable.pending ? "Borrando..." : "Borrar tabla"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const row = emptyRow();
                setRows((prev) => [...prev, row]);
                setEditingKeys((prev) => new Set(prev).add(row.clientKey));
              }}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar
            </button>
          </div>
        }
      >
        <div>
          <input
            className={inputClass()}
            placeholder="Buscar por ID o descripción..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="w-8 px-3 pb-1">
                  <input
                    type="checkbox"
                    checked={
                      pagedTree.length > 0 &&
                      pagedTree.every(({ item }) =>
                        selectedKeys.has(item.row.clientKey),
                      )
                    }
                    onChange={toggleSelectPage}
                  />
                </th>
                {columnPrefs.visibleOrderedDefs.map((def) => (
                  <ResizableTh
                    key={def.key}
                    width={columnPrefs.widths[def.key]}
                    onResize={(w) => columnPrefs.setWidth(def.key, w)}
                  >
                    {def.label}
                  </ResizableTh>
                ))}
                <th className="w-32 px-3 pb-1" />
              </tr>
            </thead>
            <tbody>
              {pagedTree.map(({ item, depth }) => {
                  const row = item.row;
                  const isEditing = editingKeys.has(row.clientKey);
                  return (
                    <tr
                      key={row.clientKey}
                      className="rounded-lg bg-slate-50 align-middle"
                    >
                      <td className="rounded-l-lg px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.clientKey)}
                          onChange={() => toggleSelected(row.clientKey)}
                        />
                      </td>
                      {columnPrefs.visibleOrderedDefs.map((def) => (
                        <td
                          key={def.key}
                          style={{ width: columnPrefs.widths[def.key] }}
                          className="px-3 py-2"
                        >
                          {def.key === "code" &&
                            (isEditing ? (
                              <input
                                className={inputClass()}
                                placeholder="ID (ej. HW-IT)"
                                value={row.code}
                                onChange={(e) =>
                                  updateRow(row.clientKey, {
                                    code: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <span className="text-slate-700">
                                {row.code || "—"}
                              </span>
                            ))}
                          {def.key === "description" &&
                            (isEditing ? (
                              <div
                                style={{
                                  marginLeft:
                                    depth > 0 ? `${depth * 1.5}rem` : undefined,
                                }}
                              >
                                <input
                                  className={inputClass()}
                                  placeholder="Descripción (ej. Hardware / IT)"
                                  value={row.description}
                                  onChange={(e) =>
                                    updateRow(row.clientKey, {
                                      description: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              <span
                                style={{
                                  marginLeft:
                                    depth > 0 ? `${depth * 1.5}rem` : undefined,
                                }}
                                className="text-slate-700"
                              >
                                {row.description || "—"}
                              </span>
                            ))}
                          {def.key === "parent" &&
                            (isEditing ? (
                              <TreePickerField
                                nodes={rows
                                  .filter(
                                    (r) =>
                                      !descendantsOf(row.clientKey).has(
                                        r.clientKey,
                                      ),
                                  )
                                  .map((r) => ({
                                    id: r.clientKey,
                                    parentId: r.parentClientKey,
                                    label:
                                      r.description || r.code || "(sin nombre)",
                                    code: r.code,
                                  }))}
                                valueId={row.parentClientKey}
                                onChangeId={(id) =>
                                  updateRow(row.clientKey, {
                                    parentClientKey: id,
                                  })
                                }
                                placeholder="— Sin padre (raíz) —"
                                clearLabel="— Sin padre (raíz) —"
                              />
                            ) : (
                              <span className="text-slate-500">
                                {parentLabel(row)}
                              </span>
                            ))}
                          {def.key === "selectable" && (
                            <input
                              type="checkbox"
                              disabled={!isEditing}
                              checked={row.selectable ?? true}
                              onChange={(e) =>
                                updateRow(row.clientKey, {
                                  selectable: e.target.checked,
                                })
                              }
                            />
                          )}
                        </td>
                      ))}
                      <td className="rounded-r-lg px-3 py-2 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => toggleEditing(row.clientKey)}
                            className="text-sm font-medium text-violet-600 hover:text-violet-700"
                          >
                            {isEditing ? "Listo" : "Editar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(row.clientKey)}
                            disabled={rows.length === 1}
                            className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                          >
                            Quitar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={filteredTree.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </CollapsibleSection>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
