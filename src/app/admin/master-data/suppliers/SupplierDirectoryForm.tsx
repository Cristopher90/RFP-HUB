"use client";

import { useRef, useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import {
  saveSupplierDirectory,
  type SupplierDirectoryItemInput,
  type SupplierUserItemInput,
} from "./actions";
import { SupplierUsersEditor } from "./SupplierUsersEditor";
import { parseSupplierDirectoryExcelFile } from "./supplierDirectoryImport";
import { downloadSupplierDirectoryExcel } from "./supplierDirectoryExport";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useColumnPrefs, type ColumnDef } from "@/lib/useColumnPrefs";
import {
  ColumnSettingsMenu,
  ResizableTh,
} from "@/components/ColumnSettingsMenu";
import { PaginationBar, usePagination } from "@/components/Pagination";

type ColumnKey =
  | "code"
  | "taxId"
  | "companyName"
  | "contactFirstName"
  | "contactLastName"
  | "email"
  | "phone"
  | "status";

const COLUMN_DEFS: ColumnDef<ColumnKey>[] = [
  { key: "code", label: "Código", defaultWidth: 110, minWidth: 80 },
  { key: "taxId", label: "CIF", defaultWidth: 110, minWidth: 80 },
  { key: "companyName", label: "Empresa", defaultWidth: 220, minWidth: 120 },
  { key: "contactFirstName", label: "Nombre", defaultWidth: 130, minWidth: 90 },
  { key: "contactLastName", label: "Apellido", defaultWidth: 130, minWidth: 90 },
  { key: "email", label: "Correo", defaultWidth: 200, minWidth: 120 },
  { key: "phone", label: "Teléfono", defaultWidth: 140, minWidth: 100 },
  { key: "status", label: "Estado", defaultWidth: 110, minWidth: 90 },
];

