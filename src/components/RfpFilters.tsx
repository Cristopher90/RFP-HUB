"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TreePickerField } from "@/components/TreePickerField";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { statusLabel } from "@/i18n/labels";

function selectClass() {
  return "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

const RFP_FILTER_STATUSES = [
  "DRAFT",
  "PENDING_PUBLISH_APPROVAL",
  "AWAITING_START",
  "OPEN",
  "CLOSED",
];

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
  clients,
}: {
  commodities: CategoryOption[];
  regions: CategoryOption[];
  creators?: { id: string; name: string }[];
  clients?: { id: string; description: string }[];
}) {
  const { t, dictionary } = usePreferences();
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
    searchParams.get("creator") ||
    searchParams.get("client");

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
          placeholder={t("filters.allCommodities")}
          clearLabel={t("filters.allCommodities")}
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
          placeholder={t("filters.allRegions")}
          clearLabel={t("filters.allRegions")}
        />
      </div>
      <select
        className={selectClass()}
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">{t("filters.allStatuses")}</option>
        {RFP_FILTER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {statusLabel(dictionary, value)}
          </option>
        ))}
      </select>
      {creators && (
        <select
          className={selectClass()}
          value={searchParams.get("creator") ?? ""}
          onChange={(e) => setParam("creator", e.target.value)}
        >
          <option value="">{t("filters.allUsers")}</option>
          {creators.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      {clients && (
        <select
          className={selectClass()}
          value={searchParams.get("client") ?? ""}
          onChange={(e) => setParam("client", e.target.value)}
        >
          <option value="">{t("filters.allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.description}
            </option>
          ))}
        </select>
      )}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            ["commodity", "region", "status", "creator", "client"].forEach(
              (k) => params.delete(k),
            );
            router.push(`${pathname}?${params.toString()}`);
          }}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          {t("filters.clear")}
        </button>
      )}
    </div>
  );
}
