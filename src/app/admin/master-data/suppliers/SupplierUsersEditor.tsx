"use client";

import { useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import { resendSupplierInvitation, saveSupplierUsers, type SupplierUserItemInput } from "./actions";
import { usePreferences } from "@/i18n/PreferencesProvider";

function emptyRow(): SupplierUserItemInput {
  return { clientKey: makeClientKey(), name: "", lastName: "", email: "", isAdmin: false };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-500";
}

const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
};

// Nested under one SupplierDirectory row (see SupplierDirectoryForm.tsx):
// the contacts at that supplier who can log in to the supplier portal and
// see the RFPs sent to them. A new contact gets an invitation email and sets
// their own password on accepting; only Accepted contacts can be invited to
// an RFP. Saved separately from the directory row itself.
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
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(clientKey: string, patch: Partial<SupplierUserItemInput>) {
    setSuccess(null);
    setRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
  }

  function handleSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveSupplierUsers(supplierDirectoryId, rows);
      if ("error" in result) setError(result.error);
      else {
        setRows(result.rows.length > 0 ? result.rows : [emptyRow()]);
        setSuccess(t("supplierUsersEditor.saved"));
      }
    });
  }

  function handleResend(linkId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await resendSupplierInvitation(linkId);
      if ("error" in result) setError(result.error);
      else setSuccess(t("supplierUsersEditor.resent"));
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
      <p className="mt-1 text-xs text-slate-500">{t("supplierUsersEditor.hint")}</p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-600">{success}</p>}
      <div className="mt-2 space-y-2">
        {rows.map((row) => {
          const saved = Boolean(row.status); // existing row: its email is its identity
          return (
            <div key={row.clientKey} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
              <input
                className={`${inputClass()} sm:col-span-2`}
                placeholder={t("supplierUsersEditor.firstName")}
                value={row.name}
                disabled={row.status === "ACCEPTED"}
                onChange={(e) => updateRow(row.clientKey, { name: e.target.value })}
              />
              <input
                className={`${inputClass()} sm:col-span-2`}
                placeholder={t("supplierUsersEditor.lastName")}
                value={row.lastName}
                disabled={row.status === "ACCEPTED"}
                onChange={(e) => updateRow(row.clientKey, { lastName: e.target.value })}
              />
              <input
                type="email"
                className={`${inputClass()} sm:col-span-3`}
                placeholder={t("supplierUsersEditor.email")}
                value={row.email}
                disabled={saved}
                onChange={(e) => updateRow(row.clientKey, { email: e.target.value })}
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-600 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={row.isAdmin}
                  onChange={(e) => updateRow(row.clientKey, { isAdmin: e.target.checked })}
                />
                {t("supplierUsersEditor.admin")}
              </label>
              <div className="flex items-center gap-2 sm:col-span-3">
                {row.status && (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[row.status]}`}
                  >
                    {t(`supplierUsersEditor.status${row.status}`)}
                  </span>
                )}
                {row.status === "SENT" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleResend(row.clientKey)}
                    className="text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50"
                  >
                    {t("supplierUsersEditor.resend")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => prev.filter((r) => r.clientKey !== row.clientKey))
                  }
                  className="ml-auto text-xs text-slate-400 hover:text-red-600"
                >
                  {t("supplierUsersEditor.remove")}
                </button>
              </div>
            </div>
          );
        })}
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
