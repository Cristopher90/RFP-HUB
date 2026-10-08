"use client";

import { useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import { UserMultiPicker, type PickableUser } from "@/components/UserMultiPicker";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { saveBuyerGroups } from "./actions";

type Row = { clientKey: string; id?: string; name: string; memberIds: string[] };

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function BuyerGroupsForm({
  initial,
  buyers,
  targetClientId,
}: {
  initial: { id: string; name: string; memberIds: string[] }[];
  buyers: PickableUser[];
  targetClientId: string;
}) {
  const { t } = usePreferences();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((g) => ({ ...g, clientKey: makeClientKey() })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(clientKey: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBuyerGroups(
        rows.map(({ id, name, memberIds }) => ({ id, name, memberIds })),
        targetClientId,
      );
      if ("error" in result) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("buyerGroupsForm.saved")}
        </div>
      )}
      {rows.length === 0 && (
        <p className="text-sm text-slate-400">{t("buyerGroupsForm.none")}</p>
      )}
      {rows.map((row) => (
        <section
          key={row.clientKey}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("buyerGroupsForm.groupName")}
              </label>
              <input
                className={inputClass()}
                placeholder={t("buyerGroupsForm.namePlaceholder")}
                value={row.name}
                onChange={(e) => update(row.clientKey, { name: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setRows((prev) => prev.filter((r) => r.clientKey !== row.clientKey));
              }}
              className="pb-2 text-sm font-medium text-red-600 hover:text-red-700"
            >
              {t("buyerGroupsForm.remove")}
            </button>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("buyerGroupsForm.members")}
            </label>
            <UserMultiPicker
              users={buyers}
              selectedIds={row.memberIds}
              onChange={(memberIds) => update(row.clientKey, { memberIds })}
            />
          </div>
        </section>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [...prev, { clientKey: makeClientKey(), name: "", memberIds: [] }])
          }
          className="text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          {t("buyerGroupsForm.addGroup")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("buyerGroupsForm.saving") : t("buyerGroupsForm.save")}
        </button>
      </div>
    </div>
  );
}