function emptyRow(): SupplierDirectoryItemInput {
  return {
    clientKey: makeClientKey(),
    code: "",
    taxId: "",
    companyName: "",
    contactFirstName: "",
    contactLastName: "",
    email: "",
    phone: "",
    status: "ACTIVE",
  };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function smallInputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function SupplierDirectoryForm({
  initial,
  targetClientId,
  supplierUsersByDirectoryId = {},
}: {
  initial: SupplierDirectoryItemInput[];
  targetClientId?: string;
  supplierUsersByDirectoryId?: Record<string, SupplierUserItemInput[]>;
}) {
  const [rows, setRows] = useState<SupplierDirectoryItemInput[]>(
    initial.length > 0 ? initial : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  // Only rows that already exist in the DB (loaded from the server) have a
  // real id a SupplierUser can attach to — a freshly-added, unsaved row's
  // clientKey is just a local placeholder.
  const [savedKeys] = useState(() => new Set(initial.map((r) => r.clientKey)));
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initial[0]?.clientKey ?? "",
  );

  const columnPrefs = useColumnPrefs("masterdata-columns-suppliers", COLUMN_DEFS);

  function updateRow(
    clientKey: string,
    patch: Partial<SupplierDirectoryItemInput>,
  ) {
    setSuccess(false);
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
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
      const imported = await parseSupplierDirectoryExcelFile(file);
      if (imported.length === 0) {
        setImportError(
          "No se encontraron filas con las columnas esperadas.",
        );
        return;
      }
      setSuccess(false);
      setRows((prev) => {
        const kept = prev.filter(
          (r) =>
            r.code.trim().length > 0 || r.companyName.trim().length > 0,
        );
        return [...kept, ...imported];
      });
    } catch {
      setImportError("No se pudo leer el archivo. Verifica que sea un .xlsx.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveSupplierDirectory(rows, targetClientId);
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
      r.code.toLowerCase().includes(q) ||
      r.taxId.toLowerCase().includes(q) ||
      r.companyName.toLowerCase().includes(q) ||
      r.contactFirstName.toLowerCase().includes(q) ||
      r.contactLastName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      (r.status === "ACTIVE" ? "activo" : "inactivo").includes(q)
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Cargar proveedores desde Excel
          </p>
          <p className="text-xs text-slate-400">
            Columnas: CodigoProveedor, CIF, Empresa, Nombre, Apellido,
            Correo, Telefono, Estado. Se agrega a lo que ya tengas.
          </p>
          {importError && (
            <p className="mt-1 text-xs text-red-600">{importError}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              downloadSupplierDirectoryExcel("Proveedores.xlsx", rows)
            }
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
        </div>
      </div>

      <CollapsibleSection
        title="Proveedores"
        storageKey="masterdata-section-suppliers"
        right={
          <div className="flex items-center gap-2">
            <ColumnSettingsMenu
              defs={COLUMN_DEFS}
              order={columnPrefs.order}
              hidden={columnPrefs.hidden}
              toggleVisible={columnPrefs.toggleVisible}
              moveColumn={columnPrefs.moveColumn}
              resetPrefs={columnPrefs.resetPrefs}
            />
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
            placeholder="Buscar por código, CIF, empresa, contacto, correo, teléfono o estado..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-xs font-medium uppercase tracking-wide text-slate-400">
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
              {pagedRows.map((row) => {
                const isEditing = editingKeys.has(row.clientKey);
                return (
                  <tr
                    key={row.clientKey}
                    className="rounded-lg bg-slate-50 align-middle"
                  >
                    {columnPrefs.visibleOrderedDefs.map((def) => (
                      <td
                        key={def.key}
                        style={{ width: columnPrefs.widths[def.key] }}
                        className="px-3 py-2 first:rounded-l-lg"
                      >
                        {def.key === "status" ? (
                          isEditing ? (
                            <select
                              className={smallInputClass()}
                              value={row.status}
                              onChange={(e) =>
                                updateRow(row.clientKey, {
                                  status: e.target.value as
                                    | "ACTIVE"
                                    | "INACTIVE",
                                })
                              }
                            >
                              <option value="ACTIVE">Activo</option>
                              <option value="INACTIVE">Inactivo</option>
                            </select>
                          ) : (
                            <span
                              className={
                                row.status === "ACTIVE"
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                  : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600"
                              }
                            >
                              {row.status === "ACTIVE" ? "Activo" : "Inactivo"}
                            </span>
                          )
                        ) : isEditing ? (
                          <input
                            type={def.key === "email" ? "email" : "text"}
                            className={smallInputClass()}
                            value={row[def.key]}
                            onChange={(e) =>
                              updateRow(row.clientKey, {
                                [def.key]: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <span className="text-slate-700">
                            {row[def.key] || "—"}
                          </span>
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
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((r) => r.clientKey !== row.clientKey),
                            )
                          }
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
          totalItems={filteredRows.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Usuarios de proveedor"
        subtitle="Contactos con acceso al portal de proveedor (correo y contraseña) para el proveedor seleccionado."
        storageKey="masterdata-section-supplier-users"
      >
        {rows.filter((r) => savedKeys.has(r.clientKey)).length === 0 ? (
          <p className="text-sm text-slate-500">
            Guarda al menos un proveedor para poder darle usuarios de portal.
          </p>
        ) : (
          <>
            <div className="max-w-md">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Proveedor
              </label>
              <select
                className={inputClass()}
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
              >
                {rows
                  .filter((r) => savedKeys.has(r.clientKey))
                  .map((r) => (
                    <option key={r.clientKey} value={r.clientKey}>
                      {r.code} — {r.companyName}
                    </option>
                  ))}
              </select>
            </div>
            {selectedSupplierId && (
              <div className="mt-4">
                <SupplierUsersEditor
                  key={selectedSupplierId}
                  supplierDirectoryId={selectedSupplierId}
                  initial={supplierUsersByDirectoryId[selectedSupplierId] ?? []}
                />
              </div>
            )}
          </>
        )}
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
