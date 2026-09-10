"use client";

import { useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import { saveSupplierUsers, type SupplierUserItemInput } from "./actions";
import { usePreferences } from "@/i18n/PreferencesProvider";

function emptyRow(): SupplierUserItemInput {
  return { clientKey: makeClientKey(), name: "", lastName: "", email: "", password: "" };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Nested under one SupplierDirectory row (see SupplierDirectoryForm.tsx):
// the contacts at that supplier who can log in to the supplier portal and
// see the RFPs sent to them. Saved separately from the directory row
// itself, since these carry hashed passwords rather than disposable data.
export function SupplierUsersEditor({
  supplierDirectoryId,
  initial,
}: {
  supplierDirectoryId: string;
  initial: SupplierUserItemInput[];
}) {
  const { t } = usePreferences();
  const [rows, setRows] = useState<SupplierUserItemInput[]>(
    initial.length > 0 ? initial : [emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function updateRow(clientKey: string, patch: Partial<SupplierUserItemInput>) {
    setSuccess(false);
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await saveSupplierUsers(supplierDirectoryId, rows);
      if ("error" in result) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-violet-800">
          {t("supplierUsersEditor.title")}
        </p>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="text-xs font-medium text-violet-600 hover:text-violet-700"
        >
          {t("supplierUsersEditor.add")}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-600">{t("supplierUsersEditor.saved")}</p>}
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.clientKey} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <input
              className={`${inputClass()} sm:col-span-3`}
              placeholder={t("supplierUsersEditor.firstName")}
              value={row.name}
              onChange={(e) => updateRow(row.clientKey, { name: e.target.value })}
            />
            <input
              className={`${inputClass()} sm:col-span-3`}
              placeholder={t("supplierUsersEditor.lastName")}
              value={row.lastName}
              onChange={(e) => updateRow(row.clientKey, { lastName: e.target.value })}
            />
            <input
              type="email"
              className={`${inputClass()} sm:col-span-3`}
              placeholder={t("supplierUsersEditor.email")}
              value={row.email}
              onChange={(e) => updateRow(row.clientKey, { email: e.target.value })}
            />
            <input
              type="password"
              className={`${inputClass()} sm:col-span-2`}
              placeholder={
                initial.some((i) => i.clientKey === row.clientKey)
                  ? t("supplierUsersEditor.leaveBlankToKeep")
                  : t("supplierUsersEditor.password")
              }
              value={row.password}
              onChange={(e) => updateRow(row.clientKey, { password: e.target.value })}
            />
            <button
              type="button"
              onClick={() =>
                setRows((prev) => prev.filter((r) => r.clientKey !== row.clientKey))
              }
              className="text-xs text-slate-400 hover:text-red-600 sm:col-span-1"
            >
              {t("supplierUsersEditor.remove")}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("supplierUsersEditor.saveUsers")}
        </button>
      </div>
    </div>
  );
}
