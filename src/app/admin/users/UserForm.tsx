"use client";

import { useState, useTransition } from "react";
import { ROLE_LABEL } from "@/lib/roleLabels";
import { makeClientKey } from "@/lib/clientKey";
import { TreePickerField } from "@/components/TreePickerField";
import type { UserRole } from "@/generated/prisma/enums";
import { createUser, updateUser, type UserFormInput } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

type ApprovalGroupRow = { clientKey: string; approvalGroupId: string; limit: string };

export function UserForm({
  userId,
  initial,
  groups = [],
  clients,
  actorIsSuperAdmin,
}: {
  userId?: string;
  initial?: Omit<UserFormInput, "password">;
  groups?: { id: string; description: string }[];
  clients: { id: string; code: string; description: string }[];
  actorIsSuperAdmin: boolean;
}) {
  const ROLES: UserRole[] = actorIsSuperAdmin
    ? ["BUYER", "SENIOR_BUYER", "CLIENT_ADMIN", "ADMIN"]
    : ["BUYER", "SENIOR_BUYER", "CLIENT_ADMIN"];
  const [form, setForm] = useState<Omit<UserFormInput, "approvalGroups">>({
    name: initial?.name ?? "",
    lastName: initial?.lastName ?? "",
    clientId: initial?.clientId ?? null,
    email: initial?.email ?? "",
    companyCode: initial?.companyCode ?? "",
    plant: initial?.plant ?? "",
    costCenter: initial?.costCenter ?? "",
    role: initial?.role ?? "BUYER",
    password: "",
    allowFreeTextItems: initial?.allowFreeTextItems ?? true,
  });
  const [approvalGroupRows, setApprovalGroupRows] = useState<ApprovalGroupRow[]>(
    () =>
      initial?.approvalGroups?.map((g) => ({ ...g, clientKey: makeClientKey() })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateGroupRow(clientKey: string, patch: Partial<ApprovalGroupRow>) {
    setApprovalGroupRows((prev) =>
      prev.map((r) => (r.clientKey === clientKey ? { ...r, ...patch } : r)),
    );
  }
  function removeGroupRow(clientKey: string) {
    setApprovalGroupRows((prev) => prev.filter((r) => r.clientKey !== clientKey));
  }
  function addGroupRow() {
    setApprovalGroupRows((prev) => [
      ...prev,
      { clientKey: makeClientKey(), approvalGroupId: "", limit: "" },
    ]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: UserFormInput = {
      ...form,
      approvalGroups: approvalGroupRows.map(({ approvalGroupId, limit }) => ({
        approvalGroupId,
        limit,
      })),
    };
    startTransition(async () => {
      const result = userId
        ? await updateUser(userId, payload)
        : await createUser(payload);
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
          {actorIsSuperAdmin && form.role !== "ADMIN" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cliente
              </label>
              <TreePickerField
                nodes={clients.map((c) => ({
                  id: c.id,
                  parentId: null,
                  label: c.description,
                  code: c.code,
                }))}
                valueId={form.clientId}
                onChangeId={(id) => update({ clientId: id })}
                placeholder="Selecciona un cliente"
                clearLabel="— Ninguno —"
              />
            </div>
          )}
          {actorIsSuperAdmin && form.role === "ADMIN" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cliente
              </label>
              <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                Un Super Administrador no pertenece a un cliente.
              </p>
            </div>
          )}
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
              Rol
            </label>
            <select
              className={inputClass()}
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as UserRole;
                update({ role, clientId: role === "ADMIN" ? null : form.clientId });
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.allowFreeTextItems}
                onChange={(e) => update({ allowFreeTextItems: e.target.checked })}
              />
              Puede agregar artículos escribiendo la descripción libremente
              (si no, solo puede elegirlos desde el catálogo)
            </label>
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

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Grupos de aprobación
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Un usuario puede pertenecer a varios grupos, cada uno con su propio
          límite. Por ejemplo, hasta $100,000 en &ldquo;Aprobador IT&rdquo;
          pero sin ningún grupo asociado a otro tipo de compra, lo que exige
          aprobación desde $0.
        </p>
        <div className="mt-4 space-y-2">
          {approvalGroupRows.length === 0 && (
            <p className="text-xs text-slate-400">
              Sin grupos de aprobación asignados.
            </p>
          )}
          {approvalGroupRows.map((row) => (
            <div key={row.clientKey} className="flex items-center gap-3">
              <select
                className={inputClass()}
                value={row.approvalGroupId}
                onChange={(e) =>
                  updateGroupRow(row.clientKey, { approvalGroupId: e.target.value })
                }
              >
                <option value="">Selecciona un grupo</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.description}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="Monto"
                className={`${inputClass()} max-w-[10rem]`}
                value={row.limit}
                onChange={(e) => updateGroupRow(row.clientKey, { limit: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeGroupRow(row.clientKey)}
                className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addGroupRow}
          className="mt-3 text-xs font-medium text-violet-600 hover:text-violet-700"
        >
          + Agregar grupo
        </button>
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
