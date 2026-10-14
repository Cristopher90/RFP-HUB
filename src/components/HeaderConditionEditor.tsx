"use client";

import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  CUSTOM_COND_PREFIX,
  STD_COND_FIELDS,
  type TemplateCondition,
} from "@/lib/templateConditions";
import { hasOptions, labelFor, optionLabel, type CustomFieldDef } from "@/lib/customFieldsShared";

function smallInputClass() {
  return "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Template-only control: "applies only if <header field> = <value>", where the
// header field is a standard one (commodity, region) or a custom header field.
export function HeaderConditionEditor({
  value,
  onChange,
  customFields,
}: {
  value: TemplateCondition | null | undefined;
  onChange: (next: TemplateCondition | null) => void;
  customFields: CustomFieldDef[];
}) {
  const { t, language } = usePreferences();
  const field = value?.field ?? "";
  const custom = field.startsWith(CUSTOM_COND_PREFIX)
    ? customFields.find((f) => f.key === field.slice(CUSTOM_COND_PREFIX.length))
    : undefined;

  function setField(next: string) {
    onChange(next ? { field: next, value: "" } : null);
  }
  function setValue(next: string) {
    if (value) onChange({ ...value, value: next });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select className={smallInputClass()} value={field} onChange={(e) => setField(e.target.value)}>
        <option value="">{t("rfpForm.noCondition")}</option>
        {STD_COND_FIELDS.map((f) => (
          <option key={f} value={f}>
            {f === "commodity" ? t("rfpForm.rfpCommodity") : t("rfpForm.rfpRegion")}
          </option>
        ))}
        {customFields.map((f) => (
          <option key={f.key} value={`${CUSTOM_COND_PREFIX}${f.key}`}>
            {labelFor(f.labels, language, f.key)}
          </option>
        ))}
      </select>
      {value && (
        <>
          <span className="text-xs text-slate-400">=</span>
          {custom && hasOptions(custom.type) ? (
            <select className={smallInputClass()} value={value.value} onChange={(e) => setValue(e.target.value)}>
              <option value="" />
              {custom.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {optionLabel(o, language)}
                </option>
              ))}
            </select>
          ) : custom?.type === "CHECKBOX" ? (
            <select className={smallInputClass()} value={value.value} onChange={(e) => setValue(e.target.value)}>
              <option value="" />
              <option value="true">{t("customFields.yes")}</option>
              <option value="false">{t("customFields.no")}</option>
            </select>
          ) : (
            <input
              className={`${smallInputClass()} w-40`}
              placeholder={t("templateForm.conditionValue")}
              value={value.value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </>
      )}
    </div>
  );
}
