"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TreePickerField } from "@/components/TreePickerField";
import { FilterPicker, useVisibleFilters } from "@/components/FilterPicker";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { statusLabel } from "@/i18n/labels";
import { saveUserPref } from "@/lib/userPrefsActions";
import { RFP_FILTERS_PREF_KEY } from "@/lib/prefKeys";

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

// Every filter the list offers and the query params each one owns.
const FILTER_PARAMS: Record<string, string[]> = {
  commodity: ["commodity"],
  region: ["region"],
  status: ["status"],
  client: ["client"],
  creator: ["creator"],
  startDate: ["startFrom", "startTo"],
  closeDate: ["closeFrom", "closeTo"],
  supplier: ["supplier"],
};
const VISIBLE_FILTERS_PREF_KEY = "rfp-list-visible-filters";
const DEFAULT_VISIBLE = ["commodity", "region", "status", "client"];

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

  function updateParams(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    saveUserPref(RFP_FILTERS_PREF_KEY, params.toString()).catch(() => {});
    router.push(`${pathname}?${params.toString()}`);
  }
  function setParam(key: string, value: string) {
    updateParams({ [key]: value });
  }

  const available = [
    { key: "commodity", label: dictionary.rfpTable.commodity },
    { key: "region", label: dictionary.rfpTable.region },
    { key: "status", label: dictionary.rfpTable.estado },
    ...(clients ? [{ key: "client", label: dictionary.rfpTable.cliente }] : []),
    ...(creators ? [{ key: "creator", label: t("filters.creator") }] : []),
    { key: "startDate", label: t("filters.startDate") },
    { key: "closeDate", label: t("filters.closeDate") },
    { key: "supplier", label: t("filters.invitedSupplier") },
  ];
  const activeKeys = Object.entries(FILTER_PARAMS)
    .filter(([, params]) => params.some((p) => searchParams.get(p)))
    .map(([key]) => key);
  const { visible, show, hide } = useVisibleFilters(
    VISIBLE_FILTERS_PREF_KEY,
    DEFAULT_VISIBLE,
    activeKeys,
  );
  const isShown = (key: string) => available.some((f) => f.key === key) && visible.has(key);

  function toggleFilter(key: string, shouldShow: boolean) {
    if (shouldShow) {
      show(key);
      return;
    }
    hide(key);
    // Hiding a filter also drops its value, so nothing filters invisibly.
    const owned = FILTER_PARAMS[key] ?? [];
    if (owned.some((p) => searchParams.get(p))) {
      updateParams(Object.fromEntries(owned.map((p) => [p, ""])));
    }
  }

  const hasFilters = activeKeys.length > 0;

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

  function dateRange(label: string, from: string, to: string) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500" key={from}>
        <span>{label}</span>
        <input
          type="date"
          aria-label={t("filters.from")}
          className={selectClass()}
          value={searchParams.get(from) ?? ""}
          onChange={(e) => setParam(from, e.target.value)}
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          aria-label={t("filters.to")}
          className={selectClass()}
          value={searchParams.get(to) ?? ""}
          onChange={(e) => setParam(to, e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isShown("commodity") && (
        <div className="w-56">
          <TreePickerField
            nodes={commodities.map((c) => ({
              id: c.id,
              parentId: c.parentId,
              label: c.description,
              code: c.code,
            }))}
            valueId={commodities.find((c) => c.description === commodityFilter)?.id ?? null}
            onChangeId={(id) => {
              const node = commodities.find((c) => c.id === id);
              setParam("commodity", node?.description ?? "");
            }}
            placeholder={t("filters.allCommodities")}
            clearLabel={t("filters.allCommodities")}
          />
        </div>
      )}
      {isShown("region") && (
        <div className="w-56">
          <TreePickerField
            nodes={regions.map((r) => ({
              id: r.id,
              parentId: r.parentId,
              label: r.description,
              code: r.code,
            }))}
            valueId={regions.find((r) => r.description === regionFilter)?.id ?? null}
            onChangeId={(id) => {
              const node = regions.find((r) => r.id === id);
              setParam("region", node?.description ?? "");
            }}
            placeholder={t("filters.allRegions")}
            clearLabel={t("filters.allRegions")}
          />
        </div>
      )}
      {isShown("status") && (
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
      )}
      {clients && isShown("client") && (
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
      {creators && isShown("creator") && (
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
      {isShown("startDate") && dateRange(t("filters.startDate"), "startFrom", "startTo")}
      {isShown("closeDate") && dateRange(t("filters.closeDate"), "closeFrom", "closeTo")}
      {isShown("supplier") && (
        <input
          type="search"
          aria-label={t("filters.invitedSupplier")}
          className={`${selectClass()} w-56`}
          placeholder={`${t("filters.invitedSupplier")}: ${t("filters.supplierPlaceholder")}`}
          value={supplierText}
          onChange={(e) => setSupplierText(e.target.value)}
        />
      )}
      <FilterPicker filters={available} visible={visible} onToggle={toggleFilter} />
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            Object.values(FILTER_PARAMS)
              .flat()
              .forEach((k) => params.delete(k));
            saveUserPref(RFP_FILTERS_PREF_KEY, params.toString()).catch(() => {});
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
