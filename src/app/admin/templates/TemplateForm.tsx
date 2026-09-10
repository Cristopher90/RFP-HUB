"use client";

import { useId, useState, useTransition } from "react";
import { GearButton } from "@/components/GearButton";
import { TreePickerField } from "@/components/TreePickerField";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { QuestionScoringFields } from "@/components/QuestionScoringFields";
import { ROLE_LEVEL } from "@/lib/roleLabels";
import { usePreferences } from "@/i18n/PreferencesProvider";
import type { Dictionary } from "@/i18n/getDictionary";
import {
  roleLabel,
  priceConditionLabel,
  questionTypeLabel,
  requiresAnswerLabel,
} from "@/i18n/labels";
import { groupBySection, nextSectionName } from "@/lib/sections";
import { makeClientKey } from "@/lib/clientKey";
import type { UserRole } from "@/generated/prisma/enums";
import {
  saveTemplate,
  type SaveTemplateInput,
  type TemplateItemInput,
  type TemplateQuestionInput,
  type TemplateQuestionType,
  type TemplateQuestionResponder,
  type TemplatePriceCondition,
} from "./actions";

const ALL_USER_ROLES = Object.keys(ROLE_LEVEL) as UserRole[];
const ALL_PRICE_CONDITIONS: TemplatePriceCondition[] = [
  "GREATER_THAN",
  "LESS_THAN",
  "BETWEEN",
];
const ALL_QUESTION_TYPES: TemplateQuestionType[] = [
  "TEXT",
  "NUMBER",
  "SELECT",
  "MONEY",
  "ATTACHMENT",
  "YES_NO",
  "INFO",
];
const ALL_REQUIRES_ANSWER: TemplateQuestionResponder[] = ["SUPPLIER", "BUYER"];

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
    lockRoles: [],
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
    scoringConfig: null,
    dependsOnQuestionKey: null,
    dependsOnHeaderField: null,
    dependsOnValue: "",
    lockRoles: [],
  };
}

function emptyInfoBlock(area: "external" | "internal"): TemplateQuestionInput {
  return {
    clientKey: makeClientKey(),
    section: null,
    text: "",
    type: "INFO",
    options: [],
    required: false,
    weight: 1,
    isPrerequisite: false,
    visibility: area === "internal" ? "INTERNAL" : "EXTERNAL",
    respondedBy: area === "internal" ? "BUYER" : "SUPPLIER",
    numberMin: null,
    numberMax: null,
    scoringConfig: null,
    dependsOnQuestionKey: null,
    dependsOnHeaderField: null,
    dependsOnValue: "",
    lockRoles: [],
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
    scoringConfig: null,
    dependsOnQuestionKey: null,
    dependsOnHeaderField: null,
    dependsOnValue: "",
    lockRoles: [],
  };
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function smallInputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// "Editable/excluible por grupo": qué roles pueden editar/quitar este
// ítem o pregunta al crear la RFP a partir de esta plantilla — un
// conjunto explícito de roles (multi-selección), no un umbral jerárquico
// como antes (lockMinRole). Vacío = cualquiera puede.
function lockRolesField(
  selected: UserRole[],
  onChange: (roles: UserRole[]) => void,
  dictionary: Dictionary,
) {
  function toggle(role: UserRole) {
    onChange(
      selected.includes(role)
        ? selected.filter((r) => r !== role)
        : [...selected, role],
    );
  }
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {ALL_USER_ROLES.map((r) => (
        <label
          key={r}
          className="flex items-center gap-1.5 text-xs text-slate-600"
        >
          <input
            type="checkbox"
            checked={selected.includes(r)}
            onChange={() => toggle(r)}
          />
          {roleLabel(dictionary, r)}
        </label>
      ))}
    </div>
  );
}

