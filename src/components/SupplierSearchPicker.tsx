"use client";

import { useMemo, useState } from "react";

export type SupplierContact = { id: string; name: string; email: string };

export type SupplierDirectoryEntry = {
  id: string;
  code: string;
  taxId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone: string;
  contacts?: SupplierContact[];
};

export type PickedContact = { name: string; email: string };

// Search-popup picker for the supplier directory: opens a modal with a
// single search box that matches against every directory column (código,
// CIF, empresa, contacto, correo, teléfono), not just the fields shown in
// a plain <select>'s option label. Picking a company doesn't invite it
// right away — it shows every contact on file for that supplier (the
// directory's own contact plus any portal users) as checkboxes, so the
// caller can send the RFP to more than one person there at once.
export function SupplierSearchPicker({
  suppliers,
  selectedLabel,
  onConfirm,
  placeholder = "Buscar proveedor por código, CIF, empresa, contacto, correo o teléfono...",
}: {
  suppliers: SupplierDirectoryEntry[];
  selectedLabel: string | null;
  onConfirm: (supplier: SupplierDirectoryEntry, contacts: PickedContact[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pickedDir, setPickedDir] = useState<SupplierDirectoryEntry | null>(
    null,
  );
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set());

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

  function close() {
    setOpen(false);
    setQuery("");
    setPickedDir(null);
    setCheckedEmails(new Set());
  }

  function contactsOf(dir: SupplierDirectoryEntry): SupplierContact[] {
    const primary = {
      id: "primary",
      name: `${dir.contactFirstName} ${dir.contactLastName}`.trim(),
      email: dir.email,
    };
    const extra = (dir.contacts ?? []).filter(
      (c) => c.email.toLowerCase() !== primary.email.toLowerCase(),
    );
    return [primary, ...extra];
  }

  function pickDir(dir: SupplierDirectoryEntry) {
    setPickedDir(dir);
    setCheckedEmails(new Set([dir.email]));
  }

  function toggleContact(email: string) {
    setCheckedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function handleConfirm() {
    if (!pickedDir) return;
    const contacts = contactsOf(pickedDir).filter((c) =>
      checkedEmails.has(c.email),
    );
    if (contacts.length === 0) return;
    onConfirm(pickedDir, contacts);
    close();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm shadow-sm hover:border-violet-400 hover:bg-slate-50"
      >
        {selectedLabel ? (
          <span className="text-slate-800">{selectedLabel}</span>
        ) : (
          <span className="text-slate-400">Buscar proveedor...</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={close}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {pickedDir ? (
              <>
                <div className="border-b border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-800">
                    {pickedDir.companyName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Elige a quién enviarle la RFP.
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {contactsOf(pickedDir).map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-violet-50"
                    >
                      <input
                        type="checkbox"
                        checked={checkedEmails.has(c.email)}
                        onChange={() => toggleContact(c.email)}
                      />
                      <span className="text-sm">
                        <span className="font-medium text-slate-800">
                          {c.name || "—"}
                        </span>
                        <span className="ml-2 text-slate-500">
                          {c.email}
                        </span>
                        {c.id === "primary" && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Contacto principal
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPickedDir(null);
                      setCheckedEmails(new Set());
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    &larr; Cambiar proveedor
                  </button>
                  <button
                    type="button"
                    disabled={checkedEmails.size === 0}
                    onClick={handleConfirm}
                    className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                  >
                    Confirmar ({checkedEmails.size})
                  </button>
                </div>
              </>
            ) : (
              <>
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
                            onClick={() => pickDir(s)}
                            className="cursor-pointer hover:bg-violet-50"
                          >
                            <td className="px-4 py-2 text-slate-500">
                              {s.code}
                            </td>
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
                    onClick={close}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
