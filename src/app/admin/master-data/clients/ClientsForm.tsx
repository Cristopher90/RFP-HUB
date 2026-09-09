"use client";

import { useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import { saveClientList } from "../actions";
import type { MasterDataItemInput } from "../actions";
import { PaginationBar, usePagination } from "@/components/Pagination";

type ClientRow = {
  clientKey: string;
  code: string;
  description: string;
  icon: string;
};

function emptyRow(): ClientRow {
  return { clientKey: makeClientKey(), code: "", description: "", icon: "" };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Flat editor for the Client list — unlike the other datos maestros
// screens, clients have no hierarchy (no "Padre") and aren't themselves
// scoped by a clientId, since a Client IS the tenant boundary. ADMIN-only.
export function ClientsForm({ initial }: { initial: ClientRow[] }) {
  const [rows, setRows] = useState<ClientRow[]>(
    initial.length > 0 ? initial : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const pagination = usePagination(rows.length);
  const pagedRows = rows.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize,
  );

  function updateRow(clientKey: string, patch: Partial<ClientRow>) {
    setSuccess(false);
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
  }

  function removeRow(clientKey: string) {
    setSuccess(false);
    setRows((prev) => prev.filter((r) => r.clientKey !== clientKey));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const payload: MasterDataItemInput[] = rows.map((r) => ({
      ...r,
      parentClientKey: null,
    }));
    startTransition(async () => {
      const result = await saveClientList(payload);
      if ("error" in result) setError(result.error);
      else setSuccess(true);
    });
  }

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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Clientes</h2>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            + Agregar
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-3 pb-1">Código</th>
                <th className="px-3 pb-1">Nombre</th>
                <th className="px-3 pb-1">Ícono</th>
                <th className="w-16 px-3 pb-1" />
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.clientKey} className="rounded-lg bg-slate-50 align-middle">
                  <td className="px-3 py-2 first:rounded-l-lg">
                    <input
                      className={inputClass()}
                      placeholder="Ej. BASELINE"
                      value={row.code}
                      onChange={(e) => updateRow(row.clientKey, { code: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass()}
                      placeholder="Ej. Cliente BASELINE"
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.clientKey, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={`${inputClass()} w-20 text-center text-base`}
                      placeholder="🏢"
                      maxLength={4}
                      value={row.icon}
                      onChange={(e) => updateRow(row.clientKey, { icon: e.target.value })}
                    />
                  </td>
                  <td className="rounded-r-lg px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.clientKey)}
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
          totalItems={rows.length}
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
