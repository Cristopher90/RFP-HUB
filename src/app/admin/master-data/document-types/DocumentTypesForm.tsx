"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { ViewGroupPicker, type ViewGroupOption } from "@/components/ViewGroupPicker";
import { saveDocumentTypes, type DocumentTypeInput } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function DocumentTypesForm({
  initial,
  targetClientId,
  viewGroups,
}: {
  initial: DocumentTypeInput[];
  targetClientId: string;
  viewGroups: ViewGroupOption[];
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const [rows, setRows] = useState<DocumentTypeInput[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function patch(index: number, p: Partial<DocumentTypeInput>) {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...p } : r)));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveDocumentTypes(rows, targetClientId);
      if ("error" in result) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("supplierDocs.typesSaved")}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {rows.length === 0 && <p className="text-sm text-slate-400">{t("supplierDocs.typesEmpty")}</p>}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id ?? `new-${index}`} className="grid grid-cols-1 items-center gap-3 sm:grid-cols-12">
              <input
                className={`${inputClass()} sm:col-span-4`}
                placeholder={t("supplierDocs.typeName")}
                value={row.name}
                onChange={(e) => patch(index, { name: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input type="checkbox" checked={row.hasDates} onChange={(e) => patch(index, { hasDates: e.target.checked })} />
                {t("supplierDocs.hasDates")}
              </label>
              <div className="sm:col-span-3">
                {viewGroups.length > 0 ? (
                  <ViewGroupPicker
                    compact
                    groups={viewGroups}
                    value={row.viewGroupIds}
                    onChange={(next) => patch(index, { viewGroupIds: next })}
                    emptyLabel={t("supplierDocs.visibleToAll")}
                  />
                ) : (
                  <span className="text-xs text-slate-400">{t("supplierDocs.visibleToAll")}</span>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input type="checkbox" checked={row.active} onChange={(e) => patch(index, { active: e.target.checked })} />
                {t("supplierDocs.active")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setRows((prev) => prev.filter((_, i) => i !== index));
                }}
                className="text-sm text-slate-400 hover:text-red-600 sm:col-span-1"
              >
                {t("supplierDocs.remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [...prev, { name: "", hasDates: false, viewGroupIds: [], active: true }])
          }
          className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          + {t("supplierDocs.addType")}
        </button>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("supplierDocs.saving") : t("supplierDocs.save")}
        </button>
      </div>
    </div>
  );
}
