"use client";

import { useId, useRef, useState, useTransition } from "react";
import { GearButton } from "@/components/GearButton";
import { TreeCascadeSelect } from "@/components/TreeCascadeSelect";
import { TreeSingleSelect } from "@/components/TreeSingleSelect";
import { SupplierSearchPicker } from "@/components/SupplierSearchPicker";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { PreviousRfpPicker } from "@/components/PreviousRfpPicker";
import { buildItemsFromSourceRfp } from "../rfpActions";
import { updateRfp } from "../[id]/actions";
import { ROLE_LEVEL } from "@/lib/roleLabels";
import { matchesTemplate } from "@/lib/templateMatch";
import { groupBySection, nextSectionName } from "@/lib/sections";
import { makeClientKey } from "@/lib/clientKey";
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
  matchCommodity: string | null;
  matchRegion: string | null;
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
    lockMinRole: UserRole;
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
    lockMinRole: UserRole;
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
    dependsOnQuestionKey: null,
    dependsOnHeaderField: null,
    dependsOnValue: "",
    buyerAnswerValue: "",
  };
}

function emptySupplier(): NewSupplierInput {
  return { name: "", email: "", company: "" };
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

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  SELECT: "Opción múltiple",
  MONEY: "Dinero",
  ATTACHMENT: "Adjunto",
  YES_NO: "Sí / No",
};

const SUPPLIER_VISIBILITY_LABEL: Record<
  Exclude<QuestionVisibility, "INTERNAL">,
  string
