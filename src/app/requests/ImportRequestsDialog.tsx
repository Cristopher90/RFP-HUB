"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { parseRequestsFile, type ImportIssue } from "@/lib/requestImport";
import type { HeaderMapping, LinesMapping } from "@/lib/requestFields";
import { importPurchaseRequests } from "./actions";

type Template = {
  id: string;
  name: string;
  headerSheet: string;
  linesSheet: string;
  headerMapping: HeaderMapping;
  linesMapping: LinesMapping;
};

const ISSUE_KEY: Record<ImportIssue["code"], string> = {
  missingSheet: "issueMissingSheet",
  missingColumn: "issueMissingColumn",
  noDocuments: "issueNoDocuments",
  orphanLines: "issueOrphanLines",
  documentWithoutLines: "issueDocumentWithoutLines",
  invalidQuantity: "issueInvalidQuantity",
};

export function ImportRequestsDialog({
  canImport,
  templates,
  targetClientId,
}: {
  canImport: boolean;
  templates: Template[];
  targetClientId: string;
}) {
  const { t } = usePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setFile(null);
    setMessages([]);
    setError(null);
    setSummary(null);
  }

  async function handleImport() {
    const template = templates.find((x) => x.id === templateId);
    if (!template || !file) return;
    setError(null);
    setSummary(null);
    setMessages([]);
    try {
      setBusy("reading");
      const parsed = await parseRequestsFile(file, template);
      const issueMessages = parsed.issues.map((issue) =>
        t(`requestImportDialog.${ISSUE_KEY[issue.code]}`).replace("{value}", issue.value ?? ""),
      );
      setMessages(issueMessages);
      if (parsed.documents.length === 0) {
        if (issueMessages.length === 0) setError(t("requestImportDialog.nothingToImport"));
        return;
      }
      setBusy("importing");
      const result = await importPurchaseRequests(template.id, parsed.documents, targetClientId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSummary(
        t("requestImportDialog.summary")
          .replace("{created}", String(result.created))
          .replace("{updated}", String(result.updated))
          .replace("{skipped}", String(result.skipped)),
      );
      if (result.failed.length > 0) {
        setMessages((prev) => [
          ...prev,
          ...result.failed.map((n) => t("requestImportDialog.issueFailed").replace("{value}", n)),
        ]);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const buttonBase = "rounded-lg px-4 py-2 text-sm font-medium";
  return (
    <>
      <button
        type="button"
        disabled={!canImport}
        onClick={() => setOpen(true)}
        className={`${buttonBase} bg-violet-600 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {t("requestsPage.importExcel")}
      </button>
      <button
        type="button"
        disabled
        title={t("requestsPage.apiSoon")}
        className={`${buttonBase} border border-slate-300 text-slate-400 disabled:cursor-not-allowed`}
      >
        {t("requestsPage.importApi")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 py-16"
          onClick={() => !busy && close()}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-900">
                {t("requestImportDialog.title")}
              </h2>
            </div>
            <div className="space-y-4 p-4">
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500">{t("requestImportDialog.noTemplates")}</p>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {t("requestImportDialog.template")}
                    </label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                    >
                      <option value="">{t("requestImportDialog.selectTemplate")}</option>
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {t("requestImportDialog.file")}
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="block w-full text-sm text-slate-600"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {summary && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {summary}
                </div>
              )}
              {messages.length > 0 && (
                <ul className="max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs text-amber-700">
                  {messages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={close}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {t("requestImportDialog.close")}
              </button>
              <button
                type="button"
                disabled={busy !== null || !templateId || !file}
                onClick={handleImport}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {busy === "reading"
                  ? t("requestImportDialog.reading")
                  : busy === "importing"
                    ? t("requestImportDialog.importing")
                    : t("requestImportDialog.import")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
