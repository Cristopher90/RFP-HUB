"use client";

import { useMemo, useState } from "react";

export type PickableUser = {
  id: string;
  name: string;
  lastName: string;
  email: string;
};

// Trigger-button + search popup for picking one or more users by nombre,
// apellido or correo — same shape as SupplierSearchPicker, but multi-select
// via checkboxes instead of picking a single row. Used wherever "personas
// específicas" needs to be chosen out of a potentially long user list.
export function UserMultiPicker({
  users,
  selectedIds,
  onChange,
  placeholder = "Buscar por nombre, apellido o correo...",
}: {
  users: PickableUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.lastName, u.email].join(" ").toLowerCase().includes(q),
    );
  }, [users, query]);

  const selected = users.filter((u) => selectedIds.includes(u.id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-xs shadow-sm hover:border-violet-400 hover:bg-slate-50"
      >
        {selected.length > 0 ? (
          <span className="text-slate-800">
            {selected
              .map((u) => `${u.name} ${u.lastName}`.trim())
              .join(", ")}
          </span>
        ) : (
          <span className="text-slate-400">Buscar usuario...</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
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
            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Sin resultados.</p>
              ) : (
                results.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-violet-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggle(u.id)}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-slate-800">
                        {u.name} {u.lastName}
                      </span>
                      <span className="ml-2 text-slate-500">{u.email}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 p-3">
              <span className="text-xs text-slate-500">
                {selectedIds.length} seleccionado
                {selectedIds.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
