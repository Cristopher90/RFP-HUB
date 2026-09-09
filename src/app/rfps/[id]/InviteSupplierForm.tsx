"use client";

import { useState, useTransition } from "react";
import {
  SupplierSearchPicker,
  type SupplierDirectoryEntry,
} from "@/components/SupplierSearchPicker";
import { inviteSupplier } from "./actions";

export function InviteSupplierForm({
  rfpId,
  supplierDirectory,
}: {
  rfpId: string;
  supplierDirectory: SupplierDirectoryEntry[];
}) {
  const [selected, setSelected] = useState<SupplierDirectoryEntry | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dir = selected;
    if (!dir) {
      setError("Selecciona un proveedor.");
      return;
    }
    startTransition(async () => {
      const result = await inviteSupplier(rfpId, {
        name: `${dir.contactFirstName} ${dir.contactLastName}`.trim(),
        email: dir.email,
        company: dir.companyName,
        supplierDirectoryId: dir.id,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSelected(null);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="w-full sm:w-80">
        <SupplierSearchPicker
          suppliers={supplierDirectory}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      <button
        type="submit"
        disabled={pending || supplierDirectory.length === 0}
        className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {pending ? "Invitando..." : "Invitar"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {supplierDirectory.length === 0 && (
        <span className="text-xs text-amber-600">
          No hay proveedores activos en Configuración → Datos maestros →
          Proveedores.
        </span>
      )}
    </form>
  );
}
