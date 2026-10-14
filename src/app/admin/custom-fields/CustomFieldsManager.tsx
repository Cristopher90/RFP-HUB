"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  CF_SCOPES,
  CF_SCOPE_KEY,
  CF_TYPES,
  HEADER_STD_FIELDS,
  LINE_STD_FIELDS,
  USER_MAPPABLE_RFP_FIELDS,
  hasOptions,
  isRequestScope,
  CUSTOM_TARGET_PREFIX,
  labelFor,
  parseImportRows,
  type CfCondition,
  type CfConditionKind,
  type CfScope,
  type CfType,
  type CustomFieldDef,
  type ImportedField,
} from "@/lib/customFieldsShared";
import { ViewGroupPicker, type ViewGroupOption } from "@/components/ViewGroupPicker";
import { loadPref, useSavePref } from "@/lib/userPrefsClient";
import { deleteCustomField, importCustomFields, saveCustomField, type CustomFieldInput } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50";
}
const smallBtn =
  "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50";

const SCOPE_KEY = CF_SCOPE_KEY;
const TYPE_KEY: Record<CfType, string> = {
  TREE: "typeTree",
  TEXT: "typeText",
  TEXT_SHORT: "typeTextShort",
  NUMBER: "typeNumber",
  DROPDOWN: "typeDropdown",
  AMOUNT: "typeAmount",
  CHECKBOX: "typeCheckbox",
};

type GroupBy = "none" | "scope" | "type" | "mandatory" | "active";
const GROUP_OPTIONS: GroupBy[] = ["scope", "type", "mandatory", "active"];
const GROUPING_KEY = "custom-fields-grouping";

function emptyInput(): CustomFieldInput {
  return {
    key: "",
    scope: "RFP_HEAD",
    type: "TEXT",
    mandatory: false,
    visible: true,
    editable: true,
    labels: { es: "", en: "" },
    lookupId: null,
    viewGroupIds: [],
    condition: null,
    mappable: false,
    importable: false,
    templateFilter: false,
    listFilter: false,
    mapToRfpKey: null,
    active: true,
  };
}

function toInput(f: CustomFieldDef): CustomFieldInput {
  return {
    id: f.id,
    key: f.key,
    scope: f.scope,
    type: f.type,
    mandatory: f.mandatory,
    visible: f.visible,
    editable: f.editable,
    labels: { es: f.labels.es ?? "", en: f.labels.en ?? "" },
    lookupId: f.lookupId,
    viewGroupIds: f.viewGroupIds,
    condition: f.condition,
    mappable: f.mappable,
    importable: f.importable,
    templateFilter: f.templateFilter,
    listFilter: f.listFilter,
    mapToRfpKey: f.mapToRfpKey,
    active: f.active,
  };
}

