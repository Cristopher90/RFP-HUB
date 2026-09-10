// Maps a user's "language" preference (es/en) to the Intl locale used for
// number/date formatting conventions (grouping separators, month names).
const LOCALE_BY_LANGUAGE: Record<string, string> = {
  es: "es-MX",
  en: "en-US",
};

export function localeForLanguage(language: string): string {
  return LOCALE_BY_LANGUAGE[language] ?? "es-MX";
}
