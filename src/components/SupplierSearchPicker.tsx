"use client";

import { useMemo, useState } from "react";

export type SupplierDirectoryEntry = {
  id: string;
  code: string;
  taxId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone: string;
};

// Search-popup picker for the supplier directory: opens a modal with a
// single search box that matches against every directory column (código,
// CIF, empresa, contacto, correo, teléfono), not just the fields shown in
// a plain <select>'s option label.
export function SupplierSearchPicker({
  suppliers,
  selected,
  onSelect,
  placeholder = "Buscar proveedor por código, CIF, empresa, contacto, correo o teléfono...",
}: {
  suppliers: SupplierDirectoryEntry[];
  selected: SupplierDirectoryEntry | null;
  onSelect: (supplier: SupplierDirectoryEntry) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [
        s.code,
        s.taxId,
        s.companyName,
        s.contactFirstName,
        s.contactLastName,
        s.email,
        s.phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [suppliers, query]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm shadow-sm hover:border-violet-400 hover:bg-slate-50"
      >
        {selected ? (
          <span className="text-slate-800">
            {selected.companyName} — {selected.contactFirstName}{" "}
            {selected.contactLastName} ({selected.email})
          </span>
        ) : (
          <span className="text-slate-400">Buscar proveedor...</span>
        )}
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
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">
                  Sin resultados.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Empresa</th>
                      <th className="px-4 py-2">Contacto</th>
                      <th className="px-4 py-2">Correo</th>
                      <th className="px-4 py-2">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => {
                          onSelect(s);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="cursor-pointer hover:bg-violet-50"
                      >
                        <td className="px-4 py-2 text-slate-500">{s.code}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {s.companyName}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {s.contactFirstName} {s.contactLastName}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {s.email}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {s.phone}
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
    </div>
  );
}