export function CustomFieldsManager({
  client,
  fields,
  tableName,
  lookups,
  viewGroups,
  initialEditId,
}: {
  initialEditId?: string;
  client: { id: string; code: string; description: string };
  fields: CustomFieldDef[];
  tableName: string;
  lookups: { id: string; name: string; count: number }[];
  viewGroups: ViewGroupOption[];
}) {
  const { t, language } = usePreferences();
  const router = useRouter();
  // A link from the lookups screen opens that field's editor right away.
  const [editing, setEditing] = useState<CustomFieldInput | null>(() => {
    const target = initialEditId ? fields.find((f) => f.id === initialEditId) : undefined;
    return target ? toInput(target) : null;
  });
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [groupingLoaded, setGroupingLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPref<{ groupBy?: GroupBy }>(GROUPING_KEY).then((saved) => {
      if (cancelled) return;
      if (saved?.groupBy && (saved.groupBy === "none" || GROUP_OPTIONS.includes(saved.groupBy))) {
        setGroupBy(saved.groupBy);
      }
      setGroupingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useSavePref(GROUPING_KEY, { groupBy }, groupingLoaded);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function conditionText(f: CustomFieldDef) {
    const c = f.condition;
    if (!c) return "—";
    const target = fields.find((x) => x.key === c.field);
    const name = target ? labelFor(target.labels, language, target.key) : c.field;
    let value = c.value;
    if (target && hasOptions(target.type)) {
      const opt = target.options.find((o) => o.value === c.value);
      if (opt) value = labelFor(opt.labels, language, opt.value);
    }
    if (c.op === "filled") return `${name}: ${t("customFields.conditionOpFilled")}`;
    if (c.op === "empty") return `${name}: ${t("customFields.conditionOpEmpty")}`;
    return `${name} ${c.op === "neq" ? "≠" : "="} ${value}`;
  }

  function mapTargetLabel(target: string) {
    if (target.startsWith(CUSTOM_TARGET_PREFIX)) {
      const key = target.slice(CUSTOM_TARGET_PREFIX.length);
      const field = fields.find((x) => x.key === key);
      return field ? labelFor(field.labels, language, key) : key;
    }
    return t(`customFields.stdHeader.${target}`);
  }

  function handleDelete(f: CustomFieldDef) {
    const name = labelFor(f.labels, language, f.key);
    if (!window.confirm(t("customFields.confirmDelete").replace("{name}", name))) return;
    startTransition(async () => {
      const result = await deleteCustomField(client.id, f.id);
      if ("error" in result) setMessage(result.error);
      else {
        setMessage(null);
        router.refresh();
      }
    });
  }

  function downloadFormat() {
    const rows = [
      ["Cliente", "document_type", "id_campo", "name", "name_en", "mandatory", "condition", "type", "Values", "Values_en"],
      [client.code, "RFP_head", "cus_priority", "Prioridad", "Priority", "true", "", "Desplegable", "alta, media, baja", "high, medium, low"],
      [client.code, "RFP_head", "cus_justification", "Justificacion", "Justification", "true", "Si (cus_priority = alta)", "Text", "", ""],
      [client.code, "RFP_head", "cus_id_budget", "ID de presupuesto", "Budget ID", "false", "", "Text(10)", "", ""],
      [client.code, "RFP_LINE", "cus_id_budget_line", "ID de presupuesto", "Budget ID", "false", "", "Text(10)", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "cus_Cliente");
    XLSX.writeFile(wb, "campos custom.xlsx");
  }

  function usageText(f: CustomFieldDef) {
    return [
      !f.visible && t("customFields.badgeHidden"),
      f.visible && !f.editable && t("customFields.badgeReadOnly"),
      f.mappable && t("customFields.badgeMappable"),
      f.importable && t("customFields.badgeImportable"),
      f.templateFilter && t("customFields.badgeTemplate"),
      f.listFilter && t("customFields.badgeList"),
      f.mapToRfpKey && mapTargetLabel(f.mapToRfpKey),
    ]
      .filter(Boolean)
      .join(" ");
  }

  // The search looks in every column of the table.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) =>
      [
        f.key,
        f.labels.es ?? "",
        f.labels.en ?? "",
        t(`customFields.${SCOPE_KEY[f.scope]}`),
        t(`customFields.${TYPE_KEY[f.type]}`),
        f.mandatory ? t("customFields.yes") : t("customFields.no"),
        conditionText(f),
        usageText(f),
        f.active ? t("customFields.yes") : t("customFields.no"),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, query, language]);

  const groupOptionLabel = (g: GroupBy) =>
    g === "scope"
      ? t("customFields.colScope")
      : g === "type"
        ? t("customFields.colType")
        : g === "mandatory"
          ? t("customFields.colMandatory")
          : t("customFields.colActive");

  // Rows grouped by "Applies to", type, mandatory or active (in a sensible order).
  const groups = useMemo(() => {
    if (groupBy === "none") return null;
    const keyOf = (f: CustomFieldDef) =>
      groupBy === "scope" ? f.scope : groupBy === "type" ? f.type : groupBy === "mandatory" ? String(f.mandatory) : String(f.active);
    const labelOf = (k: string) =>
      groupBy === "scope"
        ? t(`customFields.${SCOPE_KEY[k as CfScope]}`)
        : groupBy === "type"
          ? t(`customFields.${TYPE_KEY[k as CfType]}`)
          : groupBy === "mandatory"
            ? k === "true"
              ? t("customFields.groupMandatory")
              : t("customFields.groupOptional")
            : k === "true"
              ? t("customFields.groupActive")
              : t("customFields.groupInactive");
    const order =
      groupBy === "scope" ? (CF_SCOPES as string[]) : groupBy === "type" ? (CF_TYPES as string[]) : ["true", "false"];
    const byKey = new Map<string, CustomFieldDef[]>();
    for (const f of shown) byKey.set(keyOf(f), [...(byKey.get(keyOf(f)) ?? []), f]);
    return [...byKey.entries()]
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([key, rows]) => ({ key, label: labelOf(key), rows }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, groupBy, language]);

  function renderRow(f: CustomFieldDef) {
    return (
      <tr key={f.id} className={f.active ? "" : "opacity-50"}>
        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{f.key}</td>
        <td className="px-4 py-2.5">
          <div className="font-medium text-slate-900">{labelFor(f.labels, language, f.key)}</div>
          {f.labels.en && language !== "en" && <div className="text-xs text-slate-400">{f.labels.en}</div>}
        </td>
        <td className="px-4 py-2.5">{t(`customFields.${SCOPE_KEY[f.scope]}`)}</td>
        <td className="px-4 py-2.5">{t(`customFields.${TYPE_KEY[f.type]}`)}</td>
        <td className="px-4 py-2.5">{f.mandatory ? t("customFields.yes") : t("customFields.no")}</td>
        <td className="px-4 py-2.5 text-xs text-slate-600">{conditionText(f)}</td>
        <td className="px-4 py-2.5">
          <div className="flex flex-wrap gap-1">
            {!f.visible && <Badge>{t("customFields.badgeHidden")}</Badge>}
            {f.visible && !f.editable && <Badge>{t("customFields.badgeReadOnly")}</Badge>}
            {f.mappable && <Badge>{t("customFields.badgeMappable")}</Badge>}
            {f.importable && <Badge>{t("customFields.badgeImportable")}</Badge>}
            {f.templateFilter && <Badge>{t("customFields.badgeTemplate")}</Badge>}
            {f.listFilter && <Badge>{t("customFields.badgeList")}</Badge>}
            {f.mapToRfpKey && <Badge>→ {mapTargetLabel(f.mapToRfpKey)}</Badge>}
          </div>
        </td>
        <td className="px-4 py-2.5">{f.active ? t("customFields.yes") : t("customFields.no")}</td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex justify-end gap-2">
            <button type="button" className={smallBtn} onClick={() => setEditing(toInput(f))}>
              {t("customFields.edit")}
            </button>
            <button type="button" className={`${smallBtn} text-red-600 hover:bg-red-50`} onClick={() => handleDelete(f)}>
              {t("customFields.delete")}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="mt-2">
      {message && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(emptyInput())}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          + {t("customFields.newField")}
        </button>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {t("customFields.importExcel")}
        </button>
        <button type="button" onClick={downloadFormat} className="text-sm font-medium text-violet-700 hover:underline">
          {t("customFields.downloadTemplate")}
        </button>
        <span className="ml-auto text-xs text-slate-400">
          {t("customFields.storageNote").replace("{table}", tableName)}
        </span>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("customFields.empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
            <input
              type="search"
              className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder={t("customFields.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{t("customFields.fieldsCount").replace("{count}", String(shown.length))}</span>
              <label className="flex items-center gap-2">
                {t("customFields.groupBy")}
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  value={groupBy}
                  onChange={(e) => {
                    setGroupBy(e.target.value as GroupBy);
                    setCollapsed(new Set());
                  }}
                >
                  <option value="none">{t("customFields.noGrouping")}</option>
                  {GROUP_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {groupOptionLabel(g)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("customFields.colKey")}</th>
                  <th className="px-4 py-3">{t("customFields.colLabel")}</th>
                  <th className="px-4 py-3">{t("customFields.colScope")}</th>
                  <th className="px-4 py-3">{t("customFields.colType")}</th>
                  <th className="px-4 py-3">{t("customFields.colMandatory")}</th>
                  <th className="px-4 py-3">{t("customFields.colCondition")}</th>
                  <th className="px-4 py-3">{t("customFields.colUsage")}</th>
                  <th className="px-4 py-3">{t("customFields.colActive")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups
                  ? groups.map((g) => {
                      const isCollapsed = collapsed.has(g.key);
                      return (
                        <Fragment key={g.key}>
                          <tr
                            onClick={() =>
                              setCollapsed((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.key)) next.delete(g.key);
                                else next.add(g.key);
                                return next;
                              })
                            }
                            className="cursor-pointer bg-slate-100/70 hover:bg-slate-100"
                          >
                            <td colSpan={9} className="px-4 py-2.5 font-semibold text-slate-700">
                              <span className="mr-2 inline-block w-3 text-slate-400">{isCollapsed ? "▸" : "▾"}</span>
                              {g.label}
                              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                                {g.rows.length}
                              </span>
                            </td>
                          </tr>
                          {!isCollapsed && g.rows.map(renderRow)}
                        </Fragment>
                      );
                    })
                  : shown.map(renderRow)}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      {t("customFields.noMatches")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <FieldEditor
          lookups={lookups}
          viewGroups={viewGroups}
          clientId={client.id}
          initial={editing}
          others={fields.filter((f) => f.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage(null);
            router.refresh();
          }}
        />
      )}
      {importing && (
        <ImportDialog
          client={client}
          onClose={() => setImporting(false)}
          onDone={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
      {children}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="close" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldEditor({
  clientId,
  initial,
  others,
  lookups,
  viewGroups,
  onClose,
  onSaved,
}: {
  lookups: { id: string; name: string; count: number }[];
  viewGroups: ViewGroupOption[];
  clientId: string;
  initial: CustomFieldInput;
  others: CustomFieldDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = usePreferences();
  const [form, setForm] = useState<CustomFieldInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(initial.id);

  function patch(p: Partial<CustomFieldInput>) {
    setForm((prev) => ({ ...prev, ...p }));
  }
  // What the condition can point at, given where this field lives.
  const kinds: CfConditionKind[] =
    form.scope === "USER"
      ? ["USER_CUSTOM"]
      : form.scope === "RFP_HEAD"
        ? ["HEADER_STD", "HEADER_CUSTOM"]
        : ["HEADER_STD", "HEADER_CUSTOM", "LINE_STD", "LINE_CUSTOM"];
  const kindLabel: Record<CfConditionKind, string> = {
    HEADER_STD: t("customFields.conditionSourceHeaderStd"),
    HEADER_CUSTOM: t("customFields.conditionSourceHeaderCustom"),
    LINE_STD: t("customFields.conditionSourceLineStd"),
    LINE_CUSTOM: t("customFields.conditionSourceLineCustom"),
    USER_CUSTOM: t("customFields.conditionSourceUserCustom"),
  };
  function targetsFor(kind: CfConditionKind): { value: string; label: string }[] {
    const std = (list: readonly string[], prefix: string) =>
      list.map((k) => ({ value: k, label: t(`customFields.${prefix}.${k}`) }));
    const custom = (scope: CfScope) =>
      others
        .filter((o) => o.scope === scope && o.key !== form.key)
        .map((o) => ({ value: o.key, label: `${labelFor(o.labels, language, o.key)} (${o.key})` }));
    switch (kind) {
      case "HEADER_STD":
        return std(HEADER_STD_FIELDS, "stdHeader");
      case "LINE_STD":
        return std(LINE_STD_FIELDS, "stdLine");
      case "HEADER_CUSTOM":
        return custom("RFP_HEAD");
      case "LINE_CUSTOM":
        return custom("RFP_LINE");
      case "USER_CUSTOM":
        return custom("USER");
    }
  }
  const cond = form.condition;
  const condTarget =
    cond && (cond.kind === "HEADER_CUSTOM" || cond.kind === "LINE_CUSTOM" || cond.kind === "USER_CUSTOM")
      ? others.find((o) => o.key === cond.field)
      : undefined;

  const isRequest = isRequestScope(form.scope);
  const isSupplier = form.scope === "SUPPLIER";

  function changeScope(scope: CfScope) {
    patch({
      scope,
      condition: null,
      mandatory: isRequestScope(scope) ? false : form.mandatory,
      importable: isRequestScope(scope) ? true : false,
      mappable: scope === "USER" || scope === "SUPPLIER" ? false : form.mappable,
      templateFilter: scope === "RFP_HEAD" ? form.templateFilter : false,
      listFilter: scope === "RFP_HEAD" ? form.listFilter : false,
      mapToRfpKey: scope === "USER" ? form.mapToRfpKey : null,
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveCustomField(clientId, form);
      if ("error" in result) setError(result.error);
      else onSaved();
    });
  }

  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <Modal title={isEdit ? t("customFields.editorEdit") : t("customFields.editorNew")} onClose={onClose} wide>
      <div className="space-y-5">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>{t("customFields.fieldKey")}</label>
            <input
              className={`${inputClass()} font-mono`}
              value={form.key}
              disabled={isEdit}
              onChange={(e) => patch({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              placeholder="cus_priority"
            />
            {!isEdit && <p className="mt-1 text-xs text-slate-400">{t("customFields.fieldKeyHint")}</p>}
          </div>
          <div>
            <label className={labelClass}>{t("customFields.scope")}</label>
            <select className={inputClass()} value={form.scope} onChange={(e) => changeScope(e.target.value as CfScope)}>
              {CF_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {t(`customFields.${SCOPE_KEY[s]}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("customFields.type")}</label>
            <select
              className={inputClass()}
              value={form.type}
              onChange={(e) => patch({ type: e.target.value as CfType })}
            >
              {CF_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`customFields.${TYPE_KEY[ty]}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-slate-700">
          {!isRequest && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.mandatory} onChange={(e) => patch({ mandatory: e.target.checked })} />
              {t("customFields.mandatory")}
            </label>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => patch({ active: e.target.checked })} />
            {t("customFields.active")}
          </label>
          <label className="flex items-center gap-2" title={t("customFields.visibleHint")}>
            <input type="checkbox" checked={form.visible} onChange={(e) => patch({ visible: e.target.checked })} />
            {t("customFields.visible")}
          </label>
          {!isRequest && form.visible && (
            <label className="flex items-center gap-2" title={t("customFields.editableHint")}>
              <input type="checkbox" checked={form.editable} onChange={(e) => patch({ editable: e.target.checked })} />
              {t("customFields.editable")}
            </label>
          )}
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">{t("customFields.labelsTitle")}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("customFields.labelEs")}</label>
              <input
                className={inputClass()}
                value={form.labels.es ?? ""}
                onChange={(e) => patch({ labels: { ...form.labels, es: e.target.value } })}
              />
            </div>
            <div>
              <label className={labelClass}>{t("customFields.labelEn")}</label>
              <input
                className={inputClass()}
                value={form.labels.en ?? ""}
                onChange={(e) => patch({ labels: { ...form.labels, en: e.target.value } })}
              />
            </div>
          </div>
        </fieldset>

        {hasOptions(form.type) && (
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">{t("customFields.lookupTitle")}</legend>
            <select
              className={inputClass()}
              value={form.lookupId ?? ""}
              onChange={(e) => patch({ lookupId: e.target.value || null })}
            >
              <option value="">{t("customFields.lookupPick")}</option>
              {lookups.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.count})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {t("customFields.lookupHint")}{" "}
              <a
                href={`/admin/master-data/lookups?clientId=${clientId}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-violet-600 hover:underline"
              >
                {t("customFields.lookupManage")}
              </a>
            </p>
          </fieldset>
        )}

        {viewGroups.length > 0 && (
          <div>
            <label className={labelClass}>{t("viewGroups.fieldLabel")}</label>
            <div className="max-w-sm">
              <ViewGroupPicker
                groups={viewGroups}
                value={form.viewGroupIds}
                onChange={(next) => patch({ viewGroupIds: next })}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{t("viewGroups.fieldHint")}</p>
          </div>
        )}

        {!isRequest && !isSupplier && (
        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">{t("customFields.conditionTitle")}</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={cond === null}
              onChange={(e) =>
                patch({ condition: e.target.checked ? null : { kind: kinds[0], field: "", op: "eq", value: "" } })
              }
            />
            {t("customFields.conditionNone")}
          </label>
          {cond && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t("customFields.conditionOnlyIf")}</label>
                <select
                  className={inputClass()}
                  value={cond.kind}
                  onChange={(e) =>
                    patch({ condition: { kind: e.target.value as CfConditionKind, field: "", op: cond.op, value: "" } })
                  }
                >
                  {kinds.map((k) => (
                    <option key={k} value={k}>
                      {kindLabel[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>&nbsp;</label>
                <select
                  className={inputClass()}
                  value={cond.field}
                  onChange={(e) => patch({ condition: { ...cond, field: e.target.value, value: "" } })}
                >
                  <option value="" />
                  {targetsFor(cond.kind).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  className={inputClass()}
                  value={cond.op}
                  onChange={(e) => patch({ condition: { ...cond, op: e.target.value as CfCondition["op"] } })}
                >
                  <option value="eq">{t("customFields.conditionOpEq")}</option>
                  <option value="neq">{t("customFields.conditionOpNeq")}</option>
                  {condTarget && condTarget.type !== "CHECKBOX" && (
                    <>
                      <option value="filled">{t("customFields.conditionOpFilled")}</option>
                      <option value="empty">{t("customFields.conditionOpEmpty")}</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                {cond.op === "filled" || cond.op === "empty" ? null : condTarget && hasOptions(condTarget.type) ? (
                  <select
                    className={inputClass()}
                    value={cond.value}
                    onChange={(e) => patch({ condition: { ...cond, value: e.target.value } })}
                  >
                    <option value="" />
                    {condTarget.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {labelFor(o.labels, language, o.value)}
                      </option>
                    ))}
                  </select>
                ) : condTarget?.type === "CHECKBOX" ? (
                  <select
                    className={inputClass()}
                    value={cond.value}
                    onChange={(e) => patch({ condition: { ...cond, value: e.target.value } })}
                  >
                    <option value="" />
                    <option value="true">{t("customFields.conditionCheckedTrue")}</option>
                    <option value="false">{t("customFields.conditionCheckedFalse")}</option>
                  </select>
                ) : (
                  <input
                    className={inputClass()}
                    placeholder={t("customFields.conditionValue")}
                    value={cond.value}
                    onChange={(e) => patch({ condition: { ...cond, value: e.target.value } })}
                  />
                )}
              </div>
            </div>
          )}
        </fieldset>
        )}

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">{t("customFields.usageTitle")}</legend>
          <div className="space-y-2 text-sm text-slate-700">
            {form.scope !== "USER" && !isSupplier && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.mappable} onChange={(e) => patch({ mappable: e.target.checked })} />
                {isRequest ? t("customFields.mappableRequest") : t("customFields.mappable")}
              </label>
            )}
            {isRequest && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.importable}
                  onChange={(e) => patch({ importable: e.target.checked })}
                />
                {t("customFields.importable")}
              </label>
            )}
            {form.scope === "RFP_HEAD" && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.templateFilter}
                    onChange={(e) => patch({ templateFilter: e.target.checked })}
                  />
                  {t("customFields.templateFilter")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.listFilter}
                    onChange={(e) => patch({ listFilter: e.target.checked })}
                  />
                  {t("customFields.listFilter")}
                </label>
              </>
            )}
            {form.scope === "USER" && (
              <div>
                <label className={labelClass}>{t("customFields.mapToRfp")}</label>
                <select
                  className={inputClass()}
                  value={form.mapToRfpKey ?? ""}
                  onChange={(e) => patch({ mapToRfpKey: e.target.value || null })}
                >
                  <option value="">{t("customFields.mapToRfpNone")}</option>
                  <optgroup label={t("customFields.mapToRfpStdGroup")}>
                    {USER_MAPPABLE_RFP_FIELDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`customFields.stdHeader.${k}`)}
                      </option>
                    ))}
                  </optgroup>
                  {others.some((o) => o.scope === "RFP_HEAD") && (
                    <optgroup label={t("customFields.mapToRfpCustomGroup")}>
                      {others
                        .filter((o) => o.scope === "RFP_HEAD")
                        .map((o) => (
                          <option key={o.key} value={`${CUSTOM_TARGET_PREFIX}${o.key}`}>
                            {labelFor(o.labels, language, o.key)} ({o.key})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                <p className="mt-1 text-xs text-slate-400">{t("customFields.mapToRfpHint")}</p>
              </div>
            )}
          </div>
        </fieldset>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={`${smallBtn} px-4 py-2 text-sm`}>
            {t("customFields.cancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? t("customFields.saving") : t("customFields.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ImportDialog({
  client,
  onClose,
  onDone,
}: {
  client: { id: string; code: string; description: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = usePreferences();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportedField[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setRows(null);
    try {
      // CSV is read as UTF-8 text (as an array it would be decoded as Latin-1).
      const wb = file.name.toLowerCase().endsWith(".csv")
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "cus_cliente") ?? wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "" });
      const parsed = parseImportRows(data);
      if (parsed.errors[0] === "columns" || parsed.errors[0] === "empty") {
        setError(t("customFields.importBadColumns"));
        return;
      }
      if (parsed.errors.length > 0) {
        setError(t("customFields.importBadRows").replace("{rows}", parsed.errors.join(", ")));
        return;
      }
      const mine = parsed.fields.filter((f) => f.clientCode.toLowerCase() === client.code.toLowerCase());
      setRows(mine);
    } catch {
      setError(t("customFields.importFileError"));
    }
  }

  function apply() {
    if (!rows) return;
    setError(null);
    startTransition(async () => {
      const res = await importCustomFields(client.id, rows);
      if ("error" in res) setError(res.error);
      else {
        setResult(
          t("customFields.importDone")
            .replace("{created}", String(res.created))
            .replace("{updated}", String(res.updated)),
        );
        setRows(null);
        onDone();
      }
    });
  }

  return (
    <Modal title={t("customFields.importTitle")} onClose={onClose}>
      <p className="text-sm text-slate-600">{t("customFields.importHint")}</p>
      <p className="mt-2 text-xs text-slate-500">
        {t("customFields.importOnlyClient").replace("{client}", client.code)}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="mt-4 block text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {result && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {result}
        </div>
      )}
      {rows && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-800">
            {t("customFields.importPreview").replace("{count}", String(rows.length))}
          </p>
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-200 text-xs text-slate-600">
            {rows.map((r) => (
              <li key={r.key} className="flex gap-3 border-b border-slate-100 px-3 py-1.5 last:border-0">
                <span className="font-mono">{r.key}</span>
                <span>{r.labels.es}</span>
                <span className="ml-auto text-slate-400">
                  {t(`customFields.${SCOPE_KEY[r.scope]}`)} · {t(`customFields.${TYPE_KEY[r.type]}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={`${smallBtn} px-4 py-2 text-sm`}>
          {t("customFields.cancel")}
        </button>
        <button
          type="button"
          disabled={!rows || rows.length === 0 || pending}
          onClick={apply}
          className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {t("customFields.importApply")}
        </button>
      </div>
    </Modal>
  );
}
