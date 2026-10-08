"use client";

import { useEffect, useRef, useState } from "react";
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

const ADVANCED_PARAMS = ["startFrom", "startTo", "closeFrom", "closeTo", "creator", "supplier"];

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
    searchParams.get("client") ||
    ADVANCED_PARAMS.some((k) => searchParams.get(k));

  const activeAdvancedCount = ADVANCED_PARAMS.filter((k) => searchParams.get(k)).length;
  const [advancedOpen, setAdvancedOpen] = useState(activeAdvancedCount > 0);

  // The supplier search is typed text, so it's applied after a short pause
  // rather than on every keystroke (each change is a server round-trip).
  const supplierParam = searchParams.get("supplier") ?? "";
  const [supplierText, setSupplierText] = useState(supplierParam);
  const lastApplied = useRef(supplierParam);
  useEffect(() => {
    if (supplierParam !== lastApplied.current) {
      lastApplied.current = supplierParam;
      setSupplierText(supplierParam); // changed from outside (e.g. "clear filters")
    }
  }, [supplierParam]);
  useEffect(() => {
    if (supplierText.trim() === lastApplied.current) return;
    const timer = setTimeout(() => {
      lastApplied.current = supplierText.trim();
      setParam("supplier", supplierText.trim());
    }, 500);
    return () => clearTimeout(timer);
    // setParam is recreated each render; only the typed text should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierText]);

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
      <button
        type="button"
        onClick={() => setAdvancedOpen((open) => !open)}
        aria-expanded={advancedOpen}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {advancedOpen ? "▾" : "▸"} {t("filters.moreFilters")}
        {activeAdvancedCount > 0 && (
          <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">
            {activeAdvancedCount}
          </span>
        )}
      </button>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            ["commodity", "region", "status", "client", ...ADVANCED_PARAMS].forEach(
              (k) => params.delete(k),
            );
            router.push(`${pathname}?${params.toString()}`);
          }}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          {t("filters.clear")}
        </button>
      )}
      {advancedOpen && (
        <div className="grid w-full grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset>
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("filters.startDate")}
            </legend>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label={t("filters.from")}
                className={selectClass()}
                value={searchParams.get("startFrom") ?? ""}
                onChange={(e) => setParam("startFrom", e.target.value)}
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                aria-label={t("filters.to")}
                className={selectClass()}
                value={searchParams.get("startTo") ?? ""}
                onChange={(e) => setParam("startTo", e.target.value)}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("filters.closeDate")}
            </legend>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label={t("filters.from")}
                className={selectClass()}
                value={searchParams.get("closeFrom") ?? ""}
                onChange={(e) => setParam("closeFrom", e.target.value)}
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                aria-label={t("filters.to")}
                className={selectClass()}
                value={searchParams.get("closeTo") ?? ""}
                onChange={(e) => setParam("closeTo", e.target.value)}
              />
            </div>
          </fieldset>
          {creators && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("filters.creator")}
              </label>
              <select
                className={`${selectClass()} w-full`}
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
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("filters.invitedSupplier")}
            </label>
            <input
              type="search"
              className={`${selectClass()} w-full`}
              placeholder={t("filters.supplierPlaceholder")}
              value={supplierText}
              onChange={(e) => setSupplierText(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
