"use client";

import { useState, useTransition } from "react";
import { COLOR_MODES, COLOR_MODE_SWATCH, DARK_COLOR_MODES, PALETTE_MODES, THEMES, UI_STYLES, isDarkUiStyle } from "@/lib/themes";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { updateOwnProfile, type ProfileFormInput } from "./actions";

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export function ProfileForm({
  initial,
  timezones,
  currencies,
  canChooseUiStyle = false,
}: {
  canChooseUiStyle?: boolean;
  initial: ProfileFormInput;
  timezones: string[];
  currencies: string[];
}) {
  const { t } = usePreferences();
  const [form, setForm] = useState<ProfileFormInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // Previews the chosen appearance straight away; it only persists on save.
  function previewAppearance(theme: string, colorMode: string, uiStyle: string) {
    const root = document.documentElement;
    const dark =
      DARK_COLOR_MODES.includes(colorMode) ||
      isDarkUiStyle(uiStyle) ||
      (colorMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-color-mode", colorMode);
    root.setAttribute("data-mode", dark ? "dark" : "light");
    if (PALETTE_MODES.includes(colorMode)) root.setAttribute("data-palette", colorMode);
    else root.removeAttribute("data-palette");
  }

  function update(patch: Partial<ProfileFormInput>) {
    const next = { ...form, ...patch };
    setForm(next);
    setSaved(false);
    if (patch.uiStyle !== undefined) {
      document.documentElement.setAttribute("data-ui", patch.uiStyle);
    }
    if (patch.theme !== undefined || patch.colorMode !== undefined || patch.uiStyle !== undefined) {
      previewAppearance(next.theme, next.colorMode, next.uiStyle ?? "standard");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOwnProfile(form);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {t("profile.saved")}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">{t("profile.appearance")}</h2>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">{t("profile.theme")}</p>
            <div className="flex flex-wrap gap-3">
              {THEMES.map((theme) => (
                <label
                  key={theme.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    form.theme === theme.value
                      ? "border-violet-500 ring-1 ring-violet-500"
                      : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    className="sr-only"
                    checked={form.theme === theme.value}
                    onChange={() => update({ theme: theme.value })}
                  />
                  <span
                    className="inline-block h-4 w-4 rounded-full"
                    style={{ backgroundColor: theme.swatch }}
                  />
                  {t(`profile.theme_${theme.value}`)}
                </label>
              ))}
            </div>
          </div>
          {canChooseUiStyle && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{t("profile.uiStyle")}</p>
              <div className="flex flex-wrap gap-3">
                {UI_STYLES.map((style) => (
                  <label
                    key={style}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                      (form.uiStyle ?? "standard") === style
                        ? "border-violet-500 ring-1 ring-violet-500"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="uiStyle"
                      className="sr-only"
                      checked={(form.uiStyle ?? "standard") === style}
                      onChange={() => update({ uiStyle: style })}
                    />
                    {t(`profile.uiStyle_${style}`)}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">{t("profile.uiStyleHint")}</p>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">{t("profile.colorMode")}</p>
            <div className="flex flex-wrap gap-3">
              {COLOR_MODES.map((mode) => (
                <label
                  key={mode}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    form.colorMode === mode
                      ? "border-violet-500 ring-1 ring-violet-500"
                      : "border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="colorMode"
                    className="sr-only"
                    checked={form.colorMode === mode}
                    onChange={() => update({ colorMode: mode })}
                  />
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-3.5 w-3.5 rounded-full align-[-2px] ring-1 ring-slate-300"
                    style={{
                      background: `linear-gradient(135deg, ${COLOR_MODE_SWATCH[mode][0]} 50%, ${COLOR_MODE_SWATCH[mode][1]} 50%)`,
                    }}
                  />
                  {t(`profile.mode_${mode}`)}
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("profile.language")}
            </label>
            <select
              className={inputClass()}
              value={form.language}
              onChange={(e) => update({ language: e.target.value })}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("profile.timezone")}
            </label>
            <select
              className={inputClass()}
              value={form.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("profile.currency")}
            </label>
            <select
              className={inputClass()}
              value={form.currency}
              onChange={(e) => update({ currency: e.target.value })}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("profile.save")}
        </button>
      </div>
    </form>
  );
}
