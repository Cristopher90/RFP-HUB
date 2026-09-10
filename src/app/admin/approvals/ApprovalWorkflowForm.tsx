"use client";

import { useId, useState, useTransition } from "react";
import { makeClientKey } from "@/lib/clientKey";
import { UserMultiPicker, type PickableUser } from "@/components/UserMultiPicker";
import { usePreferences } from "@/i18n/PreferencesProvider";
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
    mode: "USERS",
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
  users: PickableUser[];
}) {
  const { t } = usePreferences();
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
          {t("approvalWorkflowForm.addLevel")}
        </button>
      </div>
      {levels.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {t("approvalWorkflowForm.noLevels")}
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
                {t("approvalWorkflowForm.approver")} {i + 1}
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
                  {t("approvalWorkflowForm.remove")}
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={level.mode === "USERS"}
                  onChange={() => update(level.clientKey, { mode: "USERS" })}
                />
                {t("approvalWorkflowForm.specificPeople")}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={level.mode === "GROUP"}
                  onChange={() => update(level.clientKey, { mode: "GROUP" })}
                />
                {t("approvalWorkflowForm.groupByValue")}
              </label>
            </div>

            {level.mode === "USERS" && (
              <div className="mt-2">
                {users.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("approvalWorkflowForm.noUsers")}</p>
                ) : (
                  <UserMultiPicker
                    users={users}
                    selectedIds={level.userIds}
                    onChange={(userIds) => update(level.clientKey, { userIds })}
                  />
                )}
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
                  <option value="">{t("approvalWorkflowForm.selectGroup")}</option>
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
                  <span>{t("approvalWorkflowForm.cumulative")}</span>
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
  targetClientId,
}: {
  workflowId?: string;
  initial?: ApprovalWorkflowInput;
  templates: { id: string; name: string }[];
  users: PickableUser[];
  groups: { id: string; description: string }[];
  targetClientId?: string;
}) {
  const { t } = usePreferences();
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
        : await createApprovalWorkflow(payload, targetClientId);
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
          {t("approvalWorkflowForm.savedChanges")}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t("approvalWorkflowForm.detailsTitle")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-name`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("approvalWorkflowForm.name")}
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
              {t("approvalWorkflowForm.description")}
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
              {t("approvalWorkflowForm.active")}
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t("approvalWorkflowForm.stagesTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {t("approvalWorkflowForm.stagesSubtitle")}
        </p>
        <div className="mt-4 space-y-4">
          <LevelListEditor
            title={t("approvalWorkflowForm.publishStageTitle")}
            levels={publishLevels}
            onChange={setPublishLevels}
            groups={groups}
            users={users}
          />
          <LevelListEditor
            title={t("approvalWorkflowForm.awardStageTitle")}
            levels={awardLevels}
            onChange={setAwardLevels}
            groups={groups}
            users={users}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t("approvalWorkflowForm.templatesTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t("approvalWorkflowForm.templatesSubtitle")}
        </p>
        <div className="mt-4 space-y-1">
          {templates.length === 0 && (
            <p className="text-sm text-slate-400">{t("approvalWorkflowForm.noTemplates")}</p>
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
              if (confirm(t("approvalWorkflowForm.deleteConfirm"))) {
                startTransition(async () => {
                  await deleteApprovalWorkflow(workflowId);
                });
              }
            }}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            {t("approvalWorkflowForm.deleteProcess")}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}
