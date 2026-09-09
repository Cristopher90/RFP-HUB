"use client";

import { useId, useState, useTransition } from "react";
import { GearButton } from "@/components/GearButton";
import { TreePickerField } from "@/components/TreePickerField";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ROLE_LABEL } from "@/lib/roleLabels";
import { groupBySection, nextSectionName } from "@/lib/sections";
import { makeClientKey } from "@/lib/clientKey";
import type { UserRole } from "@/generated/prisma/enums";
import {
  saveTemplate,
  type SaveTemplateInput,
  type TemplateItemInput,
  type TemplateQuestionInput,
  type TemplateQuestionType,
  type TemplateQuestionVisibility,
} from "./actions";

const QUESTION_TYPE_LABEL: Record<TemplateQuestionType, string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  SELECT: "Opción múltiple",
  MONEY: "Dinero",
  ATTACHMENT: "Adjunto",
  YES_NO: "Sí / No",
};

const SUPPLIER_VISIBILITY_LABEL: Record<
  Exclude<TemplateQuestionVisibility, "INTERNAL">,
  string
> = {
  SUPPLIER_ONLY: "Solo proveedor (respuesta oculta para el comprador)",
  EXTERNAL: "Externa (visible para ambos)",
};

const LOCK_ROLES: UserRole[] = ["BUYER", "SENIOR_BUYER", "ADMIN"];

function emptyItem(): TemplateItemInput {
  return {
    section: null,
    name: "",
    description: "",
    quantity: 1,
    unit: "unidad",
    weight: 5,
    decimals: 2,
    customFields: [],
    lockMinRole: "BUYER",
  };
}

function emptySupplierQuestion(): TemplateQuestionInput {
  return {
    clientKey: makeClientKey(),
    section: null,
    text: "",
    type: "TEXT",
    options: [],
    required: true,
    weight: 5,
    isPrerequisite: false,
    visibility: "EXTERNAL",
    respondedBy: "SUPPLIER",
    numberMin: null,
    numberMax: null,
    dependsOnQuestionKey: null,
    dependsOnHeaderField: null,
    dependsOnValue: "",
    lockMinRole: "BUYER",
  };
}

