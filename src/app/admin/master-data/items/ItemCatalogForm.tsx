"use client";

import { useRef, useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import { TreePickerField } from "@/components/TreePickerField";
import {
  saveItemCatalog,
  clearItemCatalog,
  type ItemCatalogItemInput,
} from "./actions";
import { parseItemCatalogExcelFile } from "./itemCatalogImport";
import { downloadItemCatalogExcel } from "./itemCatalogExport";
import { PaginationBar, usePagination } from "@/components/Pagination";
import { useClearTableAction } from "@/lib/useClearTableAction";

function emptyRow(): ItemCatalogItemInput {
  return {
    clientKey: makeClientKey(),
    catalogName: "",
    code: "",
    name: "",
    description: "",
    unit: "unidad",
    commodity: "",
    lastPrice: "",
  };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function smallInputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function ItemCatalogForm({
  initial,
  commodities,
  targetClientId,
  isSuperAdmin = false,
}: {
  initial: ItemCatalogItemInput[];
  targetClientId?: string;
  isSuperAdmin?: boolean;
  commodities: {
    id: string;
    parentId: string | null;
    code: string;
    description: string;
  }[];
}) {
  const [rows, setRows] = useState<ItemCatalogItemInput[]>(
    initial.length > 0 ? initial : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const [filterQuery, setFilterQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const deleteImportInputRef = useRef<HTMLInputElement>(null);
  const [deleteImporting, setDeleteImporting] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const clearTable = useClearTableAction(() => clearItemCatalog(targetClientId));

  function removeRows(clientKeys: Set<string>) {
    setSuccess(false);
    setRows((prev) => {
      const next = prev.filter((r) => !clientKeys.has(r.clientKey));
      return next.length > 0 ? next : [emptyRow()];
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
    const pageKeys = pagedRows.map((r) => r.clientKey);
    const allSelected = pageKeys.every((k) => selectedKeys.has(k));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) pageKeys.forEach((k) => next.delete(k));
      else pageKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const imported = await parseItemCatalogExcelFile(file);
      if (imported.length === 0) {
        setImportError("No se encontraron filas con las columnas esperadas.");
        return;
      }
      setSuccess(false);
      setRows((prev) => {
        const kept = prev.filter(
          (r) => r.catalogName.trim().length > 0 || r.code.trim().length > 0,
        );
        // El Excel puede traer el código del commodity en vez del nombre
        // completo — alcanza con que coincida con uno u otro, y se guarda
        // siempre la descripción (así queda igual que si se hubiera
        // elegido a mano con el selector).
        const resolved = imported.map((r) => {
          if (!r.commodity) return r;
          const match = commodities.find(
            (c) =>
              c.code.toLowerCase() === r.commodity.toLowerCase() ||
              c.description.toLowerCase() === r.commodity.toLowerCase(),
          );
          return match ? { ...r, commodity: match.description } : r;
        });
        return [...kept, ...resolved];
      });
    } catch {
      setImportError("No se pudo leer el archivo. Verifica que sea un .xlsx.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  // Segundo modo de importación: borra (de la lista local, pendiente de
  // "Guardar cambios") las filas cuyo catálogo+código coincidan con
  // alguno del archivo — misma clave que usa el guardado para detectar
  // duplicados — en vez de agregarlas.
  async function handleDeleteImportExcel(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setDeleteImporting(true);
    try {
      const imported = await parseItemCatalogExcelFile(file);
      if (imported.length === 0) {
        setImportError("No se encontraron filas con las columnas esperadas.");
        return;
      }
      const keysToDelete = new Set(
        imported.map(
          (r) => `${r.catalogName.toLowerCase()}::${r.code.toLowerCase()}`,
        ),
      );
      removeRows(
        new Set(
          rows
            .filter((r) =>
              keysToDelete.has(
                `${r.catalogName.toLowerCase()}::${r.code.toLowerCase()}`,
              ),
            )
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

  function updateRow(clientKey: string, patch: Partial<ItemCatalogItemInput>) {
    setSuccess(false);
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveItemCatalog(rows, targetClientId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  const q = filterQuery.trim().toLowerCase();
  const filteredRows = rows.filter((r) => {
    if (!q) return true;
    return (
      r.catalogName.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.unit.toLowerCase().includes(q) ||
      r.commodity.toLowerCase().includes(q)
    );
  });
  const pagination = usePagination(filteredRows.length);
  const pagedRows = filteredRows.slice(
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
            Cargar catálogo desde Excel
          </p>
          <p className="text-xs text-slate-400">
            Columnas: Catalogo, Codigo, Articulo, Descripcion, Unidad,
            Commodity, UltimoPrecio. Se agrega a lo que ya tengas.
          </p>
          {importError && (
            <p className="mt-1 text-xs text-red-600">{importError}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadItemCatalogExcel("Catalogo-articulos.xlsx", rows)}
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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Catálogo de artículos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Se actualiza solo con el precio adjudicado cada vez que se
              adjudica una RFP. También puedes agregar o corregir entradas a
              mano.
            </p>
          </div>
          <div className="flex items-center gap-3">
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
                    "Esto borra TODO el catálogo de artículos de este cliente de forma permanente. ¿Continuar?",
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
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar
            </button>
          </div>
        </div>

        <div className="mt-4">
          <input
            className={inputClass()}
            placeholder="Buscar por catálogo, código, artículo, descripción, unidad o commodity..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="w-8 px-3 pb-1">
                  <input
                    type="checkbox"
                    checked={
                      pagedRows.length > 0 &&
                      pagedRows.every((r) => selectedKeys.has(r.clientKey))
                    }
                    onChange={toggleSelectPage}
                  />
                </th>
                <th className="px-3 pb-1">Catálogo</th>
                <th className="px-3 pb-1">Código</th>
                <th className="px-3 pb-1">Artículo</th>
                <th className="px-3 pb-1">Descripción</th>
                <th className="px-3 pb-1">Unidad</th>
                <th className="px-3 pb-1">Commodity</th>
                <th className="px-3 pb-1">Último precio</th>
                <th className="w-16 px-3 pb-1" />
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.clientKey} className="rounded-lg bg-slate-50 align-middle">
                  <td className="rounded-l-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row.clientKey)}
                      onChange={() => toggleSelected(row.clientKey)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={smallInputClass()}
                      value={row.catalogName}
                      onChange={(e) =>
                        updateRow(row.clientKey, { catalogName: e.target.value })
                      }
                      placeholder="Nombre del catálogo"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={smallInputClass()}
                      value={row.code}
                      onChange={(e) => updateRow(row.clientKey, { code: e.target.value })}
                      placeholder="Código"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={smallInputClass()}
                      value={row.name}
                      onChange={(e) => updateRow(row.clientKey, { name: e.target.value })}
                      placeholder="Nombre del artículo"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={smallInputClass()}
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.clientKey, { description: e.target.value })
                      }
                      placeholder="Descripción"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={smallInputClass()}
                      value={row.unit}
                      onChange={(e) => updateRow(row.clientKey, { unit: e.target.value })}
                      placeholder="unidad"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <TreePickerField
                      nodes={commodities.map((c) => ({
                        id: c.id,
                        parentId: c.parentId,
                        label: c.description,
                        code: c.code,
                      }))}
                      valueId={
                        commodities.find(
                          (c) => c.description === row.commodity,
                        )?.id ?? null
                      }
                      onChangeId={(id) => {
                        const node = commodities.find((c) => c.id === id);
                        updateRow(row.clientKey, {
                          commodity: node?.description ?? "",
                        });
                      }}
                      placeholder="Commodity"
                      clearLabel="Sin commodity"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={smallInputClass()}
                      value={row.lastPrice}
                      onChange={(e) =>
                        updateRow(row.clientKey, { lastPrice: e.target.value })
                      }
                      placeholder="Sin dato"
                    />
                  </td>
                  <td className="rounded-r-lg px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRows(new Set([row.clientKey]))}
                      disabled={rows.length === 1}
                      className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={filteredRows.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

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