> = {
  SUPPLIER_ONLY: "Solo proveedor (respuesta oculta para el comprador)",
  EXTERNAL: "Externa (visible para ambos)",
};

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
  creators,
  mode = "create",
  rfpId,
  initial,
}: {
  currentUserRole: UserRole;
  currentUserName: string;
  templates: TemplateData[];
  commodities: { id: string; parentId: string | null; description: string }[];
  regions: { id: string; parentId: string | null; description: string }[];
  origins: { id: string; parentId: string | null; description: string }[];
  supplierDirectory: {
    id: string;
    code: string;
    taxId: string;
    companyName: string;
    contactFirstName: string;
    contactLastName: string;
    email: string;
    phone: string;
  }[];
  creators: { id: string; name: string }[];
  mode?: "create" | "edit";
  rfpId?: string;
  initial?: RfpInitialData;
}) {
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
    () => initial?.items ?? syncTemplateItems([], "", ""),
  );
  const [questions, setQuestions] = useState<NewQuestionInput[]>(
    () => initial?.questions ?? syncTemplateQuestions([], "", "", "SUPPLIER"),
  );
  const [internalQuestions, setInternalQuestions] = useState<
    NewQuestionInput[]
  >(() => initial?.internalQuestions ?? syncTemplateQuestions([], "", "", "BUYER"));
  const [suppliers, setSuppliers] = useState<NewSupplierInput[]>(
    initial?.suppliers && initial.suppliers.length > 0
      ? initial.suppliers
      : [emptySupplier()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [weightingEnabled, setWeightingEnabled] = useState(
    initial?.scoringEnabled ?? false,
  );
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
  ) {
    const matching = templates.filter((t) =>
      matchesTemplate(t, newCommodity, newRegion),
    );
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
          locked: ROLE_LEVEL[currentUserRole] < ROLE_LEVEL[ti.lockMinRole],
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
    responderFilter: QuestionResponder,
  ) {
    const matching = templates.filter((t) =>
      matchesTemplate(t, newCommodity, newRegion),
    );
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
        if (tq.respondedBy !== responderFilter) continue;
        if (existingSourceIds.has(tq.id)) continue;
        additions.push({
          clientKey: makeClientKey(),
          section: tq.section,
          text: tq.text,
          type: tq.type,
          options: tq.options,
          required: tq.required,
          weight: tq.weight,
          isPrerequisite:
            responderFilter === "BUYER" ? false : tq.isPrerequisite,
          visibility:
            responderFilter === "BUYER"
              ? "INTERNAL"
              : tq.visibility === "INTERNAL"
                ? "EXTERNAL"
                : tq.visibility,
          respondedBy: responderFilter,
          numberMin: tq.numberMin,
          numberMax: tq.numberMax,
          dependsOnQuestionKey: null,
          dependsOnHeaderField: null,
          dependsOnValue: "",
          buyerAnswerValue: "",
          sourceTemplateQuestionId: tq.id,
          sourceTemplateId: t.id,
          locked: ROLE_LEVEL[currentUserRole] < ROLE_LEVEL[tq.lockMinRole],
        });
      }
    }
    if (additions.length === 0) {
      return kept.length === prev.length ? prev : kept;
    }
    return [...kept, ...additions];
  }

  function handleCommodityChange(value: string) {
    setCommodity(value);
    setItems((prev) => syncTemplateItems(prev, value, region));
    setQuestions((prev) =>
      syncTemplateQuestions(prev, value, region, "SUPPLIER"),
    );
    setInternalQuestions((prev) =>
      syncTemplateQuestions(prev, value, region, "BUYER"),
    );
  }

  function handleRegionChange(value: string) {
    setRegion(value);
    setItems((prev) => syncTemplateItems(prev, commodity, value));
    setQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, value, "SUPPLIER"),
    );
    setInternalQuestions((prev) =>
      syncTemplateQuestions(prev, commodity, value, "BUYER"),
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
          "No se encontraron filas en las hojas 'Articulos' o 'Preguntas'.",
        );
        return;
      }
      setItems((prev) => {
        const kept = prev.filter((i) => i.name.trim().length > 0);
        return [...kept, ...importedItems];
      });
      const importedSupplier = importedQuestions.filter(
        (q) => q.respondedBy !== "BUYER",
      );
      const importedInternal = importedQuestions.filter(
        (q) => q.respondedBy === "BUYER",
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
        "No se pudo leer el archivo. Verifica que sea un .xlsx exportado desde esta herramienta.",
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

  function updateSupplier(index: number, patch: Partial<NewSupplierInput>) {
    setSuppliers((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
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

  function internalAnswerField(q: NewQuestionInput, index: number) {
    const onChange = (value: string) =>
      updateInternalQuestion(index, { buyerAnswerValue: value });
    if (q.type === "ATTACHMENT") {
      return (
        <p className="text-xs text-slate-400">
          El adjunto se agrega después de crear la RFP, desde el detalle.
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
          <option value="">Selecciona una opción</option>
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
          <option value="">Selecciona una opción</option>
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
          placeholder="Respuesta"
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
        placeholder="Respuesta"
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
        scoringEnabled: weightingEnabled || weightingQuestionsEnabled,
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

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <CollapsibleSection
        title="Detalles de la RFP"
        storageKey="rfp-new-details"
        right={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={weightingEnabled}
                onChange={(e) => setWeightingEnabled(e.target.checked)}
              />
              Ponderar artículos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={weightingQuestionsEnabled}
                onChange={(e) =>
                  setWeightingQuestionsEnabled(e.target.checked)
                }
              />
              Ponderar preguntas
            </label>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idBase}-title`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Título
            </label>
            <input
              id={`${idBase}-title`}
              className={inputClass()}
              placeholder="Ej. Compra de laptops para el área de ventas"
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
              Descripción / alcance
            </label>
            <textarea
              id={`${idBase}-description`}
              className={inputClass()}
              rows={3}
              placeholder="Describe el contexto, requisitos generales y condiciones de entrega."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-buyer`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Comprador / área
            </label>
            <input
              id={`${idBase}-buyer`}
              className={inputClass()}
              placeholder="Ej. Departamento de Compras"
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
              Fecha límite de respuesta
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
              Commodity
            </label>
            <TreeSingleSelect
              nodes={commodities.map((c) => ({
                id: c.id,
                parentId: c.parentId,
                label: c.description,
              }))}
              valueId={
                commodities.find((c) => c.description === commodity)?.id ??
                null
              }
              onChangeId={(id) => {
                const node = commodities.find((c) => c.id === id);
                handleCommodityChange(node?.description ?? "");
              }}
              rootPlaceholder="Selecciona un commodity"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Región
            </label>
            <TreeSingleSelect
              nodes={regions.map((r) => ({
                id: r.id,
                parentId: r.parentId,
                label: r.description,
              }))}
              valueId={
                regions.find((r) => r.description === region)?.id ?? null
              }
              onChangeId={(id) => {
                const node = regions.find((r) => r.id === id);
                handleRegionChange(node?.description ?? "");
              }}
              rootPlaceholder="Selecciona una región"
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-start`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Fecha de inicio estimada
            </label>
            <input
              id={`${idBase}-start`}
              type="date"
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
              Precio estimado (USD)
            </label>
            <input
              id={`${idBase}-estimated`}
              type="number"
              min={0}
              step="any"
              className={inputClass()}
              placeholder="Ej. 30000"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Origen{" "}
              <span className="font-normal text-slate-400">
                (opcional, no visible para el proveedor)
              </span>
            </label>
            <TreeCascadeSelect
              nodes={origins.map((o) => ({
                id: o.id,
                parentId: o.parentId,
                label: o.description,
              }))}
              valueId={
                origins.find((o) => o.description === origin)?.id ?? null
              }
              onChangeId={(id) => {
                const node = origins.find((o) => o.id === id);
                setOrigin(node?.description ?? "");
              }}
              rootPlaceholder="Selecciona un origen"
            />
          </div>
          <div>
            <label
              htmlFor={`${idBase}-predecessor`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Documento predecesor{" "}
              <span className="font-normal text-slate-400">
                (opcional, no visible para el proveedor)
              </span>
            </label>
            <input
              id={`${idBase}-predecessor`}
              className={inputClass()}
              placeholder="Ej. RFP-2025-014"
              value={predecessorDocument}
              onChange={(e) => setPredecessorDocument(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Basar en una RFP anterior{" "}
              <span className="font-normal text-slate-400">
                (opcional — trae el precio ganador de cada artículo como
                precio histórico)
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
                  RFP anterior: {basedOnRfpLabel} →
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setBasedOnRfpId(null);
                    setBasedOnRfpLabel(null);
                  }}
                  className="ml-auto text-xs text-slate-400 hover:text-red-600"
                >
                  Quitar
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
                    ? "Cargando..."
                    : "Buscar RFP anterior..."
                }
              />
            )}
          </div>
        </div>
      </CollapsibleSection>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Cargar artículos y preguntas desde Excel
          </p>
          <p className="text-xs text-slate-400">
            Exporta un ejemplo con lo que ya armaste (o una plantilla en
            blanco), complétalo en Excel y vuelve a subirlo (hojas
            &quot;Articulos&quot; y &quot;Preguntas&quot;). Al importar se
            agrega a lo que ya tengas.
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
            Exportar ejemplo
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
            {importing ? "Importando..." : "Importar Excel"}
          </button>
        </div>
      </div>

      <CollapsibleSection
        title="Artículos solicitados"
        storageKey="rfp-new-items"
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
                      <div className="sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-400">
                            {label}
                          </span>
                          <input
                            className={inputClass()}
                            placeholder="Código"
                            value={item.code ?? ""}
                            disabled={item.locked}
                            onChange={(e) =>
                              updateItem(index, { code: e.target.value || null })
                            }
                          />
                        </div>
                        {item.locked && (
                          <span className="mt-1 inline-flex items-center gap-1 pl-11 text-[11px] font-medium text-amber-600">
                            🔒 Bloqueado por plantilla
                          </span>
                        )}
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          className={inputClass()}
                          placeholder="Nombre del artículo"
                          value={item.name}
                          disabled={item.locked}
                          onChange={(e) =>
                            updateItem(index, { name: e.target.value })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          className={inputClass()}
                          placeholder="Descripción / especificaciones"
                          value={item.description}
                          disabled={item.locked}
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
                          disabled={item.locked}
                          title={
                            item.locked ? "Bloqueado por plantilla" : undefined
                          }
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    {expandedItems.has(index) && (
                      <div className="mt-3 max-w-xl space-y-3 border-t border-slate-200 pt-3">
                        {weightingEnabled ? (
                          <div>
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
                        ) : (
                          <div>
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
                        )}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Precio histórico{" "}
                            <span className="font-normal text-slate-400">
                              (no visible p/ proveedor)
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
                            Commodity de la línea
                          </label>
                          <TreeSingleSelect
                            nodes={commodities.map((c) => ({
                              id: c.id,
                              parentId: c.parentId,
                              label: c.description,
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
                            rootPlaceholder="— Sin commodity específico —"
                          />
                        </div>
                        <div>
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
                                    updateCustomField(index, fieldIndex, {
                                      label: e.target.value,
                                    })
                                  }
                                />
                                <input
                                  className={smallInputClass()}
                                  placeholder="Valor (ej. Negro)"
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
        title="Preguntas internas"
        subtitle="Las respondes tú directamente; nunca se envían al proveedor."
        storageKey="rfp-new-internal-questions"
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
                              type: e.target.value as QuestionType,
                            })
                          }
                        >
                          {(
                            Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]
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
                          disabled={q.locked}
                          title={
                            q.locked ? "Bloqueada por plantilla" : undefined
                          }
                          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 pl-11">
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Respuesta
                      </label>
                      {internalAnswerField(q, index)}
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
                        {weightingQuestionsEnabled && (
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
                        )}
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
        title="Preguntas para los proveedores"
        storageKey="rfp-new-supplier-questions"
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
                            disabled={q.locked}
                            onChange={(e) =>
                              updateQuestion(index, { text: e.target.value })
                            }
                          />
                        </div>
                        {q.locked && (
                          <span className="mt-1 inline-flex items-center gap-1 pl-11 text-[11px] font-medium text-amber-600">
                            🔒 Bloqueada por plantilla (no editable ni
                            removible)
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
                          {(
                            Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]
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
                            disabled={q.isPrerequisite || q.locked}
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
                          disabled={q.locked}
                          title={
                            q.locked ? "Bloqueada por plantilla" : undefined
                          }
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
                                Mínimo permitido
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
                                Máximo permitido
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
                              Peso
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
                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Visibilidad
                          </label>
                          <select
                            className={smallInputClass()}
                            value={q.visibility}
                            disabled={q.locked}
                            onChange={(e) =>
                              updateQuestion(index, {
                                visibility: e.target
                                  .value as QuestionVisibility,
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
                    + Agregar pregunta en esta sección
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Invitar proveedores"
        subtitle="Se generará un link único por proveedor para que respondan la RFP sin necesidad de crear una cuenta. También puedes invitar proveedores más adelante desde el detalle de la RFP."
        storageKey="rfp-new-suppliers"
        right={
          <button
            type="button"
            onClick={() => setSuppliers((prev) => [...prev, emptySupplier()])}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            + Agregar proveedor
          </button>
        }
      >
        {supplierDirectory.length === 0 && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No hay proveedores activos en Configuración → Datos maestros →
            Proveedores. Agrega alguno ahí para poder invitarlos.
          </p>
        )}
        <div className="space-y-3">
          {suppliers.map((s, index) => {
            const selectedDir =
              supplierDirectory.find((d) => d.email === s.email) ?? null;
            return (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-12 sm:items-center"
              >
                <div className="sm:col-span-8">
                  <SupplierSearchPicker
                    suppliers={supplierDirectory}
                    selected={selectedDir}
                    onSelect={(dir) =>
                      updateSupplier(index, {
                        name: `${dir.contactFirstName} ${dir.contactLastName}`.trim(),
                        email: dir.email,
                        company: dir.companyName,
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
                    Quitar
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
          {pending ? "Guardando..." : "Guardar borrador"}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending
            ? mode === "edit"
              ? "Guardando..."
              : "Creando RFP..."
            : "Publicar RFP"}
        </button>
      </div>
    </form>
  );
}
