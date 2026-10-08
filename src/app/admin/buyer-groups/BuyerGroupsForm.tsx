"use client";

import { useMemo, useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import type { PickableUser } from "@/components/UserMultiPicker";
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const editing = rows.find((r) => r.clientKey === editingKey) ?? null;
  const visibleBuyers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((u) =>
      [u.name, u.lastName, u.email].join(" ").toLowerCase().includes(q),
    );
  }, [buyers, query]);

  function update(clientKey: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)));
  }

  function toggleMember(row: Row, userId: string) {
    update(row.clientKey, {
      memberIds: row.memberIds.includes(userId)
        ? row.memberIds.filter((id) => id !== userId)
        : [...row.memberIds, userId],
    });
  }

  function closeModal() {
    setEditingKey(null);
    setQuery("");
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

  const th = "px-5 py-3";

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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className={th}>{t("buyerGroupsForm.groupName")}</th>
              <th className={th}>{t("buyerGroupsForm.membersColumn")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                  {t("buyerGroupsForm.none")}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.clientKey} className="align-middle">
                <td className="px-5 py-3">
                  <input
                    className={inputClass()}
                    placeholder={t("buyerGroupsForm.namePlaceholder")}
                    value={row.name}
                    onChange={(e) => update(row.clientKey, { name: e.target.value })}
                  />
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                  {row.memberIds.length === 1
                    ? t("buyerGroupsForm.countOne")
                    : t("buyerGroupsForm.countMany").replace("{count}", String(row.memberIds.length))}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => setEditingKey(row.clientKey)}
                      className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                    >
                      {t("buyerGroupsForm.manageUsers")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSaved(false);
                        setRows((prev) => prev.filter((r) => r.clientKey !== row.clientKey));
                      }}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      {t("buyerGroupsForm.remove")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-900">
                {t("buyerGroupsForm.modalTitle")} · {editing.name || t("buyerGroupsForm.unnamed")}
              </h2>
              <input
                autoFocus
                className={`${inputClass()} mt-3`}
                placeholder={t("buyerGroupsForm.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {buyers.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">{t("buyerGroupsForm.noBuyers")}</p>
              ) : visibleBuyers.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">{t("buyerGroupsForm.noResults")}</p>
              ) : (
                visibleBuyers.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-violet-50"
                  >
                    <input
                      type="checkbox"
                      checked={editing.memberIds.includes(u.id)}
                      onChange={() => toggleMember(editing, u.id)}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-slate-800">
                        {u.name} {u.lastName}
                      </span>
                      <span className="ml-2 text-slate-500">{u.email}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 p-3">
              <span className="text-xs text-slate-500">
                {editing.memberIds.length === 1
                  ? t("buyerGroupsForm.countOne")
                  : t("buyerGroupsForm.countMany").replace("{count}", String(editing.memberIds.length))}
              </span>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
              >
                {t("buyerGroupsForm.done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
