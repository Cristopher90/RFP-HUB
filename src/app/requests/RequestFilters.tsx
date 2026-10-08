"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { REQUEST_STATUSES } from "@/lib/requestStatus";

type Option = { id: string; name: string };

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

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const get = (key: string) => searchParams.get(key) ?? "";
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
  const clientId = searchParams.get("clientId");
  const clearHref = clientId ? `${pathname}?clientId=${clientId}` : pathname;
  const hasFilters = ["q", "type", "creator", "assigned", "status", "commodity", "importedFrom", "importedTo", "requestFrom", "requestTo"].some(
    (k) => get(k),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          className={`${field} w-full sm:w-64`}
          placeholder={t("requestsPage.searchPlaceholder")}
          defaultValue={get("q")}
          onChange={(e) => setParam("q", e.target.value)}
        />
        <select className={field} value={get("type")} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">{t("requestsPage.allTypes")}</option>
          {types.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select className={field} value={get("creator")} onChange={(e) => setParam("creator", e.target.value)}>
          <option value="">{t("requestsPage.allCreators")}</option>
          {creators.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
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
        <select className={field} value={get("status")} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">{t("requestsPage.allStatuses")}</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`requestStatus.${s}`)}
            </option>
          ))}
        </select>
        <select className={field} value={get("commodity")} onChange={(e) => setParam("commodity", e.target.value)}>
          <option value="">{t("requestsPage.allCommodities")}</option>
          {commodities.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>{t("requestsPage.importedFrom")}</span>
        <input type="date" className={field} value={get("importedFrom")} onChange={(e) => setParam("importedFrom", e.target.value)} />
        <span>{t("requestsPage.importedTo")}</span>
        <input type="date" className={field} value={get("importedTo")} onChange={(e) => setParam("importedTo", e.target.value)} />
        <span className="ml-2">{t("requestsPage.requestFrom")}</span>
        <input type="date" className={field} value={get("requestFrom")} onChange={(e) => setParam("requestFrom", e.target.value)} />
        <span>{t("requestsPage.requestTo")}</span>
        <input type="date" className={field} value={get("requestTo")} onChange={(e) => setParam("requestTo", e.target.value)} />
        {hasFilters && (
          <button
            type="button"
            onClick={() => router.push(clearHref)}
            className="ml-2 text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {t("requestsPage.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
