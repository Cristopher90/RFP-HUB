"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function CopyRfpButton({ rfpId }: { rfpId: string }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        {t("copyRfpButton.copy")}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => router.push(`/rfps/new?copyFrom=${rfpId}&mode=blank`)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="block font-medium text-slate-800">
                {t("copyRfpButton.startFromScratchTitle")}
              </span>
              <span className="block text-xs text-slate-400">
                {t("copyRfpButton.startFromScratchHint")}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/rfps/new?copyFrom=${rfpId}&mode=based_on`)
              }
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="block font-medium text-slate-800">
                {t("copyRfpButton.usePreviousTitle")}
              </span>
              <span className="block text-xs text-slate-400">
                {t("copyRfpButton.usePreviousHint")}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/rfps/new?copyFrom=${rfpId}&mode=next_round`)
              }
              className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="block font-medium text-slate-800">
                {t("copyRfpButton.nextRoundTitle")}
              </span>
              <span className="block text-xs text-slate-400">
                {t("copyRfpButton.nextRoundHint")}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
