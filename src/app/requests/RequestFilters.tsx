"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterPicker, useVisibleFilters } from "@/components/FilterPicker";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { REQUEST_STATUSES } from "@/lib/requestStatus";

type Option = { id: string; name: string };

// Every filter of the list and the query params each one owns.
const FILTER_PARAMS: Record<string, string[]> = {
  q: ["q"],
  type: ["type"],
  creator: ["creator"],
  assigned: ["assigned"],
  status: ["status"],
  commodity: ["commodity"],
  importedDate: ["importedFrom", "importedTo"],
  requestDate: ["requestFrom", "requestTo"],
};
const VISIBLE_FILTERS_PREF_KEY = "requests-list-visible-filters";
const DEFAULT_VISIBLE = Object.keys(FILTER_PARAMS);

export function RequestFilters({
  types,
  creators,
  commodities,
  buyers,
  groups,
}: {
  types: string[];
  creators: string[];
  commodities: string[];
  buyers: Option[];
  groups: Option[];
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }
  function setParam(key: string, value: string) {
    updateParams({ [key]: value });
  }

  const get = (key: string) => searchParams.get(key) ?? "";
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
  const clientId = searchParams.get("clientId");
  const clearHref = clientId ? `${pathname}?clientId=${clientId}` : pathname;
  const activeKeys = Object.entries(FILTER_PARAMS)
    .filter(([, params]) => params.some((p) => get(p)))
    .map(([key]) => key);
  const hasFilters = activeKeys.length > 0;
  const { visible, show, hide } = useVisibleFilters(
    VISIBLE_FILTERS_PREF_KEY,
    DEFAULT_VISIBLE,
    activeKeys,
  );
  const available = [
    { key: "q", label: t("requestsPage.filterSearch") },
    { key: "type", label: t("requestsPage.filterType") },
    { key: "creator", label: t("requestsPage.filterCreator") },
    { key: "assigned", label: t("requestsPage.filterAssigned") },
    { key: "status", label: t("requestsPage.filterStatus") },
    { key: "commodity", label: t("requestsPage.filterCommodity") },
    { key: "importedDate", label: t("requestsPage.filterImportedDate") },
    { key: "requestDate", label: t("requestsPage.filterRequestDate") },
  ];

  function toggleFilter(key: string, shouldShow: boolean) {
    if (shouldShow) {
      show(key);
      return;
    }
    hide(key);
    // Hiding a filter also drops its value, so nothing filters invisibly.
    const owned = FILTER_PARAMS[key] ?? [];
    if (owned.some((p) => get(p))) {
      updateParams(Object.fromEntries(owned.map((p) => [p, ""])));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      {visible.has("q") && (
        <input
          className={`${field} w-full sm:w-64`}
          placeholder={t("requestsPage.searchPlaceholder")}
          defaultValue={get("q")}
          onChange={(e) => setParam("q", e.target.value)}
        />
      )}
      {visible.has("type") && (
        <select className={field} value={get("type")} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">{t("requestsPage.allTypes")}</option>
          {types.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      )}
      {visible.has("creator") && (
        <select className={field} value={get("creator")} onChange={(e) => setParam("creator", e.target.value)}>
          <option value="">{t("requestsPage.allCreators")}</option>
          {creators.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      )}
      {visible.has("assigned") && (
        <select className={field} value={get("assigned")} onChange={(e) => setParam("assigned", e.target.value)}>
          <option value="">{t("requestsPage.allAssigned")}</option>
          <option value="none">{t("requestsPage.unassigned")}</option>
          {buyers.length > 0 && (
            <optgroup label={t("requestsPage.buyersOption")}>
              {buyers.map((b) => (
                <option key={b.id} value={`u:${b.id}`}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          )}
          {groups.length > 0 && (
            <optgroup label={t("requestsPage.groupsOption")}>
              {groups.map((g) => (
                <option key={g.id} value={`g:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      {visible.has("status") && (
        <select className={field} value={get("status")} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">{t("requestsPage.allStatuses")}</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`requestStatus.${s}`)}
            </option>
          ))}
        </select>
      )}
      {visible.has("commodity") && (
        <select className={field} value={get("commodity")} onChange={(e) => setParam("commodity", e.target.value)}>
          <option value="">{t("requestsPage.allCommodities")}</option>
          {commodities.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      )}
      {visible.has("importedDate") && (
        <div className="flex items-center gap-2">
          <span>{t("requestsPage.importedFrom")}</span>
          <input type="date" className={field} value={get("importedFrom")} onChange={(e) => setParam("importedFrom", e.target.value)} />
          <span>{t("requestsPage.importedTo")}</span>
          <input type="date" className={field} value={get("importedTo")} onChange={(e) => setParam("importedTo", e.target.value)} />
        </div>
      )}
      {visible.has("requestDate") && (
        <div className="flex items-center gap-2">
          <span>{t("requestsPage.requestFrom")}</span>
          <input type="date" className={field} value={get("requestFrom")} onChange={(e) => setParam("requestFrom", e.target.value)} />
          <span>{t("requestsPage.requestTo")}</span>
          <input type="date" className={field} value={get("requestTo")} onChange={(e) => setParam("requestTo", e.target.value)} />
        </div>
      )}
      <FilterPicker filters={available} visible={visible} onToggle={toggleFilter} />
      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(clearHref)}
          className="text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          {t("requestsPage.clearFilters")}
        </button>
      )}
    </div>
  );
}
