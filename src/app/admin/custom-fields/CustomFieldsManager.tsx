"use client";

import { useRef, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  CF_SCOPES,
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
  type CfOption,
  type CfScope,
  type CfType,
  type CustomFieldDef,
  type ImportedField,
} from "@/lib/customFieldsShared";
import { deleteCustomField, importCustomFields, saveCustomField, type CustomFieldInput } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50";
}
const smallBtn =
  "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50";

const SCOPE_KEY: Record<CfScope, string> = {
  RFP_HEAD: "scopeRfpHead",
  RFP_LINE: "scopeRfpLine",
  USER: "scopeUser",
  REQUEST_HEAD: "scopeRequestHead",
  REQUEST_LINE: "scopeRequestLine",
};
const TYPE_KEY: Record<CfType, string> = {
  TREE: "typeTree",
  TEXT: "typeText",
  TEXT_SHORT: "typeTextShort",
  NUMBER: "typeNumber",
  DROPDOWN: "typeDropdown",
  AMOUNT: "typeAmount",
  CHECKBOX: "typeCheckbox",
};

function emptyInput(): CustomFieldInput {
  return {
    key: "",
    scope: "RFP_HEAD",
    type: "TEXT",
    mandatory: false,
    labels: { es: "", en: "" },
    options: [],
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
    labels: { es: f.labels.es ?? "", en: f.labels.en ?? "" },
    options: f.options.map((o) => ({ ...o, labels: { es: o.labels.es ?? "", en: o.labels.en ?? "" } })),
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
}: {
  client: { id: string; code: string; description: string };
  fields: CustomFieldDef[];
  tableName: string;
}) {
  const { t, language } = usePreferences();
  const router = useRouter();
  const [editing, setEditing] = useState<CustomFieldInput | null>(null);
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
              {fields.map((f) => (
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
                      <button
                        type="button"
                        className={`${smallBtn} text-red-600 hover:bg-red-50`}
                        onClick={() => handleDelete(f)}
                      >
                        {t("customFields.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <FieldEditor
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
  onClose,
  onSaved,
}: {
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
  function setOption(idx: number, p: Partial<CfOption> & { labelEs?: string; labelEn?: string }) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => {
        if (i !== idx) return o;
        const next = { ...o, ...p, labels: { ...o.labels } };
        if (p.labelEs !== undefined) next.labels.es = p.labelEs;
        if (p.labelEn !== undefined) next.labels.en = p.labelEn;
        return next as CfOption;
      }),
    }));
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

  function changeScope(scope: CfScope) {
    patch({
      scope,
      condition: null,
      mandatory: isRequestScope(scope) ? false : form.mandatory,
      importable: isRequestScope(scope) ? true : false,
      mappable: scope === "USER" ? false : form.mappable,
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
            <legend className="px-1 text-sm font-semibold text-slate-800">{t("customFields.optionsTitle")}</legend>
            {form.type === "TREE" && (
              <p className="mb-2 text-xs text-slate-500">{t("customFields.optionsTreeHint")}</p>
            )}
            <div className="space-y-2">
              {form.options.map((o, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${inputClass()} !w-32 font-mono`}
                    placeholder={t("customFields.optionValue")}
                    value={o.value}
                    onChange={(e) => {
                      const oldValue = o.value;
                      const value = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        options: prev.options.map((x, i) =>
                          i === idx ? { ...x, value } : x.parent === oldValue ? { ...x, parent: value } : x,
                        ),
                        condition: prev.condition,
                      }));
                    }}
                  />
                  <input
                    className={`${inputClass()} !w-40`}
                    placeholder={t("customFields.optionLabelEs")}
                    value={o.labels.es ?? ""}
                    onChange={(e) => setOption(idx, { labelEs: e.target.value })}
                  />
                  <input
                    className={`${inputClass()} !w-40`}
                    placeholder={t("customFields.optionLabelEn")}
                    value={o.labels.en ?? ""}
                    onChange={(e) => setOption(idx, { labelEn: e.target.value })}
                  />
                  {form.type === "TREE" && (
                    <select
                      className={`${inputClass()} !w-40`}
                      value={o.parent ?? ""}
                      onChange={(e) => setOption(idx, { parent: e.target.value || null })}
                    >
                      <option value="">{t("customFields.optionNoParent")}</option>
                      {form.options
                        .filter((p, i) => i !== idx && p.value)
                        .map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.labels.es || p.value}
                          </option>
                        ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className={smallBtn}
                    onClick={() => patch({ options: form.options.filter((_, i) => i !== idx) })}
                  >
                    {t("customFields.removeOption")}
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={`${smallBtn} mt-3`}
              onClick={() => patch({ options: [...form.options, { value: "", parent: null, labels: { es: "", en: "" } }] })}
            >
              + {t("customFields.addOption")}
            </button>
          </fieldset>
        )}

        {!isRequest && (
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
            {form.scope !== "USER" && (
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
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
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
