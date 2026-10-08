"use client";

import { useActionState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { acceptInvitation } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function AcceptForm({ token, hasPassword }: { token: string; hasPassword: boolean }) {
  const { t } = usePreferences();
  const [state, formAction, pending] = useActionState(acceptInvitation.bind(null, token), {
    error: null as string | null,
  });
  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {t("supplierAccept.password")}
        </label>
        <input name="password" type="password" required autoComplete={hasPassword ? "current-password" : "new-password"} className={inputClass()} />
      </div>
      {!hasPassword && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("supplierAccept.confirmPassword")}
          </label>
          <input name="confirm" type="password" required autoComplete="new-password" className={inputClass()} />
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
      >
        {hasPassword ? t("supplierAccept.acceptConnection") : t("supplierAccept.setPasswordAndAccept")}
      </button>
    </form>
  );
}
