"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { readWorkbookInfo, type WorkbookInfo } from "@/lib/requestImport";
import {
  DEFAULT_RFP_MAPPING,
  HEADER_FIELDS,
  LINE_FIELDS,
  REQUEST_PLACEHOLDERS,
  REQUIRED_HEADER_FIELDS,
  REQUIRED_LINE_FIELDS,
  RFP_ITEM_SOURCES,
  RFP_ITEM_TARGETS,
  type HeaderMapping,
  type LinesMapping,
  type RfpItemSource,
  type RfpItemTarget,
  type RfpMapping,
} from "@/lib/requestFields";
import { deleteRequestImportTemplate, saveRequestImportTemplate } from "./actions";

type Initial = {
  id: string;
  name: string;
  headerSheet: string;
  linesSheet: string;
  headerMapping: HeaderMapping;
  linesMapping: LinesMapping;
  rfpMapping: RfpMapping | null;
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function unique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export function RequestTemplateForm({
  initial,
  targetClientId,
}: {
  initial?: Initial;
  targetClientId: string;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const idBase = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [headerSheet, setHeaderSheet] = useState(initial?.headerSheet ?? "");
  const [linesSheet, setLinesSheet] = useState(initial?.linesSheet ?? "");
  const [headerMapping, setHeaderMapping] = useState<HeaderMapping>(initial?.headerMapping ?? {});
  const [linesMapping, setLinesMapping] = useState<LinesMapping>(initial?.linesMapping ?? {});
  const [rfpMapping, setRfpMapping] = useState<RfpMapping>(
    initial?.rfpMapping ?? DEFAULT_RFP_MAPPING,
  );
  const [showRfp, setShowRfp] = useState(false);
  const [rfpTouched, setRfpTouched] = useState(Boolean(initial?.rfpMapping));
  const [workbook, setWorkbook] = useState<WorkbookInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSample(file: File | undefined) {
    if (!file) return;
    const info = await readWorkbookInfo(file);
    setWorkbook(info);
    // Pre-pick sheets when the template has none yet.
    if (!headerSheet && info.sheets[0]) setHeaderSheet(info.sheets[0].name);
    if (!linesSheet && info.sheets[1]) setLinesSheet(info.sheets[1].name);
  }

  const sheetNames = useMemo(
    () => unique([...(workbook?.sheets.map((s) => s.name) ?? []), initial?.headerSheet, initial?.linesSheet]),
    [workbook, initial],
  );
  const columnsOf = (sheet: string, saved: (string | undefined)[]) =>
    unique([...(workbook?.sheets.find((s) => s.name === sheet)?.headers ?? []), ...saved]);
  const headerColumns = columnsOf(headerSheet, Object.values(initial?.headerMapping ?? {}));
  const lineColumns = columnsOf(linesSheet, Object.values(initial?.linesMapping ?? {}));

  function touchRfp(patch: Partial<RfpMapping>) {
    setRfpTouched(true);
    setSaved(false);
    setRfpMapping((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveRequestImportTemplate(
        {
          id: initial?.id,
          name,
          headerSheet,
          linesSheet,
          headerMapping,
          linesMapping,
          rfpMapping: rfpTouched ? rfpMapping : null,
        },
        targetClientId,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (initial) setSaved(true);
      else router.push(`/admin/request-templates/${result.id}?clientId=${targetClientId}`);
    });
  }

  function handleDelete() {
    if (!initial || !confirm(t("requestTemplateForm.deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteRequestImportTemplate(initial.id, targetClientId);
      if (result && "error" in result) setError(result.error);
    });
  }

  const labelClass = "mb-1 block text-sm font-medium text-slate-700";
  const sectionClass = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

  function renderColumnInput({
    listId,
    value,
    onChange,
    columns,
  }: {
    listId: string;
    value: string;
    onChange: (v: string) => void;
    columns: string[];
  }) {
    return (
      <>
        <input
          className={inputClass()}
          list={listId}
          placeholder={t("requestTemplateForm.notMapped")}
          value={value}
          onChange={(e) => {
            setSaved(false);
            onChange(e.target.value);
          }}
        />
        <datalist id={listId}>
          {columns.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("requestTemplateForm.saved")}
        </div>
      )}

      <section className={sectionClass}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t("requestTemplateForm.name")}</label>
            <input
              className={inputClass()}
              value={name}
              onChange={(e) => {
                setSaved(false);
                setName(e.target.value);
              }}
            />
          </div>
          <div>
            <label className={labelClass}>{t("requestTemplateForm.sampleFile")}</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-slate-600"
              onChange={(e) => handleSample(e.target.files?.[0])}
            />
            <p className="mt-1 text-xs text-slate-400">{t("requestTemplateForm.sampleHint")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("requestTemplateForm.headerSheet")}</label>
              <input
                className={inputClass()}
                list={`${idBase}-sheets`}
                placeholder={t("requestTemplateForm.selectSheet")}
                value={headerSheet}
                onChange={(e) => {
                  setSaved(false);
                  setHeaderSheet(e.target.value);
                }}
              />
            </div>
            <div>
              <label className={labelClass}>{t("requestTemplateForm.linesSheet")}</label>
              <input
                className={inputClass()}
                list={`${idBase}-sheets`}
                placeholder={t("requestTemplateForm.selectSheet")}
                value={linesSheet}
                onChange={(e) => {
                  setSaved(false);
                  setLinesSheet(e.target.value);
                }}
              />
            </div>
            <datalist id={`${idBase}-sheets`}>
              {sheetNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          {t("requestTemplateForm.headerMappingTitle")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HEADER_FIELDS.map((field) => (
            <div key={field}>
              <label className={labelClass}>
                {t(`requestHeaderFields.${field}`)}
                {REQUIRED_HEADER_FIELDS.includes(field) && " *"}
              </label>
              {renderColumnInput({
                listId: `${idBase}-h-${field}`,
                columns: headerColumns,
                value: headerMapping[field] ?? "",
                onChange: (v) => setHeaderMapping((prev) => ({ ...prev, [field]: v })),
                })}
            </div>
          ))}
          <div>
            <label className={labelClass}>{t("requestTemplateForm.fixedType")}</label>
            <input
              className={inputClass()}
              placeholder={t("requestTemplateForm.fixedTypePlaceholder")}
              value={headerMapping.documentTypeFixed ?? ""}
              onChange={(e) => {
                setSaved(false);
                setHeaderMapping((prev) => ({ ...prev, documentTypeFixed: e.target.value }));
              }}
            />
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-slate-900">
          {t("requestTemplateForm.linesMappingTitle")}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LINE_FIELDS.map((field) => (
            <div key={field}>
              <label className={labelClass}>
                {t(`requestLineFields.${field}`)}
                {REQUIRED_LINE_FIELDS.includes(field) && " *"}
              </label>
              {renderColumnInput({
                listId: `${idBase}-l-${field}`,
                columns: lineColumns,
                value: linesMapping[field] ?? "",
                onChange: (v) => setLinesMapping((prev) => ({ ...prev, [field]: v })),
                })}
            </div>
          ))}
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={() => setShowRfp((v) => !v)}
          className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
        >
          {showRfp ? t("requestTemplateForm.hideRfpMapping") : t("requestTemplateForm.mapToRfp")}
        </button>
      </div>

      {showRfp && (
        <section className={sectionClass}>
          <h2 className="text-base font-semibold text-slate-900">
            {t("requestTemplateForm.rfpMappingTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t("requestTemplateForm.rfpMappingHint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>{t("requestTemplateForm.placeholdersHint")}</span>
            {REQUEST_PLACEHOLDERS.map((p) => (
              <code key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                {`{${p}}`}
              </code>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className={labelClass}>{t("requestTemplateForm.titleTemplate")}</label>
              <input
                className={inputClass()}
                value={rfpMapping.titleTemplate}
                onChange={(e) => touchRfp({ titleTemplate: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t("requestTemplateForm.descriptionTemplate")}</label>
              <textarea
                className={inputClass()}
                rows={2}
                value={rfpMapping.descriptionTemplate}
                onChange={(e) => touchRfp({ descriptionTemplate: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>{t("requestTemplateForm.predecessorTemplate")}</label>
              <input
                className={inputClass()}
                value={rfpMapping.predecessorTemplate}
                onChange={(e) => touchRfp({ predecessorTemplate: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rfpMapping.estimatedFromLines}
                onChange={(e) => touchRfp({ estimatedFromLines: e.target.checked })}
              />
              {t("requestTemplateForm.estimatedFromLines")}
            </label>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                {t("requestTemplateForm.itemsTitle")}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {RFP_ITEM_TARGETS.map((target: RfpItemTarget) => (
                  <div key={target}>
                    <label className={labelClass}>{t(`rfpItemFields.${target}`)}</label>
                    <select
                      className={inputClass()}
                      value={rfpMapping.item[target]}
                      onChange={(e) =>
                        touchRfp({
                          item: {
                            ...rfpMapping.item,
                            [target]: e.target.value as RfpItemSource | "",
                          },
                        })
                      }
                    >
                      <option value="">{t("requestTemplateForm.notMapped")}</option>
                      {RFP_ITEM_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {t(`requestLineFields.${source}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        {initial ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
          >
            {t("requestTemplateForm.delete")}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("requestTemplateForm.saving") : t("requestTemplateForm.save")}
        </button>
      </div>
    </div>
  );
}
