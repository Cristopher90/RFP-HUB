"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  formatCurrency as formatCurrencyBase,
  formatDate as formatDateBase,
  formatDateTime as formatDateTimeBase,
} from "@/lib/format";
import { localeForLanguage } from "./locale";
import type { Dictionary } from "./getDictionary";

type PreferencesContextValue = {
  locale: string;
  language: string;
  timeZone: string;
  currency: string;
  dictionary: Dictionary;
  t: (path: string) => string;
  formatDate: (value: Date | string) => string;
  formatDateTime: (value: Date | string) => string;
  formatCurrency: (value: number) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  language,
  timeZone,
  currency,
  dictionary,
  children,
}: {
  language: string;
  timeZone: string;
  currency: string;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo<PreferencesContextValue>(() => {
    const locale = localeForLanguage(language);
    return {
      locale,
      language,
      timeZone,
      currency,
      dictionary,
      t: (path) => resolveKey(dictionary, path),
      formatDate: (value) => formatDateBase(value, { locale, timeZone }),
      formatDateTime: (value) => formatDateTimeBase(value, { locale, timeZone }),
      formatCurrency: (value) => formatCurrencyBase(value, { locale, currency }),
    };
  }, [language, timeZone, currency, dictionary]);

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}

function resolveKey(dictionary: Dictionary, path: string): string {
  const parts = path.split(".");
  let current: unknown = dictionary;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return path;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : path;
}
