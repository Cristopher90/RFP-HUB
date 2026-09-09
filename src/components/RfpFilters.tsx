"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TreePickerField } from "@/components/TreePickerField";

function selectClass() {
  return "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_PUBLISH_APPROVAL: "Pendiente de aprobación",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
};

type CategoryOption = {
  id: string;
  parentId: string | null;
  code: string;
  description: string;
};

export function RfpFilters({
  commodities,
  regions,
  creators,
}: {
  commodities: CategoryOption[];
  regions: CategoryOption[];
  creators?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    searchParams.get("commodity") ||
    searchParams.get("region") ||
    searchParams.get("status") ||
    searchParams.get("creator");

  const commodityFilter = searchParams.get("commodity") ?? "";
  const regionFilter = searchParams.get("region") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-56">
        <TreePickerField
          nodes={commodities.map((c) => ({
            id: c.id,
            parentId: c.parentId,
            label: c.description,
            code: c.code,
          }))}
          valueId={
            commodities.find((c) => c.description === commodityFilter)?.id ??
            null
          }
          onChangeId={(id) => {
            const node = commodities.find((c) => c.id === id);
            setParam("commodity", node?.description ?? "");
          }}
          placeholder="Todos los commodities"
          clearLabel="Todos los commodities"
        />
      </div>
      <div className="w-56">
        <TreePickerField
          nodes={regions.map((r) => ({
            id: r.id,
            parentId: r.parentId,
            label: r.description,
            code: r.code,
          }))}
          valueId={
            regions.find((r) => r.description === regionFilter)?.id ?? null
          }
          onChangeId={(id) => {
            const node = regions.find((r) => r.id === id);
            setParam("region", node?.description ?? "");
          }}
          placeholder="Todas las regiones"
          clearLabel="Todas las regiones"
        />
      </div>
      <select
        className={selectClass()}
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {creators && (
        <select
          className={selectClass()}
          value={searchParams.get("creator") ?? ""}
          onChange={(e) => setParam("creator", e.target.value)}
        >
          <option value="">Todos los usuarios</option>
          {creators.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            ["commodity", "region", "status", "creator"].forEach((k) =>
              params.delete(k),
            );
            router.push(`${pathname}?${params.toString()}`);
          }}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
