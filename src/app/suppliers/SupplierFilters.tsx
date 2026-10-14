"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { TreePickerField } from "@/components/TreePickerField";
import { FilterPicker, useVisibleFilters } from "@/components/FilterPicker";
import { ancestorChain } from "@/lib/templateMatch";
import { hasOptions, labelFor, optionLabel, treeNodes, type CustomFieldDef } from "@/lib/customFieldsShared";
import type { DocTypeOption, SupplierExtras, SupplierListItem } from "./SuppliersView";

export type StatusFilter = "all" | "active" | "blocked" | "initialBlock" | "rated";

export type SupplierFilterValues = {
  status: StatusFilter;
  docStatus: "" | "expired" | "active";
  docType: string;
  commodity: string;
  region: string;
  createdFrom: string;
  createdTo: string;
  creator: string;
  custom: Record<string, string>;
};

export const EMPTY_FILTERS: SupplierFilterValues = {
  status: "all",
  docStatus: "",
  docType: "",
  commodity: "",
  region: "",
  createdFrom: "",
  createdTo: "",
  creator: "",
  custom: {},
};

const PREF_KEY = "suppliers-list-visible-filters";
const DEFAULT_VISIBLE = ["status", "commodity", "region"];

// Which filter keys currently hold a value (those are always shown).
function activeKeys(v: SupplierFilterValues): string[] {
  const keys: string[] = [];
  if (v.status !== "all") keys.push("status");
  if (v.docStatus) keys.push("docStatus");
  if (v.docType) keys.push("docType");
  if (v.commodity) keys.push("commodity");
  if (v.region) keys.push("region");
  if (v.createdFrom || v.createdTo) keys.push("createdDate");
  if (v.creator) keys.push("creator");
  for (const [k, val] of Object.entries(v.custom)) if (val) keys.push(`cf_${k}`);
  return keys;
}

export function hasActiveFilters(v: SupplierFilterValues) {
  return activeKeys(v).length > 0;
}

