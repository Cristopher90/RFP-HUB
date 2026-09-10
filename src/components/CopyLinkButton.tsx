"use client";

import { useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function CopyLinkButton({ path }: { path: string }) {
  const { t } = usePreferences();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(t("copyLinkButton.promptCopy"), url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
    >
      {copied ? t("copyLinkButton.copied") : t("copyLinkButton.copyLink")}
    </button>
  );
}