export function TemplateForm({
  templateId,
  initial,
  commodities,
  regions,
  targetClientId,
}: {
  templateId?: string;
  targetClientId?: string;
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
    matchCommodityIncludeDescendants: boolean;
    matchRegion: string;
    matchRegionIncludeDescendants: boolean;
    matchPriceCondition: TemplatePriceCondition | null;
    matchPriceMin: number | null;
    matchPriceMax: number | null;
    active: boolean;
    hideResponsesUntilClosed: boolean;
    items: TemplateItemInput[];
    questions: TemplateQuestionInput[];
  };
}) {
  const { t, dictionary } = usePreferences();
  const idBase = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [matchCommodity, setMatchCommodity] = useState(
    initial?.matchCommodity ?? "",
  );
  const [matchCommodityIncludeDescendants, setMatchCommodityIncludeDescendants] =
    useState(initial?.matchCommodityIncludeDescendants ?? false);
  const [matchRegion, setMatchRegion] = useState(initial?.matchRegion ?? "");
  const [matchRegionIncludeDescendants, setMatchRegionIncludeDescendants] =
    useState(initial?.matchRegionIncludeDescendants ?? false);
  const [matchPriceCondition, setMatchPriceCondition] = useState<
    TemplatePriceCondition | null
  >(initial?.matchPriceCondition ?? null);
  const [matchPriceMin, setMatchPriceMin] = useState(
    initial?.matchPriceMin != null ? String(initial.matchPriceMin) : "",
  );
  const [matchPriceMax, setMatchPriceMax] = useState(
    initial?.matchPriceMax != null ? String(initial.matchPriceMax) : "",
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [hideResponsesUntilClosed, setHideResponsesUntilClosed] = useState(
    initial?.hideResponsesUntilClosed ?? false,
  );
  const [items, setItems] = useState<TemplateItemInput[]>(
    initial?.items && initial.items.length > 0 ? initial.items : [emptyItem()],
  );
  // Split by visibility, not respondedBy: a Contenido Externo question can
  // be "Interna" (respondedBy BUYER) and still belong to this section —
  // only visibility decides whether it's ever sent to the proveedor.
  const initialSupplierQuestions =
    initial?.questions?.filter((q) => q.visibility !== "INTERNAL") ?? [];
  const initialInternalQuestions =
    initial?.questions?.filter((q) => q.visibility === "INTERNAL") ?? [];
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
  const insertInfoBlockAt = (insertIndex: number, section: string | null) =>
    insertQuestionInto(
      setQuestions,
      () => emptyInfoBlock("external"),
      insertIndex,
      section,
    );
  const insertInternalInfoBlockAt = (
    insertIndex: number,
    section: string | null,
  ) =>
    insertQuestionInto(
      setInternalQuestions,
      () => emptyInfoBlock("internal"),
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
    ...questions.map((q) => ({ ...q, area: t("rfpForm.areaSupplier") })),
    ...internalQuestions.map((q) => ({ ...q, area: t("rfpForm.areaInternal") })),
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
        <option value="">{t("rfpForm.noCondition")}</option>
        <option value="header:commodity">{t("rfpForm.rfpCommodity")}</option>
        <option value="header:region">{t("rfpForm.rfpRegion")}</option>
        {allQuestionsForConditions
          .filter(
            (other) => other.clientKey !== q.clientKey && other.text.trim(),
          )
          .map((other) => (
            <option
              key={other.clientKey}
              value={`question:${other.clientKey}`}
            >
              {t("rfpForm.questionPrefix")} ({other.area}): {other.text.slice(0, 40)}
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
      matchCommodityIncludeDescendants,
      matchRegion,
      matchRegionIncludeDescendants,
      matchPriceCondition,
      matchPriceMin,
      matchPriceMax,
      active,
      hideResponsesUntilClosed,
      items,
      questions: [...questions, ...internalQuestions],
    };
    startTransition(async () => {
      const result = await saveTemplate(templateId ?? null, payload, targetClientId);
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
        title={t("templateForm.detailsTitle")}
        storageKey="template-details"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-name`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("templateForm.nameLabel")}
            </label>
            <input
              id={`${idBase}-name`}
              className={inputClass()}
              placeholder={t("templateForm.namePlaceholder")}
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
              {t("templateForm.descriptionLabel")}
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
              {t("templateForm.appliesWhenCommodity")}
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
              placeholder={t("templateForm.any")}
              clearLabel={t("templateForm.any")}
            />
            {matchCommodity && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={matchCommodityIncludeDescendants}
                  onChange={(e) =>
                    setMatchCommodityIncludeDescendants(e.target.checked)
                  }
                />
                {t("templateForm.includeDescendants")}
              </label>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("templateForm.appliesWhenRegion")}
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
              placeholder={t("templateForm.any")}
              clearLabel={t("templateForm.any")}
            />
            {matchRegion && (
              <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={matchRegionIncludeDescendants}
                  onChange={(e) =>
                    setMatchRegionIncludeDescendants(e.target.checked)
                  }
                />
                {t("templateForm.includeDescendants")}
              </label>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("templateForm.appliesWhenPrice")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={inputClass()}
                style={{ maxWidth: "12rem" }}
                value={matchPriceCondition ?? ""}
                onChange={(e) =>
                  setMatchPriceCondition(
                    (e.target.value || null) as TemplatePriceCondition | null,
                  )
                }
              >
                <option value="">{t("templateForm.any")}</option>
                {ALL_PRICE_CONDITIONS.map((v) => (
                  <option key={v} value={v}>
                    {priceConditionLabel(dictionary, v)}
                  </option>
                ))}
              </select>
              {(matchPriceCondition === "GREATER_THAN" ||
                matchPriceCondition === "BETWEEN") && (
                <input
                  type="number"
                  step="any"
                  placeholder={matchPriceCondition === "BETWEEN" ? t("templateForm.min") : t("templateForm.value")}
                  className={inputClass()}
                  style={{ maxWidth: "10rem" }}
                  value={matchPriceMin}
                  onChange={(e) => setMatchPriceMin(e.target.value)}
                />
              )}
              {matchPriceCondition === "BETWEEN" && (
                <span className="text-sm text-slate-400">{t("templateForm.and")}</span>
              )}
              {(matchPriceCondition === "LESS_THAN" ||
                matchPriceCondition === "BETWEEN") && (
                <input
                  type="number"
                  step="any"
                  placeholder={matchPriceCondition === "BETWEEN" ? t("templateForm.max") : t("templateForm.value")}
                  className={inputClass()}
                  style={{ maxWidth: "10rem" }}
                  value={matchPriceMax}
                  onChange={(e) => setMatchPriceMax(e.target.value)}
                />
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              {t("templateForm.activeLabel")}
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={hideResponsesUntilClosed}
                onChange={(e) => setHideResponsesUntilClosed(e.target.checked)}
              />
              {t("templateForm.blindOfferLabel")}
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("templateForm.defaultItemsTitle")}
        storageKey="template-items"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addItemSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {t("rfpForm.addSection")}
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
              {t("rfpForm.addItem")}
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
                    {t("rfpForm.sectionPrefix")} {group.sectionNumber}
                  </span>
                  <input
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder={t("rfpForm.sectionNamePlaceholder")}
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
                            placeholder={t("rfpForm.itemNamePlaceholder")}
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
                          placeholder={t("templateForm.descriptionLabel")}
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
                          placeholder={t("rfpForm.quantityPlaceholder")}
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
                          placeholder={t("rfpForm.unitPlaceholder")}
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
                          title={t("rfpForm.configureItem")}
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
                          {t("rfpForm.remove")}
                        </button>
                      </div>
                    </div>

                    {expandedItems.has(index) && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-12">
                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("templateForm.itemWeightLabel")}
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
                            {t("rfpForm.decimalsLabel")}
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
                            {t("templateForm.lockRolesLabel")}
                          </label>
                          {lockRolesField(item.lockRoles, (lockRoles) =>
                            updateItem(index, { lockRoles }),
                          dictionary)}
                          <p className="mt-1 text-[11px] text-slate-400">
                            {t("templateForm.unmarkedMeansAnyoneItem")}
                          </p>
                        </div>
                        <div className="sm:col-span-12">
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-500">
                              {t("rfpForm.additionalFieldsLabel")}
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
                              {t("rfpForm.addField")}
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {item.customFields.map((field, fieldIndex) => (
                              <div key={fieldIndex} className="flex gap-1.5">
                                <input
                                  className={smallInputClass()}
                                  placeholder={t("rfpForm.fieldNamePlaceholder")}
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
                                  placeholder={t("templateForm.fieldValuePlaceholder")}
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
                    {t("rfpForm.addItemInSection")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("templateForm.internalContentTitle")}
        subtitle={t("templateForm.internalContentSubtitle")}
        storageKey="template-internal-questions"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addInternalQuestionSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {t("rfpForm.addSection")}
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
              {t("rfpForm.addQuestion")}
            </button>
            <button
              type="button"
              onClick={() =>
                insertInternalInfoBlockAt(
                  internalQuestions.length,
                  internalQuestions[internalQuestions.length - 1]?.section ??
                    null,
                )
              }
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {t("rfpForm.addText")}
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
                    {t("rfpForm.sectionPrefix")} {group.sectionNumber}
                  </span>
                  <input
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder={t("rfpForm.sectionNamePlaceholder")}
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
                            placeholder={t("rfpForm.internalQuestionPlaceholder")}
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
                          {ALL_QUESTION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {questionTypeLabel(dictionary, t)}
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
                          {t("rfpForm.required")}
                        </label>
                      </div>
                      <div className="flex justify-end gap-2 sm:col-span-3">
                        <GearButton
                          active={expandedInternalQuestions.has(index)}
                          onClick={() =>
                            toggleExpandedInternalQuestion(index)
                          }
                          title={t("rfpForm.configureQuestion")}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            removeInternalQuestionAt(index, q.clientKey)
                          }
                          disabled={internalQuestions.length === 1}
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          {t("rfpForm.remove")}
                        </button>
                      </div>
                    </div>

                    {expandedInternalQuestions.has(index) && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-12">
                        {q.type === "SELECT" && (
                          <div className="sm:col-span-12">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              {t("rfpForm.optionsLabel")}
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder={t("rfpForm.optionsPlaceholder")}
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
                                {t("rfpForm.minAllowed")}
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
                                {t("rfpForm.maxAllowed")}
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
                            {t("rfpForm.weightLabel")}
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
                            {t("templateForm.lockRolesLabel")}
                          </label>
                          {lockRolesField(q.lockRoles, (lockRoles) =>
                            updateInternalQuestion(index, { lockRoles }),
                          dictionary)}
                          <p className="mt-1 text-[11px] text-slate-400">
                            {t("templateForm.unmarkedMeansAnyoneQuestion")}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 sm:col-span-12">
                          {t("rfpForm.conditionalHintInternal")}
                        </p>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("rfpForm.conditionedOn")}
                          </label>
                          {conditionSelect(q, (patch) =>
                            updateInternalQuestion(index, patch),
                          )}
                        </div>
                        {(q.dependsOnHeaderField ||
                          q.dependsOnQuestionKey !== null) && (
                          <div className="sm:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              {t("rfpForm.requiredValueToShow")}
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder={t("rfpForm.exampleYes")}
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
                    {t("rfpForm.addQuestionInSection")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t("templateForm.externalContentTitle")}
        storageKey="template-supplier-questions"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addQuestionSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {t("rfpForm.addSection")}
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
              {t("rfpForm.addQuestion")}
            </button>
            <button
              type="button"
              onClick={() =>
                insertInfoBlockAt(
                  questions.length,
                  questions[questions.length - 1]?.section ?? null,
                )
              }
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {t("rfpForm.addText")}
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
                    {t("rfpForm.sectionPrefix")} {group.sectionNumber}
                  </span>
                  <input
                    className="flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-700 hover:border-slate-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder={t("rfpForm.sectionNamePlaceholder")}
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
                            placeholder={
                              q.type === "INFO"
                                ? t("rfpForm.infoTextPlaceholder")
                                : t("rfpForm.supplierQuestionPlaceholder")
                            }
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
                          {ALL_QUESTION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {questionTypeLabel(dictionary, t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {q.type !== "INFO" && (
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
                            {t("rfpForm.required")}
                          </label>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 sm:col-span-3">
                        <GearButton
                          active={expandedQuestions.has(index)}
                          onClick={() => toggleExpandedQuestion(index)}
                          title={t("rfpForm.configureQuestion")}
                        />
                        <button
                          type="button"
                          onClick={() => removeQuestionAt(index, q.clientKey)}
                          disabled={questions.length === 1}
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          {t("rfpForm.remove")}
                        </button>
                      </div>
                    </div>

                    {expandedQuestions.has(index) && (
                      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-12">
                        {q.type === "SELECT" && (
                          <div className="sm:col-span-12">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              {t("rfpForm.optionsLabel")}
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder={t("rfpForm.optionsPlaceholder")}
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
                                {t("rfpForm.minAllowed")}
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
                                {t("rfpForm.maxAllowed")}
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
                            {t("rfpForm.weightLabel")}
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
                        {q.respondedBy === "SUPPLIER" && (
                          <QuestionScoringFields
                            type={q.type}
                            options={q.options}
                            scoringConfig={q.scoringConfig}
                            onChange={(scoringConfig) =>
                              updateQuestion(index, { scoringConfig })
                            }
                          />
                        )}
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("templateForm.lockRolesLabel")}
                          </label>
                          {lockRolesField(q.lockRoles, (lockRoles) =>
                            updateQuestion(index, { lockRoles }),
                          dictionary)}
                          <p className="mt-1 text-[11px] text-slate-400">
                            {t("templateForm.unmarkedMeansAnyoneQuestion")}
                          </p>
                        </div>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("rfpForm.requiresAnswerFieldLabel")}
                          </label>
                          <select
                            className={smallInputClass()}
                            value={q.respondedBy}
                            onChange={(e) => {
                              // Solo cambia quién responde — la pregunta se
                              // queda en Contenido Externo (visibilidad
                              // EXTERNAL) sea cual sea la respuesta; nunca
                              // pasa a INTERNAL desde acá.
                              const respondedBy = e.target
                                .value as TemplateQuestionResponder;
                              updateQuestion(index, { respondedBy });
                            }}
                          >
                            {ALL_REQUIRES_ANSWER.map((v) => (
                              <option key={v} value={v}>
                                {requiresAnswerLabel(dictionary, v)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {q.respondedBy === "SUPPLIER" && (
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
                              {t("rfpForm.prerequisiteLabel")}
                            </label>
                          </div>
                        )}
                        {q.respondedBy === "BUYER" && (
                          <p className="text-xs text-slate-400 sm:col-span-12">
                            {t("templateForm.buyerAnswersLater")}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 sm:col-span-12">
                          {t("rfpForm.conditionalHintSupplier")}
                        </p>
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("rfpForm.conditionedOn")}
                          </label>
                          {conditionSelect(q, (patch) =>
                            updateQuestion(index, patch),
                          )}
                        </div>
                        {(q.dependsOnHeaderField ||
                          q.dependsOnQuestionKey !== null) && (
                          <div className="sm:col-span-4">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              {t("rfpForm.requiredValueToShow")}
                            </label>
                            <input
                              className={smallInputClass()}
                              placeholder={t("rfpForm.exampleYes")}
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
                    {t("rfpForm.addQuestionInSection")}
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
          {pending ? t("common.saving") : t("templateForm.saveTemplate")}
        </button>
      </div>
    </form>
  );
}
