"use client";

import { TreePickerField } from "@/components/TreePickerField";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  CF_TEXT_MAX,
  CF_TEXT_SHORT_MAX,
  labelFor,
  optionLabel,
  treeNodes,
  visibleFields,
  type CfContext,
  type CustomFieldDef,
} from "@/lib/customFieldsShared";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50";
}

// One input per visible custom field (the condition of each is evaluated
// against `ctx` and the values typed so far). Values are plain strings keyed
// by field key — checkbox "true"/"false", amount/number as typed.
export function CustomFieldInputs({
  fields,
  values,
  onChange,
  ctx,
  slot,
  currency,
  disabled = false,
  columns = 2,
}: {
  fields: CustomFieldDef[];
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  ctx: CfContext;
  slot: "headerCustom" | "lineCustom" | "userCustom";
  currency: string;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}) {
  const { t, language } = usePreferences();
  // Hidden fields keep their value (conditions, mappings) but draw nothing.
  const visible = visibleFields(fields, values, ctx, slot).filter((f) => f.visible);
  if (visible.length === 0) return null;

  function set(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  const grid =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid gap-4 ${grid}`}>
      {visible.map((field) => {
        const label = labelFor(field.labels, language, field.key);
        const value = values[field.key] ?? "";
        const locked = disabled || !field.editable;
        const required = field.mandatory && field.type !== "CHECKBOX";
        return (
          <div key={field.key} data-custom-field={field.key}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {label}
              {required && <span className="text-red-500"> *</span>}
              {field.type === "AMOUNT" && (
                <span className="ml-1 text-xs font-normal text-slate-400">({currency})</span>
              )}
            </label>
            {field.type === "TREE" && (
              <TreePickerField
                nodes={treeNodes(field.options, language)}
                valueId={value || null}
                onChangeId={(id) => !locked && set(field.key, id ?? "")}
                placeholder={t("customFields.select")}
                clearLabel={t("customFields.select")}
              />
            )}
            {field.type === "DROPDOWN" && (
              <select
                className={inputClass()}
                value={value}
                disabled={locked}
                onChange={(e) => set(field.key, e.target.value)}
              >
                <option value="">{t("customFields.select")}</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {optionLabel(o, language)}
                  </option>
                ))}
              </select>
            )}
            {field.type === "TEXT" && (
              <input
                className={inputClass()}
                maxLength={CF_TEXT_MAX}
                value={value}
                disabled={locked}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
            {field.type === "TEXT_SHORT" && (
              <input
                className={inputClass()}
                maxLength={CF_TEXT_SHORT_MAX}
                value={value}
                disabled={locked}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
            {field.type === "NUMBER" && (
              <input
                className={inputClass()}
                type="number"
                step="any"
                value={value}
                disabled={locked}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
            {field.type === "AMOUNT" && (
              <input
                className={inputClass()}
                type="number"
                step="0.01"
                min="0"
                value={value}
                disabled={locked}
                onChange={(e) => set(field.key, e.target.value)}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value !== "" && Number.isFinite(n)) set(field.key, n.toFixed(2));
                }}
              />
            )}
            {field.type === "CHECKBOX" && (
              <label className="flex h-[38px] items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={value === "true"}
                  disabled={locked}
                  onChange={(e) => set(field.key, e.target.checked ? "true" : "false")}
                />
                {t("customFields.yes")}
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
