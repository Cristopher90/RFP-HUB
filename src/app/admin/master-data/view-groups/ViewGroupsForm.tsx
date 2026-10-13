"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { saveViewGroups, type ViewGroupInput } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function ViewGroupsForm({
  initial,
  targetClientId,
}: {
  initial: ViewGroupInput[];
  targetClientId: string;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const [rows, setRows] = useState<ViewGroupInput[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function patch(index: number, p: Partial<ViewGroupInput>) {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...p } : r)));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveViewGroups(rows, targetClientId);
      if ("error" in result) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("viewGroups.saved")}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {rows.length === 0 && <p className="text-sm text-slate-400">{t("viewGroups.empty")}</p>}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id ?? `new-${index}`} className="flex flex-wrap items-center gap-3">
              <input
                className={`${inputClass()} !w-56`}
                placeholder={t("viewGroups.name")}
                value={row.name}
                onChange={(e) => patch(index, { name: e.target.value })}
              />
              <input
                className={`${inputClass()} flex-1`}
                placeholder={t("viewGroups.description")}
                value={row.description}
                onChange={(e) => patch(index, { description: e.target.value })}
              />
              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setRows((prev) => prev.filter((_, i) => i !== index));
                }}
                className="text-sm text-slate-400 hover:text-red-600"
              >
                {t("viewGroups.remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { name: "", description: "" }])}
          className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          + {t("viewGroups.add")}
        </button>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("viewGroups.saving") : t("viewGroups.save")}
        </button>
      </div>
    </div>
  );
}
