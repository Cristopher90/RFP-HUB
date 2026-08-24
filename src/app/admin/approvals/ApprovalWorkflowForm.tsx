"use client";

import { useId, useState, useTransition } from "react";
import { ROLE_LABEL } from "@/lib/roleLabels";
import type { UserRole } from "@/generated/prisma/enums";
import {
  createApprovalWorkflow,
  updateApprovalWorkflow,
  deleteApprovalWorkflow,
  type ApprovalWorkflowInput,
  type ApproverMode,
} from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function StageFields({
  title,
  required,
  onRequiredChange,
  mode,
  onModeChange,
  minRole,
  onMinRoleChange,
  userIds,
  onUserIdsChange,
  users,
}: {
  title: string;
  required: boolean;
  onRequiredChange: (v: boolean) => void;
  mode: ApproverMode;
  onModeChange: (v: ApproverMode) => void;
  minRole: UserRole;
  onMinRoleChange: (v: UserRole) => void;
  userIds: string[];
  onUserIdsChange: (v: string[]) => void;
  users: { id: string; name: string }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onRequiredChange(e.target.checked)}
        />
        {title}
      </label>
      {required && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={mode === "ROLE"}
                onChange={() => onModeChange("ROLE")}
              />
              Por rol mínimo
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={mode === "USERS"}
                onChange={() => onModeChange("USERS")}
              />
              Por personas específicas
            </label>
          </div>
          {mode === "ROLE" ? (
            <select
              className={inputClass()}
              value={minRole}
              onChange={(e) => onMinRoleChange(e.target.value as UserRole)}
            >
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} o superior
                </option>
              ))}
            </select>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {users.length === 0 && (
                <p className="text-xs text-slate-400">No hay usuarios.</p>
              )}
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={userIds.includes(u.id)}
                    onChange={(e) =>
                      onUserIdsChange(
                        e.target.checked
                          ? [...userIds, u.id]
                          : userIds.filter((id) => id !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ApprovalWorkflowForm({
  workflowId,
  initial,
  templates,
  users,
}: {
  workflowId?: string;
  initial?: ApprovalWorkflowInput;
  templates: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const idBase = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [publishRequired, setPublishRequired] = useState(
    initial?.publishRequired ?? true,
  );
  const [publishMode, setPublishMode] = useState<ApproverMode>(
    initial?.publishApproverMode ?? "ROLE",
  );
  const [publishMinRole, setPublishMinRole] = useState<UserRole>(
    initial?.publishMinRole ?? "SENIOR_BUYER",
  );
  const [publishUserIds, setPublishUserIds] = useState<string[]>(
    initial?.publishApproverUserIds ?? [],
  );
  const [awardRequired, setAwardRequired] = useState(
    initial?.awardRequired ?? true,
  );
  const [awardMode, setAwardMode] = useState<ApproverMode>(
    initial?.awardApproverMode ?? "ROLE",
  );
  const [awardMinRole, setAwardMinRole] = useState<UserRole>(
    initial?.awardMinRole ?? "SENIOR_BUYER",
  );
  const [awardUserIds, setAwardUserIds] = useState<string[]>(
    initial?.awardApproverUserIds ?? [],
  );
  const [templateIds, setTemplateIds] = useState<string[]>(
    initial?.templateIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const payload: ApprovalWorkflowInput = {
      name,
      description,
      active,
      publishRequired,
      publishApproverMode: publishMode,
      publishMinRole,
      publishApproverUserIds: publishUserIds,
      awardRequired,
      awardApproverMode: awardMode,
      awardMinRole,
      awardApproverUserIds: awardUserIds,
      templateIds,
    };
    startTransition(async () => {
      const result = workflowId
        ? await updateApprovalWorkflow(workflowId, payload)
        : await createApprovalWorkflow(payload);
      if (result && "error" in result) setError(result.error);
      else setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Cambios guardados.
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Detalles del proceso
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-name`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nombre
            </label>
            <input
              id={`${idBase}-name`}
              className={inputClass()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-description`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Descripción
            </label>
            <textarea
              id={`${idBase}-description`}
              className={inputClass()}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Proceso activo
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Etapas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Define si se requiere aprobación para publicar y/o para adjudicar,
          y quién puede aprobar cada una.
        </p>
        <div className="mt-4 space-y-4">
          <StageFields
            title="Aprobación para publicar"
            required={publishRequired}
            onRequiredChange={setPublishRequired}
            mode={publishMode}
            onModeChange={setPublishMode}
            minRole={publishMinRole}
            onMinRoleChange={setPublishMinRole}
            userIds={publishUserIds}
            onUserIdsChange={setPublishUserIds}
            users={users}
          />
          <StageFields
            title="Aprobación para adjudicar"
            required={awardRequired}
            onRequiredChange={setAwardRequired}
            mode={awardMode}
            onModeChange={setAwardMode}
            minRole={awardMinRole}
            onMinRoleChange={setAwardMinRole}
            userIds={awardUserIds}
            onUserIdsChange={setAwardUserIds}
            users={users}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Plantillas asignadas
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Las RFPs creadas a partir de estas plantillas quedarán sujetas a
          este proceso de aprobación. Puedes asignar una, varias o todas.
        </p>
        <div className="mt-4 space-y-1">
          {templates.length === 0 && (
            <p className="text-sm text-slate-400">No hay plantillas.</p>
          )}
          {templates.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={templateIds.includes(t.id)}
                onChange={(e) =>
                  setTemplateIds((prev) =>
                    e.target.checked
                      ? [...prev, t.id]
                      : prev.filter((id) => id !== t.id),
                  )
                }
              />
              {t.name}
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between">
        {workflowId ? (
          <button
            type="button"
            onClick={() => {
              if (confirm("¿Eliminar este proceso de aprobación?")) {
                startTransition(async () => {
                  await deleteApprovalWorkflow(workflowId);
                });
              }
            }}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Eliminar proceso
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
