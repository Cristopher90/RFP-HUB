"use client";

import { useId, useRef, useState, useTransition } from "react";
import { GearButton } from "@/components/GearButton";
import { TreePickerField } from "@/components/TreePickerField";
import { SupplierSearchPicker } from "@/components/SupplierSearchPicker";
import { ItemCatalogPicker, type ItemCatalogEntry } from "@/components/ItemCatalogPicker";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { QuestionScoringFields } from "@/components/QuestionScoringFields";
import { TemplatePicker } from "@/components/TemplatePicker";
import { PreviousRfpPicker } from "@/components/PreviousRfpPicker";
import { buildItemsFromSourceRfp } from "../rfpActions";
import { updateRfp } from "../[id]/actions";
import {
  matchesTemplate,
  splitConditionalTemplates,
  resolveAppliedTemplates,
  ancestorChain,
  type TemplatePriceCondition,
} from "@/lib/templateMatch";
import { groupBySection, nextSectionName } from "@/lib/sections";
import { makeClientKey } from "@/lib/clientKey";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { questionTypeLabel, requiresAnswerLabel } from "@/i18n/labels";
import type { UserRole } from "@/generated/prisma/enums";
import { parseRfpExcelFile } from "./excelImport";
import { downloadRfpExcel } from "./excelExport";
import {
  createRfp,
  type NewCustomField,
  type NewItemInput,
  type NewQuestionInput,
  type NewSupplierInput,
  type QuestionResponder,
  type QuestionType,
  type QuestionVisibility,
} from "./actions";

export type TemplateData = {
  id: string;
  name: string;
  description: string | null;
  matchCommodity: string | null;
  matchCommodityIncludeDescendants: boolean;
  matchRegion: string | null;
  matchRegionIncludeDescendants: boolean;
  matchPriceCondition: TemplatePriceCondition | null;
  matchPriceMin: number | null;
  matchPriceMax: number | null;
  items: {
    id: string;
    section: string | null;
    name: string;
    description: string;
    quantity: number;
    unit: string;
    weight: number;
    decimals: number;
    customFields: NewCustomField[];
    lockRoles: UserRole[];
  }[];
  questions: {
    id: string;
    section: string | null;
    text: string;
    type: QuestionType;
    options: string[];
    required: boolean;
    weight: number;
    isPrerequisite: boolean;
    visibility: QuestionVisibility;
    respondedBy: QuestionResponder;
    numberMin: number | null;
    numberMax: number | null;
    scoringConfig: Record<string, number> | null;
    lockRoles: UserRole[];
  }[];
};

function emptyItem(): NewItemInput {
  return {
    section: null,
    code: null,
    name: "",
    description: "",
    quantity: 1,
    unit: "unidad",
    weight: 5,
    decimals: 2,
    historicalPrice: null,
    commodity: null,
    customFields: [],
  };
}

function emptySupplierQuestion(): NewQuestionInput {
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
    buyerAnswerValue: "",
  };
}

function emptyInternalQuestion(): NewQuestionInput {
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
    buyerAnswerValue: "",
  };
}

function emptyInfoBlock(area: "external" | "internal"): NewQuestionInput {
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
    buyerAnswerValue: "",
  };
}

function emptySupplier(): NewSupplierInput {
  return { name: "", email: "", company: "", supplierDirectoryId: null };
}

