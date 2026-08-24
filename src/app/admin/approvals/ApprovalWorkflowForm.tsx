"use client";

import { useId, useState, useTransition } from "react";
import { ROLE_LABEL } from "@/lib/roleLabels";
import { makeClientKey } from "@/lib/clientKey";
import type { UserRole } from "@/generated/prisma/enums";
import {
  createApprovalWorkflow,
  updateApprovalWorkflow,
  deleteApprovalWorkflow,
  type ApprovalWorkflowInput,
  type ApprovalLevelInput,
} from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

type LevelRow = Omit<ApprovalLevelInput, "stage"> & { clientKey: string };

function emptyLevel(): LevelRow {
  return {
    clientKey: makeClientKey(),
    mode: "ROLE",
    minRole: "SENIOR_BUYER",
    userIds: [],
    approvalGroupId: "",
    cumulative: false,
  };
}

function LevelListEditor({
  title,
  levels,
  onChange,
  groups,
  users,
}: {
  title: string;
  levels: LevelRow[];
  onChange: (levels: LevelRow[]) => void;
  groups: { id: string; description: string }[];
  users: { id: string; name: string }[];
}) {
  function update(clientKey: string, patch: Partial<LevelRow>) {
    onChange(levels.map((l) => (l.clientKey === clientKey ? { ...l, ...patch } : l)));
  }
  function remove(clientKey: string) {
    onChange(levels.filter((l) => l.clientKey !== clientKey));
  }
  function move(clientKey: string, dir: -1 | 1) {
    const idx = levels.findIndex((l) => l.clientKey === clientKey);
    const swap = idx + dir;
    if (idx === -1 || swap < 0 || swap >= levels.length) return;
    const next = [...levels];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...levels, emptyLevel()])}
          className="text-xs font-medium text-violet-600 hover:text-violet-700"
        >
          + Agregar nivel
        </button>
      </div>
      {levels.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Sin niveles — esta etapa no requiere aprobación.
        </p>
      )}
      <div className="mt-3 space-y-3">
        {levels.map((level, i) => (
          <div
            key={level.clientKey}
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Aprobador {i + 1}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(level.clientKey, -1)}
                  className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === levels.length - 1}
                  onClick={() => move(level.clientKey, 1)}
                  className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(level.clientKey)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Quitar
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={level.mode === "ROLE"}
                  onChange={() => update(level.clientKey, { mode: "ROLE" })}
                />
                Rol mínimo
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={level.mode === "USERS"}
                  onChange={() => update(level.clientKey, { mode: "USERS" })}
                />
                Personas específicas
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={level.mode === "GROUP"}
                  onChange={() => update(level.clientKey, { mode: "GROUP" })}
                />
                Grupo (por valor)
              </label>
            </div>

            {level.mode === "ROLE" && (
              <select
                className={`${inputClass()} mt-2`}
                value={level.minRole}
                onChange={(e) =>
                  update(level.clientKey, { minRole: e.target.value as UserRole })
                }
              >
                {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]} o superior
                  </option>
                ))}
              </select>
            )}

            {level.mode === "USERS" && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                {users.length === 0 && (
                  <p className="text-xs text-slate-400">No hay usuarios.</p>
                )}
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={level.userIds.includes(u.id)}
                      onChange={(e) =>
                        update(level.clientKey, {
                          userIds: e.target.checked
                            ? [...level.userIds, u.id]
                            : level.userIds.filter((id) => id !== u.id),
                        })
                      }
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            )}

            {level.mode === "GROUP" && (
              <div className="mt-2 space-y-2">
                <select
                  className={inputClass()}
                  value={level.approvalGroupId}
                  onChange={(e) =>
                    update(level.clientKey, { approvalGroupId: e.target.value })
                  }
                >
                  <option value="">Selecciona un grupo</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.description}
                    </option>
                  ))}
                </select>
                <label className="flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={level.cumulative}
                    onChange={(e) =>
                      update(level.clientKey, { cumulative: e.target.checked })
                    }
                  />
                  <span>
                    Acumulativo: se van sumando los límites de aprobación de
                    quienes aprueban hasta cubrir el valor de la RFP. Si no
                    está marcado, aprueba cualquiera del grupo cuyo límite
                    individual ya cubra ese valor.
                  </span>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApprovalWorkflowForm({
  workflowId,
  initial,
  templates,
  users,
  groups,
}: {
  workflowId?: string;
  initial?: ApprovalWorkflowInput;
  templates: { id: string; name: string }[];
  users: { id: string; name: string }[];
  groups: { id: string; description: string }[];
}) {
  const idBase = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [publishLevels, setPublishLevels] = useState<LevelRow[]>(
    () =>
      initial?.levels
        .filter((l) => l.stage === "PUBLISH")
        .map((l) => ({ ...l, clientKey: makeClientKey() })) ?? [],
  );
  const [awardLevels, setAwardLevels] = useState<LevelRow[]>(
    () =>
      initial?.levels
        .filter((l) => l.stage === "AWARD")
        .map((l) => ({ ...l, clientKey: makeClientKey() })) ?? [],
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
      levels: [
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...publishLevels.map(({ clientKey: _clientKey, ...l }) => ({
          ...l,
          stage: "PUBLISH" as const,
        })),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ...awardLevels.map(({ clientKey: _clientKey, ...l }) => ({
          ...l,
          stage: "AWARD" as const,
        })),
      ],
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
          Cada etapa puede tener varios niveles en secuencia: el nivel N+1
          solo queda activo cuando el nivel N está aprobado. Una etapa sin
          niveles no requiere aprobación.
        </p>
        <div className="mt-4 space-y-4">
          <LevelListEditor
            title="Aprobación para publicar"
            levels={publishLevels}
            onChange={setPublishLevels}
            groups={groups}
            users={users}
          />
          <LevelListEditor
            title="Aprobación para adjudicar"
            levels={awardLevels}
            onChange={setAwardLevels}
            groups={groups}
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
