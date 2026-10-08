"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  REQUEST_PLACEHOLDERS,
  RFP_ITEM_SOURCES,
  RFP_ITEM_TARGETS,
  type RfpItemSource,
  type RfpMapping,
} from "@/lib/requestFields";
import { saveRequestRfpMapping } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function RequestRfpMappingForm({
  initial,
  targetClientId,
}: {
  initial: RfpMapping;
  targetClientId: string;
}) {
  const { t } = usePreferences();
  const [mapping, setMapping] = useState<RfpMapping>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<RfpMapping>) {
    setSaved(false);
    setMapping((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveRequestRfpMapping(mapping, targetClientId);
      if ("error" in result) setError(result.error);
      else setSaved(true);
    });
  }

  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("requestRfpMappingForm.saved")}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t("requestRfpMappingForm.headerTitle")}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span>{t("requestRfpMappingForm.placeholdersHint")}</span>
          {REQUEST_PLACEHOLDERS.map((p) => (
            <code key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
              {`{${p}}`}
            </code>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelClass}>{t("requestRfpMappingForm.titleTemplate")}</label>
            <input
              className={inputClass()}
              value={mapping.titleTemplate}
              onChange={(e) => update({ titleTemplate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{t("requestRfpMappingForm.descriptionTemplate")}</label>
            <textarea
              className={inputClass()}
              rows={2}
              value={mapping.descriptionTemplate}
              onChange={(e) => update({ descriptionTemplate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{t("requestRfpMappingForm.predecessorTemplate")}</label>
            <input
              className={inputClass()}
              value={mapping.predecessorTemplate}
              onChange={(e) => update({ predecessorTemplate: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={mapping.estimatedFromLines}
              onChange={(e) => update({ estimatedFromLines: e.target.checked })}
            />
            {t("requestRfpMappingForm.estimatedFromLines")}
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t("requestRfpMappingForm.itemsTitle")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {RFP_ITEM_TARGETS.map((target) => (
            <div key={target}>
              <label className={labelClass}>{t(`rfpItemFields.${target}`)}</label>
              <select
                className={inputClass()}
                value={mapping.item[target]}
                onChange={(e) =>
                  update({
                    item: { ...mapping.item, [target]: e.target.value as RfpItemSource | "" },
                  })
                }
              >
                <option value="">{t("requestRfpMappingForm.notMapped")}</option>
                {RFP_ITEM_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {t(`requestLineFields.${source}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("requestRfpMappingForm.saving") : t("requestRfpMappingForm.save")}
        </button>
      </div>
    </div>
  );
}
