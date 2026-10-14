"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { returnRfpToDraft } from "./actions";

// "Editar" on a published RFP: after confirming, it goes back to draft (the
// suppliers' responses are lost) and opens the editor.
export function EditPublishedButton({ rfpId, responseCount }: { rfpId: string; responseCount: number }) {
  const { t } = usePreferences();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(t("rfpDetail.editPublishedConfirm").replace("{count}", String(responseCount)))) return;
    setError(null);
    startTransition(async () => {
      const result = await returnRfpToDraft(rfpId);
      if ("error" in result) setError(result.error);
      else router.push(`/rfps/${rfpId}/edit`);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
      >
        {t("rfpDetail.editPublished")}
      </button>
      {error && <span className="w-full text-right text-xs text-red-600">{error}</span>}
    </>
  );
}
