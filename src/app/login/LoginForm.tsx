"use client";

import { useActionState, useTransition } from "react";
import { login, quickLogin } from "./actions";
import type { UserRole } from "@/generated/prisma/enums";
import { ROLE_LABEL } from "@/lib/roleLabels";

const DEMO_ROLES: UserRole[] = ["BUYER", "SENIOR_BUYER", "ADMIN"];

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, { error: null });
  const [quickPending, startQuickTransition] = useTransition();

  return (
    <div className="w-full max-w-sm space-y-6">
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Correo
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
            Contraseña
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
          {pending ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-slate-50 px-2 text-slate-400">
            o entra como usuario demo
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DEMO_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            disabled={quickPending}
            onClick={() =>
              startQuickTransition(async () => {
                await quickLogin(role);
              })
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-violet-400 hover:text-violet-600 disabled:opacity-60"
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>
    </div>
  );
}
