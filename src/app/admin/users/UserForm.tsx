"use client";

import { useState, useTransition } from "react";
import { ROLE_LABEL } from "@/lib/roleLabels";
import type { UserRole } from "@/generated/prisma/enums";
import { createUser, updateUser, type UserFormInput } from "./actions";

const ROLES: UserRole[] = ["BUYER", "SENIOR_BUYER", "ADMIN"];

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function UserForm({
  userId,
  initial,
  groups = [],
}: {
  userId?: string;
  initial?: Omit<UserFormInput, "password">;
  groups?: { id: string; description: string }[];
}) {
  const [form, setForm] = useState<UserFormInput>({
    name: initial?.name ?? "",
    lastName: initial?.lastName ?? "",
    client: initial?.client ?? "",
    email: initial?.email ?? "",
    companyCode: initial?.companyCode ?? "",
    plant: initial?.plant ?? "",
    costCenter: initial?.costCenter ?? "",
    role: initial?.role ?? "BUYER",
    password: "",
    approvalLimit: initial?.approvalLimit ?? "",
    approvalGroupId: initial?.approvalGroupId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<UserFormInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = userId
        ? await updateUser(userId, form)
        : await createUser(form);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Datos del usuario
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nombre
            </label>
            <input
              className={inputClass()}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Apellido
            </label>
            <input
              className={inputClass()}
              value={form.lastName}
              onChange={(e) => update({ lastName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cliente
            </label>
            <input
              className={inputClass()}
              value={form.client}
              onChange={(e) => update({ client: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Correo
            </label>
            <input
              type="email"
              className={inputClass()}
              value={form.email}
              onChange={(e) => update({ email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Sociedad
            </label>
            <input
              className={inputClass()}
              value={form.companyCode}
              onChange={(e) => update({ companyCode: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Centro
            </label>
            <input
              className={inputClass()}
              value={form.plant}
              onChange={(e) => update({ plant: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Centro de coste
            </label>
            <input
              className={inputClass()}
              value={form.costCenter}
              onChange={(e) => update({ costCenter: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Grupo (rol)
            </label>
            <select
              className={inputClass()}
              value={form.role}
              onChange={(e) => update({ role: e.target.value as UserRole })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Valor de aprobación
            </label>
            <input
              type="number"
              min={0}
              step="any"
              className={inputClass()}
              value={form.approvalLimit}
              onChange={(e) => update({ approvalLimit: e.target.value })}
              placeholder="Sin límite"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Grupo de aprobación
            </label>
            <select
              className={inputClass()}
              value={form.approvalGroupId}
              onChange={(e) => update({ approvalGroupId: e.target.value })}
            >
              <option value="">Sin grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.description}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {userId
                ? "Nueva contraseña (dejar en blanco para no cambiarla)"
                : "Contraseña"}
            </label>
            <input
              type="password"
              className={inputClass()}
              value={form.password}
              onChange={(e) => update({ password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              required={!userId}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending
            ? "Guardando..."
            : userId
              ? "Guardar cambios"
              : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
