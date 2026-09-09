"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Shown only to a Super Administrador (ADMIN, no client of their own) on
// admin screens that manage per-client data: picks which client's data
// this page's list/form operates on, via a ?clientId= query param.
export function AdminClientSwitcher({
  clients,
}: {
  clients: { id: string; code: string; description: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("clientId") ?? "";

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <label className="mb-1 block text-xs font-medium text-amber-800">
        Super Administrador: elegí el cliente cuyos datos vas a ver o editar
      </label>
      <select
        className="w-full max-w-sm rounded-md border border-amber-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        value={current}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set("clientId", e.target.value);
          else params.delete("clientId");
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        <option value="">— Selecciona un cliente —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.description}
          </option>
        ))}
      </select>
    </div>
  );
}