// Calendar day (YYYY-MM-DD) of an instant in the viewer's timezone.
function dayIn(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function matchesFilters(
  s: SupplierListItem,
  v: SupplierFilterValues,
  ctx: Pick<SupplierExtras, "commodities" | "regions" | "customFields"> & { timeZone: string },
): boolean {
  if (v.status === "active" && (s.blocked || s.inactive)) return false;
  if (v.status === "blocked" && !s.blocked) return false;
  if (v.status === "initialBlock" && !s.initialBlock) return false;
  if (v.status === "rated" && s.ratingCount === 0) return false;
  if (v.docStatus || v.docType) {
    const hit = s.docs.some((d) => (!v.docType || d.typeId === v.docType) && (!v.docStatus || d.status === v.docStatus));
    if (!hit) return false;
  }
  // Commodity / region: the chosen node or anything below it.
  if (v.commodity && !ancestorChain(ctx.commodities, s.commodity).includes(v.commodity)) return false;
  if (v.region && !ancestorChain(ctx.regions, s.region).includes(v.region)) return false;
  if (v.createdFrom || v.createdTo) {
    const day = dayIn(s.createdAt, ctx.timeZone);
    if (v.createdFrom && day < v.createdFrom) return false;
    if (v.createdTo && day > v.createdTo) return false;
  }
  if (v.creator && s.creatorId !== v.creator) return false;
  for (const f of ctx.customFields) {
    const wanted = v.custom[f.key];
    if (!wanted) continue;
    const have = s.custom[f.key] ?? "";
    if (f.type === "TREE") {
      // The chosen value or any of its descendants.
      const byValue = new Map(f.options.map((o) => [o.value, o]));
      let cur = byValue.get(have);
      let ok = false;
      for (let i = 0; cur && i < 50; i++) {
        if (cur.value === wanted) {
          ok = true;
          break;
        }
        cur = cur.parent ? byValue.get(cur.parent) : undefined;
      }
      if (!ok) return false;
    } else if (hasOptions(f.type) || f.type === "CHECKBOX") {
      if (have !== wanted) return false;
    } else if (!have.toLowerCase().includes(wanted.toLowerCase())) return false;
  }
  return true;
}

// Every control is the same height (matching the tree pickers) and fills its grid cell.
const selectClass =
  "h-[38px] w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

// Filter bar above the suppliers list. The search box is always there; every
// other filter (including commodity, region, creation date, creator and the
// custom fields) can be added or removed from "More filters", per user.
export function SupplierFilters({
  query,
  setQuery,
  values,
  setValues,
  docTypes,
  extras,
  creators,
}: {
  query: string;
  setQuery: (q: string) => void;
  values: SupplierFilterValues;
  setValues: (v: SupplierFilterValues) => void;
  docTypes: DocTypeOption[];
  extras: SupplierExtras;
  creators: { id: string; name: string }[];
}) {
  const { t, language } = usePreferences();
  const customFields = extras.customFields.filter((f) => f.visible);

  const available = [
    { key: "status", label: t("suppliersScreen.filterStatus") },
    ...(docTypes.length > 0
      ? [
          { key: "docStatus", label: t("suppliersScreen.filterDocStatus") },
          { key: "docType", label: t("suppliersScreen.filterDocType") },
        ]
      : []),
    { key: "commodity", label: t("suppliersScreen.commodity") },
    { key: "region", label: t("suppliersScreen.region") },
    { key: "createdDate", label: t("suppliersScreen.filterCreatedDate") },
    ...(creators.length > 0 ? [{ key: "creator", label: t("suppliersScreen.filterCreator") }] : []),
    ...customFields.map((f) => ({
      key: `cf_${f.key}`,
      label: labelFor(f.labels, language, f.key),
      group: t("customFields.listFilterTitle"),
    })),
  ];
  const { visible, show, hide } = useVisibleFilters(PREF_KEY, DEFAULT_VISIBLE, activeKeys(values));
  const isShown = (key: string) => available.some((f) => f.key === key) && visible.has(key);

  function toggleFilter(key: string, shouldShow: boolean) {
    if (shouldShow) {
      show(key);
      return;
    }
    hide(key);
    // Hiding a filter also drops its value, so nothing filters invisibly.
    const next = { ...values, custom: { ...values.custom } };
    if (key === "status") next.status = "all";
    if (key === "docStatus") next.docStatus = "";
    if (key === "docType") next.docType = "";
    if (key === "commodity") next.commodity = "";
    if (key === "region") next.region = "";
    if (key === "createdDate") {
      next.createdFrom = "";
      next.createdTo = "";
    }
    if (key === "creator") next.creator = "";
    if (key.startsWith("cf_")) delete next.custom[key.slice(3)];
    setValues(next);
  }

  const set = (p: Partial<SupplierFilterValues>) => setValues({ ...values, ...p });
  const setCustom = (key: string, v: string) => setValues({ ...values, custom: { ...values.custom, [key]: v } });

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="search"
        className={selectClass}
        placeholder={t("suppliersScreen.searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isShown("status") && (
        <select className={selectClass} value={values.status} onChange={(e) => set({ status: e.target.value as StatusFilter })}>
          <option value="all">{t("suppliersScreen.filterAll")}</option>
          <option value="active">{t("suppliersScreen.filterActive")}</option>
          <option value="blocked">{t("suppliersScreen.filterBlocked")}</option>
          <option value="initialBlock">{t("suppliersScreen.filterInitialBlock")}</option>
          <option value="rated">{t("suppliersScreen.filterRated")}</option>
        </select>
      )}
      {docTypes.length > 0 && isShown("docStatus") && (
        <select
          className={selectClass}
          value={values.docStatus}
          onChange={(e) => set({ docStatus: e.target.value as SupplierFilterValues["docStatus"] })}
        >
          <option value="">{t("supplierDocs.filterDocsAny")}</option>
          <option value="expired">{t("supplierDocs.filterExpired")}</option>
          <option value="active">{t("supplierDocs.filterActiveDocs")}</option>
        </select>
      )}
      {docTypes.length > 0 && isShown("docType") && (
        <select className={selectClass} value={values.docType} onChange={(e) => set({ docType: e.target.value })}>
          <option value="">{t("supplierDocs.filterAnyType")}</option>
          {docTypes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}
      {isShown("commodity") && (
        <div>
          <TreePickerField
            nodes={extras.commodities.map((c) => ({ id: c.id, parentId: c.parentId, label: c.description, code: c.code }))}
            valueId={extras.commodities.find((c) => c.description === values.commodity)?.id ?? null}
            onChangeId={(id) => set({ commodity: extras.commodities.find((c) => c.id === id)?.description ?? "" })}
            placeholder={t("filters.allCommodities")}
            clearLabel={t("filters.allCommodities")}
          />
        </div>
      )}
      {isShown("region") && (
        <div>
          <TreePickerField
            nodes={extras.regions.map((r) => ({ id: r.id, parentId: r.parentId, label: r.description, code: r.code }))}
            valueId={extras.regions.find((r) => r.description === values.region)?.id ?? null}
            onChangeId={(id) => set({ region: extras.regions.find((r) => r.id === id)?.description ?? "" })}
            placeholder={t("filters.allRegions")}
            clearLabel={t("filters.allRegions")}
          />
        </div>
      )}
      {isShown("createdDate") && (
        <div className="flex items-center gap-2 text-sm text-slate-500 sm:col-span-2">
          <span className="shrink-0">{t("suppliersScreen.filterCreatedDate")}</span>
          <input
            type="date"
            aria-label={t("filters.from")}
            className={selectClass}
            value={values.createdFrom}
            onChange={(e) => set({ createdFrom: e.target.value })}
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            aria-label={t("filters.to")}
            className={selectClass}
            value={values.createdTo}
            onChange={(e) => set({ createdTo: e.target.value })}
          />
        </div>
      )}
      {creators.length > 0 && isShown("creator") && (
        <select className={selectClass} value={values.creator} onChange={(e) => set({ creator: e.target.value })}>
          <option value="">{t("suppliersScreen.filterAnyCreator")}</option>
          {creators.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      {customFields.map((f) => {
        const key = `cf_${f.key}`;
        if (!isShown(key)) return null;
        return <CustomFilter key={key} field={f} value={values.custom[f.key] ?? ""} onChange={(v) => setCustom(f.key, v)} />;
      })}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-3">
        <FilterPicker filters={available} visible={visible} onToggle={toggleFilter} />
        {hasActiveFilters(values) && (
          <button
            type="button"
            onClick={() => setValues(EMPTY_FILTERS)}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {t("filters.clear")}
          </button>
        )}
      </div>
    </div>
    </div>
  );
}

function CustomFilter({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t, language } = usePreferences();
  const label = labelFor(field.labels, language, field.key);
  if (field.type === "TREE") {
    return (
      <div>
        <TreePickerField
          nodes={treeNodes(field.options, language, value)}
          valueId={value || null}
          onChangeId={(id) => onChange(id ?? "")}
          placeholder={label}
          clearLabel={label}
        />
      </div>
    );
  }
  if (hasOptions(field.type) || field.type === "CHECKBOX") {
    return (
      <select aria-label={label} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {label}: {t("customFields.listFilterAll")}
        </option>
        {field.type === "CHECKBOX" ? (
          <>
            <option value="true">{t("customFields.yes")}</option>
            <option value="false">{t("customFields.no")}</option>
          </>
        ) : (
          field.options
            .filter((o) => !o.hidden || o.value === value)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {optionLabel(o, language)}
              </option>
            ))
        )}
      </select>
    );
  }
  return <TextFilter label={label} value={value} onApply={onChange} />;
}

// Free-text custom field filter: applied after a short pause in typing.
function TextFilter({ label, value, onApply }: { label: string; value: string; onApply: (v: string) => void }) {
  const [text, setText] = useState(value);
  const applied = useRef(value);
  useEffect(() => {
    if (value !== applied.current) {
      applied.current = value;
      setText(value); // changed from outside (e.g. "clear filters")
    }
  }, [value]);
  useEffect(() => {
    if (text.trim() === applied.current) return;
    const timer = setTimeout(() => {
      applied.current = text.trim();
      onApply(text.trim());
    }, 400);
    return () => clearTimeout(timer);
    // onApply is recreated each render; only the typed text should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <input
      type="search"
      aria-label={label}
      className={selectClass}
      placeholder={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}
