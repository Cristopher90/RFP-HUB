"use client";

import { useActionState, useState, useTransition } from "react";
import {
  login,
  loginSupplier,
  quickLoginAsUser,
  quickLoginAsSupplierUser,
} from "./actions";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { roleLabel } from "@/i18n/labels";
import type { UserRole } from "@/generated/prisma/enums";

export type LoginUserOption = {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  role: UserRole;
  clientDescription: string | null;
};

export type LoginSupplierUserOption = {
  id: string;
  name: string;
  lastName: string;
  email: string;
  companyName: string;
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function LoginForm({
  users,
  supplierUsers,
}: {
  users: LoginUserOption[];
  supplierUsers: LoginSupplierUserOption[];
}) {
  const { t, dictionary } = usePreferences();
  const [mode, setMode] = useState<"client" | "supplier">("client");
  const [clientState, clientFormAction, clientPending] = useActionState(login, {
    error: null,
  });
  const [supplierState, supplierFormAction, supplierPending] = useActionState(
    loginSupplier,
    { error: null },
  );
  const [quickPending, startQuickTransition] = useTransition();
  const [quickUserId, setQuickUserId] = useState(users[0]?.id ?? "");
  const [quickSupplierUserId, setQuickSupplierUserId] = useState(
    supplierUsers[0]?.id ?? "",
  );

  const state = mode === "client" ? clientState : supplierState;
  const formAction = mode === "client" ? clientFormAction : supplierFormAction;
  const pending = mode === "client" ? clientPending : supplierPending;

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("client")}
          className={`rounded-md px-3 py-1.5 ${
            mode === "client"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t("login.client")}
        </button>
        <button
          type="button"
          onClick={() => setMode("supplier")}
          className={`rounded-md px-3 py-1.5 ${
            mode === "supplier"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t("login.supplier")}
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("login.email")}
          </label>
          <input
            type="email"
            name="email"
            required
            className={inputClass()}
            placeholder="tu@empresa.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("login.password")}
          </label>
          <input
            type="password"
            name="password"
            required
            className={inputClass()}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending
            ? t("login.loggingIn")
            : mode === "client"
              ? t("login.signIn")
              : t("login.signInAsSupplier")}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-slate-50 px-2 text-slate-400">
            {t("login.demoHint")}
          </span>
        </div>
      </div>

      {mode === "client" ? (
        <div className="flex items-center gap-2">
          <select
            className={inputClass()}
            value={quickUserId}
            onChange={(e) => setQuickUserId(e.target.value)}
          >
            {users.length === 0 && <option value="">{t("login.noUsers")}</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.lastName ?? ""} — {roleLabel(dictionary, u.role)}
                {u.clientDescription ? ` (${u.clientDescription})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={quickPending || !quickUserId}
            onClick={() =>
              startQuickTransition(async () => {
                await quickLoginAsUser(quickUserId);
              })
            }
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-60"
          >
            {t("login.access")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            className={inputClass()}
            value={quickSupplierUserId}
            onChange={(e) => setQuickSupplierUserId(e.target.value)}
          >
            {supplierUsers.length === 0 && (
              <option value="">{t("login.noSupplierUsers")}</option>
            )}
            {supplierUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.lastName} — {u.companyName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={quickPending || !quickSupplierUserId}
            onClick={() =>
              startQuickTransition(async () => {
                await quickLoginAsSupplierUser(quickSupplierUserId);
              })
            }
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-60"
          >
            {t("login.access")}
          </button>
        </div>
      )}
    </div>
  );
}
