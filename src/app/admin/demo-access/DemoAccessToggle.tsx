"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { saveDemoAccess } from "./actions";

export function DemoAccessToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const { t } = usePreferences();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setError(null);
    startTransition(async () => {
      const result = await saveDemoAccess(next);
      if (result.error) setError(t("demoAccessPage.saveError"));
      else setEnabled(next);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{t("demoAccessPage.toggleLabel")}</p>
          <p className="text-xs text-slate-500">{enabled ? t("demoAccessPage.stateOn") : t("demoAccessPage.stateOff")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("demoAccessPage.toggleLabel")}
          disabled={pending}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-violet-600" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
