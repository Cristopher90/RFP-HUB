"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function UserListFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <input
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:max-w-sm"
      placeholder="Buscar por nombre, cliente, correo, sociedad, centro, centro de coste o grupo..."
      defaultValue={searchParams.get("q") ?? ""}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
}
