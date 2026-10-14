"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { addRfpMember, removeRfpMember, setRfpMemberPermission } from "./teamActions";

export type TeamMemberView = { id: string; name: string; email: string; permission: "VIEW" | "EDIT" };
export type TeamCandidate = { id: string; name: string; email: string };

const field =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

// "Equipo" of an RFP: the owner plus the people given access, with view or edit
// permission. Whoever manages the team can change it in any RFP status.
export function TeamSection({
  rfpId,
  owner,
  members,
  candidates,
  canManage,
}: {
  rfpId: string;
  owner: { name: string; email: string } | null;
  members: TeamMemberView[];
  candidates: TeamCandidate[];
  canManage: boolean;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<"VIEW" | "EDIT">("VIEW");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string } | { success: true }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
      else {
        onOk?.();
        router.refresh();
      }
    });
  }

  const permissionLabel = (p: "VIEW" | "EDIT") => (p === "EDIT" ? t("rfpTeam.canEdit") : t("rfpTeam.canView"));

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setModalError(null);
    startTransition(async () => {
      const result = await addRfpMember(rfpId, userId, permission);
      if ("error" in result) setModalError(result.error);
      else {
        setAdding(false);
        setUserId("");
        router.refresh();
      }
    });
  }

  return (
    <CollapsibleSection
      title={t("rfpTeam.title")}
      subtitle={t("rfpTeam.subtitle")}
      defaultOpen={false}
      storageKey="rfp-detail-team"
      className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      right={
        canManage ? (
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setAdding(true);
            }}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            + {t("rfpTeam.addPerson")}
          </button>
        ) : undefined
      }
    >
    <div>
      {error && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-slate-100 text-sm">
        {owner && (
          <li className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-800">{owner.name}</span>
              <span className="ml-2 text-xs text-slate-500">{owner.email}</span>
            </span>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              {t("rfpTeam.owner")}
            </span>
          </li>
        )}
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-800">{m.name}</span>
              <span className="ml-2 text-xs text-slate-500">{m.email}</span>
            </span>
            {canManage ? (
              <>
                <select
                  className={field}
                  disabled={pending}
                  value={m.permission}
                  onChange={(e) => run(() => setRfpMemberPermission(m.id, e.target.value))}
                >
                  <option value="VIEW">{t("rfpTeam.canView")}</option>
                  <option value="EDIT">{t("rfpTeam.canEdit")}</option>
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(t("rfpTeam.confirmRemove").replace("{name}", m.name))) run(() => removeRfpMember(m.id));
                  }}
                  className="text-sm text-slate-400 hover:text-red-600"
                >
                  {t("rfpTeam.remove")}
                </button>
              </>
            ) : (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.permission === "EDIT" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {permissionLabel(m.permission)}
              </span>
            )}
          </li>
        ))}
        {!owner && members.length === 0 && <li className="py-2.5 text-slate-400">{t("rfpTeam.empty")}</li>}
      </ul>

      <p className="mt-3 text-xs text-slate-400">{t("rfpTeam.hint")}</p>
    </div>

      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-16"
          onClick={() => !pending && setAdding(false)}
        >
          <form
            onSubmit={submitAdd}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
          >
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">{t("rfpTeam.addPerson")}</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {modalError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">{t("rfpTeam.person")}</label>
                <select className={`${field} w-full`} value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus>
                  <option value="">{candidates.length === 0 ? t("rfpTeam.noCandidates") : t("rfpTeam.pickPerson")}</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">{t("rfpTeam.permission")}</label>
                <select
                  className={`${field} w-full`}
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as "VIEW" | "EDIT")}
                >
                  <option value="VIEW">{t("rfpTeam.canView")}</option>
                  <option value="EDIT">{t("rfpTeam.canEdit")}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => setAdding(false)}
                className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("rfpTeam.cancel")}
              </button>
              <button
                type="submit"
                disabled={pending || !userId}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {t("rfpTeam.add")}
              </button>
            </div>
          </form>
        </div>
      )}
    </CollapsibleSection>
  );
}