function emptyInternalQuestion(): TemplateQuestionInput {
  return {
    clientKey: makeClientKey(),
    section: null,
    text: "",
    type: "TEXT",
    options: [],
    required: false,
    weight: 5,
    isPrerequisite: false,
    visibility: "INTERNAL",
    respondedBy: "BUYER",
    numberMin: null,
    numberMax: null,
    dependsOnQuestionKey: null,
    dependsOnHeaderField: null,
    dependsOnValue: "",
    lockMinRole: "BUYER",
  };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function smallInputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function TemplateForm({
  templateId,
  initial,
  commodities,
  regions,
}: {
  templateId?: string;
  commodities: {
    id: string;
    parentId: string | null;
    code: string;
    description: string;
  }[];
  regions: {
    id: string;
    parentId: string | null;
    code: string;
    description: string;
  }[];
  initial?: {
    name: string;
    description: string;
    matchCommodity: string;
    matchRegion: string;
    active: boolean;
    hideResponsesUntilClosed: boolean;
    items: TemplateItemInput[];
    questions: TemplateQuestionInput[];
  };
}) {
  const idBase = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [matchCommodity, setMatchCommodity] = useState(
    initial?.matchCommodity ?? "",
  );
  const [matchRegion, setMatchRegion] = useState(initial?.matchRegion ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [hideResponsesUntilClosed, setHideResponsesUntilClosed] = useState(
    initial?.hideResponsesUntilClosed ?? false,
  );
  const [items, setItems] = useState<TemplateItemInput[]>(
    initial?.items && initial.items.length > 0 ? initial.items : [emptyItem()],
  );
  const initialSupplierQuestions =
    initial?.questions?.filter((q) => q.respondedBy !== "BUYER") ?? [];
  const initialInternalQuestions =
    initial?.questions?.filter((q) => q.respondedBy === "BUYER") ?? [];
  const [questions, setQuestions] = useState<TemplateQuestionInput[]>(
    initialSupplierQuestions.length > 0
      ? initialSupplierQuestions
      : [emptySupplierQuestion()],
  );
  const [internalQuestions, setInternalQuestions] = useState<
    TemplateQuestionInput[]
  >(
    initialInternalQuestions.length > 0
      ? initialInternalQuestions
      : [emptyInternalQuestion()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [expandedInternalQuestions, setExpandedInternalQuestions] = useState<
    Set<number>
  >(new Set());

  function updateItem(index: number, patch: Partial<TemplateItemInput>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function toggleExpandedItem(index: number) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleExpandedQuestion(index: number) {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleExpandedInternalQuestion(index: number) {
    setExpandedInternalQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function addItemSection() {
    setItems((prev) => [
      ...prev,
      { ...emptyItem(), section: nextSectionName(prev) },
    ]);
  }

  function insertItemAt(insertIndex: number, section: string | null) {
    setItems((prev) => {
      const next = [...prev];
      next.splice(insertIndex, 0, { ...emptyItem(), section });
      return next;
    });
  }

  function renameItemSection(oldName: string, newName: string) {
    const trimmed = newName.trim();
    setItems((prev) =>
      prev.map((it) =>
        it.section === oldName ? { ...it, section: trimmed || null } : it,
      ),
    );
  }

  function clearDependencyReferencesTo(clientKey: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.dependsOnQuestionKey === clientKey
          ? {
              ...q,
              dependsOnQuestionKey: null,
              dependsOnHeaderField: null,
              dependsOnValue: "",
            }
          : q,
      ),
    );
    setInternalQuestions((prev) =>
      prev.map((q) =>
        q.dependsOnQuestionKey === clientKey
          ? {
              ...q,
              dependsOnQuestionKey: null,
              dependsOnHeaderField: null,
              dependsOnValue: "",
            }
          : q,
      ),
    );
  }

  function updateQuestionIn(
    setter: React.Dispatch<React.SetStateAction<TemplateQuestionInput[]>>,
    index: number,
    patch: Partial<TemplateQuestionInput>,
  ) {
    setter((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function insertQuestionInto(
    setter: React.Dispatch<React.SetStateAction<TemplateQuestionInput[]>>,
    makeEmpty: () => TemplateQuestionInput,
    insertIndex: number,
    section: string | null,
  ) {
    setter((prev) => {
      const next = [...prev];
      next.splice(insertIndex, 0, { ...makeEmpty(), section });
      return next;
    });
  }

  function removeQuestionFrom(
    setter: React.Dispatch<React.SetStateAction<TemplateQuestionInput[]>>,
    index: number,
    clientKey: string,
  ) {
    clearDependencyReferencesTo(clientKey);
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function renameQuestionSectionIn(
    setter: React.Dispatch<React.SetStateAction<TemplateQuestionInput[]>>,
    oldName: string,
    newName: string,
  ) {
    const trimmed = newName.trim();
    setter((prev) =>
      prev.map((q) =>
        q.section === oldName ? { ...q, section: trimmed || null } : q,
      ),
    );
  }

  const updateQuestion = (
    index: number,
    patch: Partial<TemplateQuestionInput>,
  ) => updateQuestionIn(setQuestions, index, patch);
  const updateInternalQuestion = (
    index: number,
    patch: Partial<TemplateQuestionInput>,
  ) => updateQuestionIn(setInternalQuestions, index, patch);
  const removeQuestionAt = (index: number, clientKey: string) =>
    removeQuestionFrom(setQuestions, index, clientKey);
  const removeInternalQuestionAt = (index: number, clientKey: string) =>
    removeQuestionFrom(setInternalQuestions, index, clientKey);
  const insertQuestionAt = (insertIndex: number, section: string | null) =>
    insertQuestionInto(
      setQuestions,
      emptySupplierQuestion,
      insertIndex,
      section,
    );
  const insertInternalQuestionAt = (
    insertIndex: number,
    section: string | null,
  ) =>
    insertQuestionInto(
      setInternalQuestions,
      emptyInternalQuestion,
      insertIndex,
      section,
    );
  const renameQuestionSection = (oldName: string, newName: string) =>
    renameQuestionSectionIn(setQuestions, oldName, newName);
  const renameInternalQuestionSection = (oldName: string, newName: string) =>
    renameQuestionSectionIn(setInternalQuestions, oldName, newName);
  const addQuestionSection = () =>
    setQuestions((prev) => [
      ...prev,
      { ...emptySupplierQuestion(), section: nextSectionName(prev) },
    ]);
  const addInternalQuestionSection = () =>
    setInternalQuestions((prev) => [
      ...prev,
      { ...emptyInternalQuestion(), section: nextSectionName(prev) },
    ]);

  const allQuestionsForConditions = [
    ...questions.map((q) => ({ ...q, area: "proveedor" as const })),
    ...internalQuestions.map((q) => ({ ...q, area: "interna" as const })),
  ];

  function conditionSelect(
    q: TemplateQuestionInput,
    onChange: (patch: Partial<TemplateQuestionInput>) => void,
  ) {
    return (
      <select
        className={smallInputClass()}
        value={
          q.dependsOnHeaderField
            ? `header:${q.dependsOnHeaderField}`
            : q.dependsOnQuestionKey
              ? `question:${q.dependsOnQuestionKey}`
              : ""
        }
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange({
              dependsOnHeaderField: null,
              dependsOnQuestionKey: null,
              dependsOnValue: "",
            });
          } else if (v.startsWith("header:")) {
            onChange({
              dependsOnHeaderField: v.slice(7) as "commodity" | "region",
              dependsOnQuestionKey: null,
              dependsOnValue: "",
            });
          } else {
            onChange({
              dependsOnQuestionKey: v.slice(9),
              dependsOnHeaderField: null,
              dependsOnValue: "",
            });
          }
        }}
      >
        <option value="">Sin condición</option>
        <option value="header:commodity">Commodity de la RFP</option>
        <option value="header:region">Región de la RFP</option>
        {allQuestionsForConditions
          .filter(
            (other) => other.clientKey !== q.clientKey && other.text.trim(),
          )
          .map((other) => (
            <option
              key={other.clientKey}
              value={`question:${other.clientKey}`}
            >
              Pregunta ({other.area}): {other.text.slice(0, 40)}
            </option>
          ))}
      </select>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: SaveTemplateInput = {
      name,
      description,
      matchCommodity,
      matchRegion,
      active,
      hideResponsesUntilClosed,
      items,
      questions: [...questions, ...internalQuestions],
    };
    startTransition(async () => {
      const result = await saveTemplate(templateId ?? null, payload);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <CollapsibleSection
        title="Detalles de la plantilla"
        storageKey="template-details"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              placeholder="Ej. Estándar Hardware / IT"
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Aplica cuando el Commodity sea
            </label>
            <TreePickerField
              nodes={commodities.map((c) => ({
                id: c.id,
                parentId: c.parentId,
                label: c.description,
                code: c.code,
              }))}
              valueId={
                commodities.find((c) => c.description === matchCommodity)
                  ?.id ?? null
              }
              onChangeId={(id) => {
                const node = commodities.find((c) => c.id === id);
                setMatchCommodity(node?.description ?? "");
              }}
              placeholder="Cualquiera"
              clearLabel="Cualquiera"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Aplica cuando la Región sea
            </label>
            <TreePickerField
              nodes={regions.map((r) => ({
                id: r.id,
                parentId: r.parentId,
                label: r.description,
                code: r.code,
              }))}
              valueId={
                regions.find((r) => r.description === matchRegion)?.id ??
                null
              }
              onChangeId={(id) => {
                const node = regions.find((r) => r.id === id);
                setMatchRegion(node?.description ?? "");
              }}
              placeholder="Cualquiera"
              clearLabel="Cualquiera"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Plantilla activa (se aplica a nuevas RFPs que coincidan)
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={hideResponsesUntilClosed}
                onChange={(e) => setHideResponsesUntilClosed(e.target.checked)}
              />
              No mostrar respuestas de proveedores hasta el cierre (oferta a
              ciegas)
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Artículos por defecto"
        storageKey="template-items"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addItemSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar sección
            </button>
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    ...emptyItem(),
                    section: prev[prev.length - 1]?.section ?? null,
                  },
                ])
              }
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar artículo
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {groupBySection(items).map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.name !== null && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    Sección {group.sectionNumber}
                  </span>
                  <input
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="Nombre de la sección"
                    value={group.name}
                    onChange={(e) =>
                      renameItemSection(group.name!, e.target.value)
                    }
                  />
                </div>
              )}
              <div className="space-y-3">
                {group.entries.map(({ item, index, label }) => (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                      <div className="sm:col-span-4">
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-400">
                            {label}
                          </span>
                          <input
                            className={inputClass()}
                            placeholder="Nombre del artículo"
                            value={item.name}
                            onChange={(e) =>
                              updateItem(index, { name: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          className={inputClass()}
                          placeholder="Descripción"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(index, { description: e.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className={inputClass()}
                          placeholder="Cantidad"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, {
                              quantity: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <input
                          className={inputClass()}
                          placeholder="Unidad"
                          value={item.unit}
                          onChange={(e) =>
                            updateItem(index, { unit: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2 sm:col-span-2">
                        <GearButton
                          active={expandedItems.has(index)}
                          onClick={() => toggleExpandedItem(index)}
                          title="Configurar artículo"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          disabled={items.length === 1}
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    {expandedItems.has(index) && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-12">
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Peso (para puntaje)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className={smallInputClass()}
                            value={item.weight}
                            onChange={(e) =>
                              updateItem(index, {
                                weight: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Decimales del precio
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={4}
                            className={smallInputClass()}
                            value={item.decimals}
                            onChange={(e) =>
                              updateItem(index, {
                                decimals: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            No se puede quitar al crear la RFP salvo rol
                          </label>
                          <select
                            className={smallInputClass()}
                            value={item.lockMinRole}
                            onChange={(e) =>
                              updateItem(index, {
                                lockMinRole: e.target.value as UserRole,
                              })
                            }
                          >
                            {LOCK_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r === "BUYER"
                                  ? "Nadie (cualquiera puede quitarlo)"
                                  : `${ROLE_LABEL[r]} o superior`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-12">
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-500">
                              Campos adicionales (adhoc)
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(index, {
                                  customFields: [
                                    ...item.customFields,
                                    { label: "", value: "" },
                                  ],
                                })
                              }
                              className="text-xs font-medium text-violet-600 hover:text-violet-700"
                            >
                              + Agregar campo
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {item.customFields.map((field, fieldIndex) => (
                              <div key={fieldIndex} className="flex gap-1.5">
                                <input
                                  className={smallInputClass()}
                                  placeholder="Nombre (ej. Color)"
                                  value={field.label}
                                  onChange={(e) =>
                                    updateItem(index, {
                                      customFields: item.customFields.map(
                                        (f, i) =>
                                          i === fieldIndex
                                            ? { ...f, label: e.target.value }
                                            : f,
                                      ),
                                    })
                                  }
                                />
                                <input
                                  className={smallInputClass()}
                                  placeholder="Valor"
                                  value={field.value}
                                  onChange={(e) =>
                                    updateItem(index, {
                                      customFields: item.customFields.map(
                                        (f, i) =>
                                          i === fieldIndex
                                            ? { ...f, value: e.target.value }
                                            : f,
                                      ),
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItem(index, {
                                      customFields: item.customFields.filter(
                                        (_, i) => i !== fieldIndex,
                                      ),
                                    })
                                  }
                                  className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {group.name !== null && (
                <div className="mt-1 pl-11">
                  <button
                    type="button"
                    onClick={() =>
                      insertItemAt(
                        group.entries[group.entries.length - 1].index + 1,
                        group.name,
                      )
                    }
                    className="text-xs font-medium text-violet-500 hover:text-violet-700"
                  >
                    + Agregar artículo en esta sección
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Preguntas internas por defecto"
        subtitle="Las responde el comprador directamente; nunca se envían al proveedor."
        storageKey="template-internal-questions"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addInternalQuestionSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar sección
            </button>
            <button
              type="button"
              onClick={() =>
                insertInternalQuestionAt(
                  internalQuestions.length,
                  internalQuestions[internalQuestions.length - 1]?.section ??
                    null,
                )
              }
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar pregunta
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {groupBySection(internalQuestions).map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.name !== null && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    Sección {group.sectionNumber}
                  </span>
                  <input
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="Nombre de la sección"
                    value={group.name}
                    onChange={(e) =>
                      renameInternalQuestionSection(
                        group.name!,
                        e.target.value,
                      )
                    }
                  />
                </div>
              )}
              <div className="space-y-3">
                {group.entries.map(({ item: q, index, label }) => (
                  <div
                    key={q.clientKey}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                      <div className="sm:col-span-5">
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-400">
                            {label}
                          </span>
                          <input
                            className={inputClass()}
                            placeholder="Ej. Verificar antecedentes legales del proveedor"
                            value={q.text}
                            onChange={(e) =>
                              updateInternalQuestion(index, {
                                text: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          className={inputClass()}
                          value={q.type}
                          onChange={(e) =>
                            updateInternalQuestion(index, {
                              type: e.target.value as TemplateQuestionType,
                            })
                          }
                        >
                          {(
                            Object.keys(
                              QUESTION_TYPE_LABEL,
                            ) as TemplateQuestionType[]
                          ).map((t) => (
                            <option key={t} value={t}>
                              {QUESTION_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="flex h-full items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) =>
                              updateInternalQuestion(index, {
                                required: e.target.checked,
                              })
                            }
                          />
                          Obligatoria
                        </label>
                      </div>
                      <div className="flex justify-end gap-2 sm:col-span-3">
                        <GearButton
                          active={expandedInternalQuestions.has(index)}
                          onClick={() =>
                            toggleExpandedInternalQuestion(index)
                          }
                          title="Configurar pregunta"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            removeInternalQuestionAt(index, q.clientKey)
                          }
                          disabled={internalQuestions.length === 1}
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    {expandedInternalQuestions.has(index) && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-12">
                        {q.type === "SELECT" && (
                          <div className="sm:col-span-12">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              Opciones (separadas por coma)
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder="Ej. Sí, No, En proceso"
                              value={q.options.join(", ")}
                              onChange={(e) =>
                                updateInternalQuestion(index, {
                                  options: e.target.value
                                    .split(",")
                                    .map((o) => o.trim()),
                                })
                              }
                            />
                          </div>
                        )}
                        {q.type === "NUMBER" && (
                          <>
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-slate-500">
                                Mínimo permitido
                              </label>
                              <input
                                type="number"
                                step="any"
                                className={smallInputClass()}
                                value={q.numberMin ?? ""}
                                onChange={(e) =>
                                  updateInternalQuestion(index, {
                                    numberMin:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-slate-500">
                                Máximo permitido
                              </label>
                              <input
                                type="number"
                                step="any"
                                className={smallInputClass()}
                                value={q.numberMax ?? ""}
                                onChange={(e) =>
                                  updateInternalQuestion(index, {
                                    numberMax:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </>
                        )}
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Peso
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className={smallInputClass()}
                            value={q.weight}
                            onChange={(e) =>
                              updateInternalQuestion(index, {
                                weight: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            No se puede quitar ni editar salvo rol
                          </label>
                          <select
                            className={smallInputClass()}
                            value={q.lockMinRole}
                            onChange={(e) =>
                              updateInternalQuestion(index, {
                                lockMinRole: e.target.value as UserRole,
                              })
                            }
                          >
                            {LOCK_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r === "BUYER"
                                  ? "Nadie (cualquiera puede quitarla o editarla)"
                                  : `${ROLE_LABEL[r]} o superior`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-xs text-slate-400 sm:col-span-12">
                          Una pregunta condicionada solo aparece (y solo es
                          obligatoria) cuando se cumple la condición.
                        </p>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Condicionada a
                          </label>
                          {conditionSelect(q, (patch) =>
                            updateInternalQuestion(index, patch),
                          )}
                        </div>
                        {(q.dependsOnHeaderField ||
                          q.dependsOnQuestionKey !== null) && (
                          <div className="sm:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              Valor requerido para mostrarla
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder="Ej. Sí"
                              value={q.dependsOnValue}
                              onChange={(e) =>
                                updateInternalQuestion(index, {
                                  dependsOnValue: e.target.value,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {group.name !== null && (
                <div className="mt-1 pl-11">
                  <button
                    type="button"
                    onClick={() =>
                      insertInternalQuestionAt(
                        group.entries[group.entries.length - 1].index + 1,
                        group.name,
                      )
                    }
                    className="text-xs font-medium text-violet-500 hover:text-violet-700"
                  >
                    + Agregar pregunta en esta sección
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Preguntas por defecto para los proveedores"
        storageKey="template-supplier-questions"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addQuestionSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar sección
            </button>
            <button
              type="button"
              onClick={() =>
                insertQuestionAt(
                  questions.length,
                  questions[questions.length - 1]?.section ?? null,
                )
              }
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              + Agregar pregunta
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {groupBySection(questions).map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.name !== null && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    Sección {group.sectionNumber}
                  </span>
                  <input
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="Nombre de la sección"
                    value={group.name}
                    onChange={(e) =>
                      renameQuestionSection(group.name!, e.target.value)
                    }
                  />
                </div>
              )}
              <div className="space-y-3">
                {group.entries.map(({ item: q, index, label }) => (
                  <div
                    key={q.clientKey}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                      <div className="sm:col-span-5">
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-400">
                            {label}
                          </span>
                          <input
                            className={inputClass()}
                            placeholder="Ej. ¿Cuál es tu tiempo de entrega estimado?"
                            value={q.text}
                            onChange={(e) =>
                              updateQuestion(index, { text: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          className={inputClass()}
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(index, {
                              type: e.target.value as TemplateQuestionType,
                            })
                          }
                        >
                          {(
                            Object.keys(
                              QUESTION_TYPE_LABEL,
                            ) as TemplateQuestionType[]
                          ).map((t) => (
                            <option key={t} value={t}>
                              {QUESTION_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="flex h-full items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={q.required}
                            disabled={q.isPrerequisite}
                            onChange={(e) =>
                              updateQuestion(index, {
                                required: e.target.checked,
                              })
                            }
                          />
                          Obligatoria
                        </label>
                      </div>
                      <div className="flex justify-end gap-2 sm:col-span-3">
                        <GearButton
                          active={expandedQuestions.has(index)}
                          onClick={() => toggleExpandedQuestion(index)}
                          title="Configurar pregunta"
                        />
                        <button
                          type="button"
                          onClick={() => removeQuestionAt(index, q.clientKey)}
                          disabled={questions.length === 1}
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    {expandedQuestions.has(index) && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-12">
                        {q.type === "SELECT" && (
                          <div className="sm:col-span-12">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              Opciones (separadas por coma)
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder="Ej. Sí, No, En proceso"
                              value={q.options.join(", ")}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  options: e.target.value
                                    .split(",")
                                    .map((o) => o.trim()),
                                })
                              }
                            />
                          </div>
                        )}
                        {q.type === "NUMBER" && (
                          <>
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-slate-500">
                                Mínimo permitido
                              </label>
                              <input
                                type="number"
                                step="any"
                                className={smallInputClass()}
                                value={q.numberMin ?? ""}
                                onChange={(e) =>
                                  updateQuestion(index, {
                                    numberMin:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs font-medium text-slate-500">
                                Máximo permitido
                              </label>
                              <input
                                type="number"
                                step="any"
                                className={smallInputClass()}
                                value={q.numberMax ?? ""}
                                onChange={(e) =>
                                  updateQuestion(index, {
                                    numberMax:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                          </>
                        )}
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Peso
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className={smallInputClass()}
                            value={q.weight}
                            onChange={(e) =>
                              updateQuestion(index, {
                                weight: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            No se puede quitar ni editar salvo rol
                          </label>
                          <select
                            className={smallInputClass()}
                            value={q.lockMinRole}
                            onChange={(e) =>
                              updateQuestion(index, {
                                lockMinRole: e.target.value as UserRole,
                              })
                            }
                          >
                            {LOCK_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r === "BUYER"
                                  ? "Nadie (cualquiera puede quitarla o editarla)"
                                  : `${ROLE_LABEL[r]} o superior`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Visibilidad
                          </label>
                          <select
                            className={smallInputClass()}
                            value={q.visibility}
                            onChange={(e) =>
                              updateQuestion(index, {
                                visibility: e.target
                                  .value as TemplateQuestionVisibility,
                              })
                            }
                          >
                            {(
                              Object.keys(
                                SUPPLIER_VISIBILITY_LABEL,
                              ) as (keyof typeof SUPPLIER_VISIBILITY_LABEL)[]
                            ).map((v) => (
                              <option key={v} value={v}>
                                {SUPPLIER_VISIBILITY_LABEL[v]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end sm:col-span-4">
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={q.isPrerequisite}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  isPrerequisite: e.target.checked,
                                  required: e.target.checked
                                    ? true
                                    : q.required,
                                })
                              }
                            />
                            Es prerrequisito (debe aceptarla)
                          </label>
                        </div>
                        <p className="text-xs text-slate-400 sm:col-span-12">
                          Una pregunta condicionada solo aparece (y solo es
                          obligatoria) cuando se cumple la condición, aunque
                          sea obligatoria o prerrequisito.
                        </p>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Condicionada a
                          </label>
                          {conditionSelect(q, (patch) =>
                            updateQuestion(index, patch),
                          )}
                        </div>
                        {(q.dependsOnHeaderField ||
                          q.dependsOnQuestionKey !== null) && (
                          <div className="sm:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              Valor requerido para mostrarla
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder="Ej. Sí"
                              value={q.dependsOnValue}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  dependsOnValue: e.target.value,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {group.name !== null && (
                <div className="mt-1 pl-11">
                  <button
                    type="button"
                    onClick={() =>
                      insertQuestionAt(
                        group.entries[group.entries.length - 1].index + 1,
                        group.name,
                      )
                    }
                    className="text-xs font-medium text-violet-500 hover:text-violet-700"
                  >
                    + Agregar pregunta en esta sección
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar plantilla"}
        </button>
      </div>
    </form>
  );
}
