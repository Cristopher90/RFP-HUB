"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { uploadBuyerAttachment } from "../buyerAttachment";

// The buyer's file answer: pick a file (it is stored right away) and keep its
// reference as the answer; the current file is shown with a link and can be removed.
export function BuyerFileAnswer({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [href, filename] = value ? value.split("|") : ["", ""];

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await uploadBuyerAttachment(fd);
      if ("error" in result) setError(result.error);
      else onChange(result.value);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <>
            <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-violet-600 underline">
              {filename || t("buyerQuestionForm.currentFile")}
            </a>
            <button type="button" onClick={() => onChange("")} className="text-xs text-slate-400 hover:text-red-600">
              {t("rfpForm.removeFile")}
            </button>
          </>
        )}
        <input type="file" disabled={pending} onChange={pick} className="text-xs text-slate-600" />
        {pending && <span className="text-xs text-slate-400">{t("rfpForm.uploadingFile")}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
