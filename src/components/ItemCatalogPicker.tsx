"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

export type ItemCatalogEntry = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  lastPrice: number | null;
};

// Search-popup picker for the item catalog: unlike SupplierSearchPicker,
// this isn't bound to a single persistent value — picking a row appends a
// new RFP item and closes, it's a one-shot "add" action, not a field.
export function ItemCatalogPicker({
  items,
  onPick,
}: {
  items: ItemCatalogEntry[];
  onPick: (entry: ItemCatalogEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.code, i.name, i.description ?? "", i.unit]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-violet-600 hover:text-violet-700"
      >
        + Agregar del catálogo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-4">
              <input
                autoFocus
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="Buscar por código, artículo, descripción o unidad..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">
                  {items.length === 0
                    ? "El catálogo está vacío todavía."
                    : "Sin resultados."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Artículo</th>
                      <th className="px-4 py-2">Descripción</th>
                      <th className="px-4 py-2">Unidad</th>
                      <th className="px-4 py-2">Último precio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((i) => (
                      <tr
                        key={i.id}
                        onClick={() => {
                          onPick(i);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="cursor-pointer hover:bg-violet-50"
                      >
                        <td className="px-4 py-2 text-slate-500">{i.code}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {i.name}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {i.description || "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{i.unit}</td>
                        <td className="px-4 py-2 text-slate-500">
                          {i.lastPrice !== null ? formatCurrency(i.lastPrice) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
