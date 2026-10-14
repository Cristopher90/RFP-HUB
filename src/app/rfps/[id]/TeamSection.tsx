"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
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

  return (
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

      {canManage && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId) return;
            run(() => addRfpMember(rfpId, userId, permission), () => setUserId(""));
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t("rfpTeam.person")}</label>
            <select className={`${field} min-w-56`} value={userId} onChange={(e) => setUserId(e.target.value)}>
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
            <select className={field} value={permission} onChange={(e) => setPermission(e.target.value as "VIEW" | "EDIT")}>
              <option value="VIEW">{t("rfpTeam.canView")}</option>
              <option value="EDIT">{t("rfpTeam.canEdit")}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending || !userId}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {t("rfpTeam.add")}
          </button>
        </form>
      )}
      <p className="mt-3 text-xs text-slate-400">{t("rfpTeam.hint")}</p>
    </div>
  );
}