function parsePrice(value: string): number | null {
  const n = Number(value);
  return value.trim() && !Number.isNaN(n) ? n : null;
}

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function smallInputClass() {
  return "w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(18, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

const ALL_QUESTION_TYPES: QuestionType[] = [
  "TEXT",
  "NUMBER",
  "SELECT",
  "MONEY",
  "ATTACHMENT",
  "YES_NO",
  "INFO",
];
const ALL_REQUIRES_ANSWER: QuestionResponder[] = ["SUPPLIER", "BUYER"];

export type RfpInitialData = {
  title: string;
  description: string;
  buyerName: string;
  deadlineAt: string;
  commodity: string;
  region: string;
  startDate: string;
  estimatedPrice: string;
  origin: string;
  predecessorDocument: string;
  basedOnRfpId: string | null;
  basedOnRfpLabel: string | null;
  selectedTemplateId?: string | null;
  isNextRound?: boolean;
  scoringEnabled: boolean;
  items: NewItemInput[];
  questions: NewQuestionInput[];
  internalQuestions: NewQuestionInput[];
  suppliers: NewSupplierInput[];
};

export function RfpForm({
  currentUserRole,
  currentUserName,
  templates,
  commodities,
  regions,
  origins,
  supplierDirectory,
  itemCatalog,
  allowFreeTextItems,
  creators,
  mode = "create",
  rfpId,
  initial,
}: {
  currentUserRole: UserRole;
  currentUserName: string;
  templates: TemplateData[];
  commodities: {
    id: string;
    parentId: string | null;
    code: string;
    description: string;
    selectable: boolean;
  }[];
  regions: {
    id: string;
    parentId: string | null;
    code: string;
    description: string;
  }[];
  origins: {
    id: string;
    parentId: string | null;
    code: string;
    description: string;
  }[];
  supplierDirectory: {
    id: string;
    code: string;
    taxId: string;
    companyName: string;
    contactFirstName: string;
    contactLastName: string;
    email: string;
    phone: string;
    contacts?: { id: string; name: string; email: string }[];
  }[];
  itemCatalog: ItemCatalogEntry[];
  allowFreeTextItems: boolean;
  creators: { id: string; name: string }[];
  mode?: "create" | "edit";
  rfpId?: string;
  initial?: RfpInitialData;
}) {
  const { t, dictionary } = usePreferences();
  const idBase = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [buyerName, setBuyerName] = useState(
    initial?.buyerName ?? currentUserName,
  );
  const [deadlineAt, setDeadlineAt] = useState(
    initial?.deadlineAt ?? defaultDeadline(),
  );
  const [commodity, setCommodity] = useState(initial?.commodity ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [estimatedPrice, setEstimatedPrice] = useState(
    initial?.estimatedPrice ?? "",
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initial?.selectedTemplateId ?? null,
  );
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [predecessorDocument, setPredecessorDocument] = useState(
    initial?.predecessorDocument ?? "",
  );
  const [basedOnRfpId, setBasedOnRfpId] = useState<string | null>(
    initial?.basedOnRfpId ?? null,
  );
  const [basedOnRfpLabel, setBasedOnRfpLabel] = useState<string | null>(
    initial?.basedOnRfpLabel ?? null,
  );
  const [loadingBasedOn, setLoadingBasedOn] = useState(false);
  const [items, setItems] = useState<NewItemInput[]>(
    () => initial?.items ?? syncTemplateItems([], "", "", null, null),
  );
  const [questions, setQuestions] = useState<NewQuestionInput[]>(
    () =>
      initial?.questions ??
      syncTemplateQuestions([], "", "", "EXTERNAL", null, null),
  );
  const [internalQuestions, setInternalQuestions] = useState<
    NewQuestionInput[]
  >(
    () =>
      initial?.internalQuestions ??
      syncTemplateQuestions([], "", "", "INTERNAL", null, null),
  );
  const [suppliers, setSuppliers] = useState<NewSupplierInput[]>(
    initial?.suppliers && initial.suppliers.length > 0
      ? initial.suppliers
      : [emptySupplier()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [weightingQuestionsEnabled, setWeightingQuestionsEnabled] = useState(
    initial?.scoringEnabled ?? false,
  );
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [expandedInternalQuestions, setExpandedInternalQuestions] = useState<
    Set<number>
  >(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  function syncTemplateItems(
    prev: NewItemInput[],
    newCommodity: string,
    newRegion: string,
    newPrice: number | null,
    newSelectedTemplateId: string | null,
  ) {
    const commodityChain = ancestorChain(commodities, newCommodity);
    const regionChain = ancestorChain(regions, newRegion);
    const rawMatching = templates.filter((t) =>
      matchesTemplate(t, commodityChain, regionChain, newPrice),
    );
    const matching = resolveAppliedTemplates(rawMatching, newSelectedTemplateId);
    const matchingTemplateIds = new Set(matching.map((t) => t.id));
    const kept = prev.filter(
      (item) =>
        !item.sourceTemplateId ||
        matchingTemplateIds.has(item.sourceTemplateId),
    );
    const existingSourceIds = new Set(
      kept.map((i) => i.sourceTemplateItemId).filter(Boolean),
    );
    const additions: NewItemInput[] = [];
    for (const t of matching) {
      for (const ti of t.items) {
        if (existingSourceIds.has(ti.id)) continue;
        additions.push({
          section: ti.section,
          code: null,
          name: ti.name,
          description: ti.description,
          quantity: ti.quantity,
          unit: ti.unit,
          weight: ti.weight,
          decimals: ti.decimals,
          historicalPrice: null,
          commodity: null,
          customFields: ti.customFields,
          sourceTemplateItemId: ti.id,
          sourceTemplateId: t.id,
          locked:
            ti.lockRoles.length > 0 && !ti.lockRoles.includes(currentUserRole),
        });
      }
    }
    if (additions.length === 0) {
      return kept.length === prev.length ? prev : kept;
    }
    return [...kept, ...additions];
  }

  function syncTemplateQuestions(
    prev: NewQuestionInput[],
    newCommodity: string,
    newRegion: string,
    areaFilter: "EXTERNAL" | "INTERNAL",
    newPrice: number | null,
    newSelectedTemplateId: string | null,
  ) {
    const commodityChain = ancestorChain(commodities, newCommodity);
    const regionChain = ancestorChain(regions, newRegion);
    const rawMatching = templates.filter((t) =>
      matchesTemplate(t, commodityChain, regionChain, newPrice),
    );
    const matching = resolveAppliedTemplates(rawMatching, newSelectedTemplateId);
    const matchingTemplateIds = new Set(matching.map((t) => t.id));
    const kept = prev.filter(
      (q) =>
        !q.sourceTemplateId || matchingTemplateIds.has(q.sourceTemplateId),
    );
    const existingSourceIds = new Set(
      kept.map((q) => q.sourceTemplateQuestionId).filter(Boolean),
    );
    const additions: NewQuestionInput[] = [];
    for (const t of matching) {
      for (const tq of t.questions) {
        // El área (Contenido Externo/Interno) la decide la visibilidad, no
        // quién responde — así una pregunta "Interna" dentro de Contenido
        // Externo se sincroniza a esa misma sección, no a la otra.
        const area = tq.visibility === "INTERNAL" ? "INTERNAL" : "EXTERNAL";
        if (area !== areaFilter) continue;
        if (existingSourceIds.has(tq.id)) continue;
        additions.push({
          clientKey: makeClientKey(),
          section: tq.section,
          text: tq.text,
          type: tq.type,
          options: tq.options,
          required: tq.required,
          weight: tq.weight,
          isPrerequisite: tq.respondedBy === "BUYER" ? false : tq.isPrerequisite,
          visibility: tq.visibility,
          respondedBy: tq.respondedBy,
          numberMin: tq.numberMin,
          numberMax: tq.numberMax,
          scoringConfig: tq.scoringConfig,
          dependsOnQuestionKey: null,
          dependsOnHeaderField: null,
          dependsOnValue: "",
          buyerAnswerValue: "",
          sourceTemplateQuestionId: tq.id,
          sourceTemplateId: t.id,
          locked:
            tq.lockRoles.length > 0 && !tq.lockRoles.includes(currentUserRole),
        });
      }
    }
    if (additions.length === 0) {
      return kept.length === prev.length ? prev : kept;
    }
    return [...kept, ...additions];
  }

  // Recomputes which conditional template is actually in effect given the
  // header values that decide it — a lone match locks itself in, several
  // matches fall back to whatever the user already picked (or none until
  // they do), and a stale pick that no longer matches is dropped.
  function resolveSelection(
    newCommodity: string,
    newRegion: string,
    newPrice: number | null,
  ): string | null {
    const rawMatching = templates.filter((t) =>
      matchesTemplate(
        t,
        ancestorChain(commodities, newCommodity),
        ancestorChain(regions, newRegion),
        newPrice,
      ),
    );
    const { conditional } = splitConditionalTemplates(rawMatching);
    if (conditional.length === 1) return conditional[0].id;
    return conditional.some((t) => t.id === selectedTemplateId)
      ? selectedTemplateId
      : null;
  }

  function handleCommodityChange(value: string) {
    setCommodity(value);
    const price = parsePrice(estimatedPrice);
    const nextSelected = resolveSelection(value, region, price);
    setSelectedTemplateId(nextSelected);
    setItems((prev) => syncTemplateItems(prev, value, region, price, nextSelected));
    setQuestions((prev) =>
      syncTemplateQuestions(prev, value, region, "EXTERNAL", price, nextSelected),
    );
    setInternalQuestions((prev) =>
      syncTemplateQuestions(prev, value, region, "INTERNAL", price, nextSelected),
    );
  }

  function handleRegionChange(value: string) {
    setRegion(value);
    const price = parsePrice(estimatedPrice);
    const nextSelected = resolveSelection(commodity, value, price);
    setSelectedTemplateId(nextSelected);
    setItems((prev) => syncTemplateItems(prev, commodity, value, price, nextSelected));
    setQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, value, "EXTERNAL", price, nextSelected),
    );
    setInternalQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, value, "INTERNAL", price, nextSelected),
    );
  }

  function handleEstimatedPriceChange(value: string) {
    setEstimatedPrice(value);
    const price = parsePrice(value);
    const nextSelected = resolveSelection(commodity, region, price);
    setSelectedTemplateId(nextSelected);
    setItems((prev) => syncTemplateItems(prev, commodity, region, price, nextSelected));
    setQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, region, "EXTERNAL", price, nextSelected),
    );
    setInternalQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, region, "INTERNAL", price, nextSelected),
    );
  }

  function handleTemplateSelectionChange(value: string) {
    const nextSelected = value || null;
    setSelectedTemplateId(nextSelected);
    const price = parsePrice(estimatedPrice);
    setItems((prev) =>
      syncTemplateItems(prev, commodity, region, price, nextSelected),
    );
    setQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, region, "EXTERNAL", price, nextSelected),
    );
    setInternalQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, region, "INTERNAL", price, nextSelected),
    );
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      const { items: importedItems, questions: importedQuestions } =
        await parseRfpExcelFile(file);
      if (importedItems.length === 0 && importedQuestions.length === 0) {
        setImportError(
          t("rfpForm.noRowsFoundError"),
        );
        return;
      }
      if (allowFreeTextItems) {
        setItems((prev) => {
          const kept = prev.filter((i) => i.name.trim().length > 0);
          return [...kept, ...importedItems];
        });
      } else if (importedItems.length > 0) {
        setImportError(
          t("rfpForm.questionsImportedItemsSkipped"),
        );
      }
      const importedSupplier = importedQuestions.filter(
        (q) => q.visibility !== "INTERNAL",
      );
      const importedInternal = importedQuestions.filter(
        (q) => q.visibility === "INTERNAL",
      );
      setQuestions((prev) => {
        const kept = prev.filter((q) => q.text.trim().length > 0);
        return [...kept, ...importedSupplier];
      });
      setInternalQuestions((prev) => {
        const kept = prev.filter((q) => q.text.trim().length > 0);
        return [...kept, ...importedInternal];
      });
    } catch {
      setImportError(
        t("rfpForm.importReadError"),
      );
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function updateItem(index: number, patch: Partial<NewItemInput>) {
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

  function updateCustomField(
    itemIndex: number,
    fieldIndex: number,
    patch: Partial<NewCustomField>,
  ) {
    updateItem(itemIndex, {
      customFields: items[itemIndex].customFields.map((f, i) =>
        i === fieldIndex ? { ...f, ...patch } : f,
      ),
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

  // A dependsOnQuestionKey is a stable per-row key, not a position, so
  // inserting/removing rows never needs to shift other rows' references —
  // the only thing that needs cleanup is clearing references that pointed
  // at a row that just got deleted (from either question area).
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
    setter: React.Dispatch<React.SetStateAction<NewQuestionInput[]>>,
    index: number,
    patch: Partial<NewQuestionInput>,
  ) {
    setter((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function insertQuestionInto(
    setter: React.Dispatch<React.SetStateAction<NewQuestionInput[]>>,
    makeEmpty: () => NewQuestionInput,
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
    setter: React.Dispatch<React.SetStateAction<NewQuestionInput[]>>,
    index: number,
    clientKey: string,
  ) {
    clearDependencyReferencesTo(clientKey);
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function renameQuestionSectionIn(
    setter: React.Dispatch<React.SetStateAction<NewQuestionInput[]>>,
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

  const updateQuestion = (index: number, patch: Partial<NewQuestionInput>) =>
    updateQuestionIn(setQuestions, index, patch);
  const updateInternalQuestion = (
    index: number,
    patch: Partial<NewQuestionInput>,
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
    q: NewQuestionInput,
    onChange: (patch: Partial<NewQuestionInput>) => void,
  ) {
    return (
      <select
        className={smallInputClass()}
        disabled={q.locked}
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

  function answerField(
    q: NewQuestionInput,
    onChange: (value: string) => void,
  ) {
    if (q.type === "ATTACHMENT") {
      return (
        <p className="text-xs text-slate-400">
          {t("rfpForm.attachmentHint")}
        </p>
      );
    }
    if (q.type === "SELECT") {
      return (
        <select
          className={smallInputClass()}
          value={q.buyerAnswerValue}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("rfpForm.selectOption")}</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (q.type === "YES_NO") {
      return (
        <select
          className={smallInputClass()}
          value={q.buyerAnswerValue}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("rfpForm.selectOption")}</option>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </select>
      );
    }
    if (q.type === "NUMBER") {
      return (
        <input
          type="number"
          step="any"
          min={q.numberMin ?? undefined}
          max={q.numberMax ?? undefined}
          className={smallInputClass()}
          placeholder={t("rfpForm.answerLabel")}
          value={q.buyerAnswerValue}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    if (q.type === "MONEY") {
      return (
        <input
          type="number"
          step="any"
          min={0}
          className={smallInputClass()}
          placeholder="$"
          value={q.buyerAnswerValue}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    return (
      <input
        className={smallInputClass()}
        placeholder={t("rfpForm.answerLabel")}
        value={q.buyerAnswerValue}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  function handleExportExcel() {
    const filename = `${(title.trim() || "rfp-ejemplo").replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "rfp"}.xlsx`;
    downloadRfpExcel(filename, items, [...questions, ...internalQuestions]);
  }

  function handleSubmit(saveAsDraft: boolean) {
    setError(null);
    startTransition(async () => {
      const payload = {
        title,
        description,
        buyerName,
        deadlineAt,
        commodity,
        region,
        startDate,
        estimatedPrice,
        origin,
        predecessorDocument,
        basedOnRfpId,
        selectedTemplateId: resolveSelection(
          commodity,
          region,
          parsePrice(estimatedPrice),
        ),
        isNextRound: initial?.isNextRound ?? false,
        scoringEnabled: weightingQuestionsEnabled,
        saveAsDraft,
        items,
        questions: [...questions, ...internalQuestions],
        suppliers,
      };
      const result =
        mode === "edit" && rfpId
          ? await updateRfp(rfpId, payload)
          : await createRfp(payload);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  async function handleBasedOnSelect(rfp: { id: string; label: string }) {
    setLoadingBasedOn(true);
    try {
      const result = await buildItemsFromSourceRfp(rfp.id, "based_on");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBasedOnRfpId(rfp.id);
      setBasedOnRfpLabel(rfp.label);
      setItems((prev) => {
        const kept = prev.filter((i) => i.name.trim().length > 0);
        return [...kept, ...result.items];
      });
    } finally {
      setLoadingBasedOn(false);
    }
  }

  // Artículos/preguntas/proveedores only make sense once the header is
  // actually filled in and — when there's a choice to make — a plantilla
  // has been resolved (auto-picked when there's exactly one match, or
  // chosen when there are several); an edit in progress already has all
  // of this settled, so it never gets hidden again.
  const headerComplete = Boolean(
    title.trim() && buyerName.trim() && deadlineAt && commodity.trim(),
  );
  const conditionalMatchCount = splitConditionalTemplates(
    templates.filter((t) =>
      matchesTemplate(
        t,
        ancestorChain(commodities, commodity),
        ancestorChain(regions, region),
        parsePrice(estimatedPrice),
      ),
    ),
  ).conditional.length;
  const templateResolved = conditionalMatchCount === 0 || Boolean(selectedTemplateId);
  const readyForContent = mode === "edit" || (headerComplete && templateResolved);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <CollapsibleSection
        title={t("rfpForm.detailsTitle")}
        storageKey="rfp-new-details"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-title`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.titleLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idBase}-title`}
              className={inputClass()}
              placeholder={t("rfpForm.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-description`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.descriptionLabel")}
            </label>
            <textarea
              id={`${idBase}-description`}
              className={inputClass()}
              rows={3}
              placeholder={t("rfpForm.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-buyer`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.buyerLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idBase}-buyer`}
              className={inputClass()}
              placeholder={t("rfpForm.buyerPlaceholder")}
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-deadline`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.deadlineLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              id={`${idBase}-deadline`}
              type="datetime-local"
              className={inputClass()}
              value={deadlineAt}
              onChange={(e) => setDeadlineAt(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("rfpForm.commodityLabel")}
            </label>
            <TreePickerField
              nodes={commodities.map((c) => ({
                id: c.id,
                parentId: c.parentId,
                label: c.description,
                code: c.code,
                selectable: c.selectable,
              }))}
              valueId={
                commodities.find((c) => c.description === commodity)?.id ??
                null
              }
              onChangeId={(id) => {
                const node = commodities.find((c) => c.id === id);
                handleCommodityChange(node?.description ?? "");
              }}
              placeholder={t("rfpForm.selectCommodity")}
              clearLabel={t("rfpForm.noneOptionMasculine")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("rfpForm.regionLabel")}
            </label>
            <TreePickerField
              nodes={regions.map((r) => ({
                id: r.id,
                parentId: r.parentId,
                label: r.description,
                code: r.code,
              }))}
              valueId={
                regions.find((r) => r.description === region)?.id ?? null
              }
              onChangeId={(id) => {
                const node = regions.find((r) => r.id === id);
                handleRegionChange(node?.description ?? "");
              }}
              placeholder={t("rfpForm.selectRegion")}
              clearLabel={t("rfpForm.noneOptionFeminine")}
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-start`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.startDateLabel")}
            </label>
            <input
              id={`${idBase}-start`}
              type="datetime-local"
              className={inputClass()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-estimated`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.estimatedPriceLabel")}
            </label>
            <input
              id={`${idBase}-estimated`}
              type="number"
              min={0}
              step="any"
              className={inputClass()}
              placeholder={t("rfpForm.estimatedPricePlaceholder")}
              value={estimatedPrice}
              onChange={(e) => handleEstimatedPriceChange(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("rfpForm.originLabel")}{" "}
              <span className="font-normal text-slate-400">
                {t("rfpForm.notVisibleToSupplier")}
              </span>
            </label>
            <TreePickerField
              nodes={origins.map((o) => ({
                id: o.id,
                parentId: o.parentId,
                label: o.description,
                code: o.code,
              }))}
              valueId={
                origins.find((o) => o.description === origin)?.id ?? null
              }
              onChangeId={(id) => {
                const node = origins.find((o) => o.id === id);
                setOrigin(node?.description ?? "");
              }}
              placeholder={t("rfpForm.selectOrigin")}
              clearLabel={t("rfpForm.noneOptionMasculine")}
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-predecessor`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              {t("rfpForm.predecessorLabel")}{" "}
              <span className="font-normal text-slate-400">
                {t("rfpForm.notVisibleToSupplier")}
              </span>
            </label>
            <input
              id={`${idBase}-predecessor`}
              className={inputClass()}
              placeholder={t("rfpForm.predecessorPlaceholder")}
              value={predecessorDocument}
              onChange={(e) => setPredecessorDocument(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("rfpForm.basedOnLabel")}{" "}
              <span className="font-normal text-slate-400">
                {t("rfpForm.basedOnHint")}
              </span>
            </label>
            {basedOnRfpId && basedOnRfpLabel ? (
              <div className="flex items-center gap-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
                <a
                  href={`/rfps/${basedOnRfpId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-violet-700 hover:underline"
                >
                  {t("rfpForm.previousRfpPrefix")}: {basedOnRfpLabel} →
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setBasedOnRfpId(null);
                    setBasedOnRfpLabel(null);
                  }}
                  className="ml-auto text-xs text-slate-400 hover:text-red-600"
                >
                  {t("rfpForm.remove")}
                </button>
              </div>
            ) : (
              <PreviousRfpPicker
                commodities={commodities.map((c) => c.description)}
                regions={regions.map((r) => r.description)}
                creators={creators}
                excludeRfpId={rfpId}
                onSelect={(rfp) => handleBasedOnSelect(rfp)}
                triggerLabel={
                  loadingBasedOn
                    ? t("common.loading")
                    : t("rfpForm.searchPreviousRfp")
                }
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("rfpForm.templateLabel")}
            </label>
            <TemplatePicker
              templates={splitConditionalTemplates(
                templates.filter((t) =>
                  matchesTemplate(
                    t,
                    ancestorChain(commodities, commodity),
                    ancestorChain(regions, region),
                    parsePrice(estimatedPrice),
                  ),
                ),
              ).conditional.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
              }))}
              selectedId={selectedTemplateId}
              onChange={(id) => handleTemplateSelectionChange(id ?? "")}
            />
          </div>
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={weightingQuestionsEnabled}
                onChange={(e) =>
                  setWeightingQuestionsEnabled(e.target.checked)
                }
              />
              {t("rfpForm.weightQuestions")}
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {!readyForContent && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {t("rfpForm.gateMessage")}
          {conditionalMatchCount > 1 ? t("rfpForm.gateMessageTemplateSuffix") : ""}
          {t("rfpForm.gateMessageSuffix")}
        </div>
      )}

      {readyForContent && (
        <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-700">
            {t("rfpForm.excelBoxTitle")}
          </p>
          <p className="text-xs text-slate-400">
            {t("rfpForm.excelBoxHint")}
          </p>
          {importError && (
            <p className="mt-1 text-xs text-red-600">{importError}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t("rfpForm.exportExample")}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {importing ? t("rfpForm.importing") : t("rfpForm.importExcel")}
          </button>
        </div>
      </div>

      <CollapsibleSection
        title={t("rfpForm.internalQuestionsTitle")}
        subtitle={t("rfpForm.internalQuestionsSubtitle")}
        storageKey="rfp-new-internal-questions"
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
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
                                : t("rfpForm.internalQuestionPlaceholder")
                            }
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
                              type: e.target.value as QuestionType,
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
                              onChange={(e) =>
                                updateInternalQuestion(index, {
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
                          disabled={q.locked}
                          title={
                            q.locked ? t("rfpForm.lockedByTemplate") : undefined
                          }
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          {t("rfpForm.remove")}
                        </button>
                      </div>
                    </div>

                    {q.type !== "INFO" && (
                      <div className="mt-2 pl-11">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          {t("rfpForm.answerLabel")}
                        </label>
                        {answerField(q, (value) =>
                          updateInternalQuestion(index, {
                            buyerAnswerValue: value,
                          }),
                        )}
                      </div>
                    )}

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
                        {weightingQuestionsEnabled && (
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
                        )}
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
        title={t("rfpForm.supplierQuestionsTitle")}
        storageKey="rfp-new-supplier-questions"
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
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
                            disabled={q.locked}
                            onChange={(e) =>
                              updateQuestion(index, { text: e.target.value })
                            }
                          />
                        </div>
                        {q.locked && (
                          <span className="mt-1 inline-flex items-center gap-1 pl-11 text-[11px] font-medium text-amber-600">
                            🔒 {t("rfpForm.lockedByTemplateFull")}
                          </span>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <select
                          className={inputClass()}
                          value={q.type}
                          disabled={q.locked}
                          onChange={(e) =>
                            updateQuestion(index, {
                              type: e.target.value as QuestionType,
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
                              disabled={q.isPrerequisite || q.locked}
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
                          disabled={q.locked}
                          title={
                            q.locked ? t("rfpForm.lockedByTemplate") : undefined
                          }
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
                              disabled={q.locked}
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
                                disabled={q.locked}
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
                                disabled={q.locked}
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
                        {weightingQuestionsEnabled && (
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
                              disabled={q.locked}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  weight: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        )}
                        {weightingQuestionsEnabled && q.respondedBy === "SUPPLIER" && (
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
                            {t("rfpForm.requiresAnswerFieldLabel")}
                          </label>
                          <select
                            className={smallInputClass()}
                            value={q.respondedBy}
                            disabled={q.locked}
                            onChange={(e) => {
                              // Solo cambia quién responde — se queda en
                              // Preguntas para los proveedores (visibilidad
                              // EXTERNAL) sea cual sea la respuesta.
                              const respondedBy = e.target
                                .value as QuestionResponder;
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
                                disabled={q.locked}
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
                        {q.respondedBy === "BUYER" && q.type !== "INFO" && (
                          <div className="sm:col-span-12">
                            <label className="mb-1 block text-xs font-medium text-slate-500">
                              {t("rfpForm.answerLabel")}
                            </label>
                            {answerField(q, (value) =>
                              updateQuestion(index, { buyerAnswerValue: value }),
                            )}
                          </div>
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
                              disabled={q.locked}
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

      <CollapsibleSection
        title={t("rfpForm.itemsTitle")}
        storageKey="rfp-new-items"
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={addItemSection}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {t("rfpForm.addSection")}
            </button>
            {allowFreeTextItems && (
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
            )}
            <ItemCatalogPicker
              items={itemCatalog}
              onPick={(entry) =>
                setItems((prev) => [
                  ...prev,
                  {
                    ...emptyItem(),
                    section: prev[prev.length - 1]?.section ?? null,
                    code: entry.code,
                    name: entry.name,
                    description: entry.description ?? "",
                    unit: entry.unit,
                    commodity: entry.commodity,
                    historicalPrice: entry.lastPrice,
                    sourceItemCatalogEntryId: entry.id,
                  },
                ])
              }
            />
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
                      <div className="sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-400">
                            {label}
                          </span>
                          <input
                            className={inputClass()}
                            placeholder={t("rfpForm.codePlaceholder")}
                            value={item.code ?? ""}
                            disabled={item.locked || Boolean(item.sourceItemCatalogEntryId)}
                            onChange={(e) =>
                              updateItem(index, { code: e.target.value || null })
                            }
                          />
                        </div>
                        {item.locked && (
                          <span className="mt-1 inline-flex items-center gap-1 pl-11 text-[11px] font-medium text-amber-600">
                            🔒 {t("rfpForm.lockedByTemplateItem")}
                          </span>
                        )}
                        {item.sourceItemCatalogEntryId && (
                          <span className="mt-1 inline-flex items-center gap-1 pl-11 text-[11px] font-medium text-violet-600">
                            🔒 {t("rfpForm.fromCatalog")}
                          </span>
                        )}
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          className={inputClass()}
                          placeholder={t("rfpForm.itemNamePlaceholder")}
                          value={item.name}
                          disabled={item.locked || Boolean(item.sourceItemCatalogEntryId)}
                          onChange={(e) =>
                            updateItem(index, { name: e.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          className={inputClass()}
                          placeholder={t("rfpForm.itemDescriptionPlaceholder")}
                          value={item.description}
                          disabled={item.locked || Boolean(item.sourceItemCatalogEntryId)}
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
                          disabled={Boolean(item.sourceItemCatalogEntryId)}
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
                          disabled={item.locked}
                          title={
                            item.locked ? t("rfpForm.lockedByTemplateItem") : undefined
                          }
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          {t("rfpForm.remove")}
                        </button>
                      </div>
                    </div>

                    {expandedItems.has(index) && (
                      <div className="mt-3 max-w-xl space-y-3 border-t border-slate-200 pt-3">
                        <div>
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
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("rfpForm.historicalPriceLabel")}{" "}
                            <span className="font-normal text-slate-400">
                              {t("rfpForm.notVisibleShort")}
                            </span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className={smallInputClass()}
                            value={item.historicalPrice ?? ""}
                            onChange={(e) =>
                              updateItem(index, {
                                historicalPrice:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {t("rfpForm.lineCommodityLabel")}
                          </label>
                          {item.sourceItemCatalogEntryId ? (
                            <p className="rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                              {item.commodity || t("rfpForm.noSpecificCommodity")}
                            </p>
                          ) : (
                            <TreePickerField
                              nodes={commodities.map((c) => ({
                                id: c.id,
                                parentId: c.parentId,
                                label: c.description,
                                code: c.code,
                                selectable: c.selectable,
                              }))}
                              valueId={
                                commodities.find(
                                  (c) => c.description === item.commodity,
                                )?.id ?? null
                              }
                              onChangeId={(id) => {
                                const node = commodities.find((c) => c.id === id);
                                updateItem(index, {
                                  commodity: node?.description ?? null,
                                });
                              }}
                              placeholder={t("rfpForm.noSpecificCommodity")}
                              clearLabel={t("rfpForm.noSpecificCommodity")}
                            />
                          )}
                        </div>
                        <div>
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
                                    updateCustomField(index, fieldIndex, {
                                      label: e.target.value,
                                    })
                                  }
                                />
                                <input
                                  className={smallInputClass()}
                                  placeholder={t("rfpForm.fieldValuePlaceholder")}
                                  value={field.value}
                                  onChange={(e) =>
                                    updateCustomField(index, fieldIndex, {
                                      value: e.target.value,
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
              {group.name !== null && allowFreeTextItems && (
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
        title={t("rfpForm.inviteSuppliersTitle")}
        subtitle={t("rfpForm.inviteSuppliersSubtitle")}
        storageKey="rfp-new-suppliers"
        right={
          <button
            type="button"
            onClick={() => setSuppliers((prev) => [...prev, emptySupplier()])}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {t("rfpForm.addSupplier")}
          </button>
        }
      >
        {supplierDirectory.length === 0 && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {t("rfpForm.noActiveSuppliers")}
          </p>
        )}
        <div className="space-y-3">
          {suppliers.map((s, index) => {
            const selectedDir =
              supplierDirectory.find((d) => d.id === s.supplierDirectoryId) ??
              null;
            return (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-12 sm:items-center"
              >
                <div className="sm:col-span-8">
                  <SupplierSearchPicker
                    suppliers={supplierDirectory}
                    selectedLabel={
                      selectedDir
                        ? `${selectedDir.companyName} — ${s.name} (${s.email})`
                        : null
                    }
                    onConfirm={(dir, contacts) =>
                      setSuppliers((prev) => {
                        const next = [...prev];
                        next.splice(
                          index,
                          1,
                          ...contacts.map((c) => ({
                            name: c.name,
                            email: c.email,
                            company: dir.companyName,
                            supplierDirectoryId: dir.id,
                          })),
                        );
                        return next;
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-3 text-xs text-slate-500">
                  {s.company ? `${s.company} · ${s.email}` : "—"}
                </div>
                <div className="flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSuppliers((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                    disabled={suppliers.length === 1}
                    className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                  >
                    {t("rfpForm.remove")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={pending}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("rfpForm.saveDraft")}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending
            ? mode === "edit"
              ? t("common.saving")
              : t("rfpForm.creatingRfp")
            : t("rfpForm.publishRfp")}
        </button>
      </div>
        </>
      )}
    </form>
  );
}
