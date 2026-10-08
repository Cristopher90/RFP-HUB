"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  EMAIL_LANGUAGES,
  KIND_PLACEHOLDERS,
  type EmailKind,
} from "@/lib/emailKinds";
import { resetEmailTemplate, saveEmailTemplate } from "./actions";

type Fields = { subject: string; heading: string; body: string; cta: string };

export type TemplateCard = {
  kind: EmailKind;
  language: string;
  defaults: Fields;
  current: Fields;
  customized: boolean;
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

function Card({
  card,
  targetClientId,
  open,
  onToggle,
}: {
  card: TemplateCard;
  targetClientId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = usePreferences();
  const [fields, setFields] = useState<Fields>(card.current);
  const [customized, setCustomized] = useState(card.customized);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function update(patch: Partial<Fields>) {
    setFields((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEmailTemplate(
        { kind: card.kind, language: card.language, ...fields },
        targetClientId,
      );
      if ("error" in result) setError(result.error);
      else {
        setSaved(true);
        setCustomized(true);
      }
    });
  }

  function handleReset() {
    if (!confirm(t("emailTemplatesForm.resetConfirm"))) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await resetEmailTemplate(card.kind, card.language, targetClientId);
      if ("error" in result) setError(result.error);
      else {
        setFields(card.defaults);
        setCustomized(false);
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
      >
        <span className="flex items-start gap-2">
          <span
            className={`mt-1 shrink-0 text-xs text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-900">
              {t(`emailKindLabels.${card.kind}`)}
            </span>
            <span className="block text-xs text-slate-500">
              {t("emailTemplatesForm.recipient")} {t(`emailKindRecipients.${card.kind}`)}
            </span>
          </span>
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            customized ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {customized ? t("emailTemplatesForm.customized") : t("emailTemplatesForm.original")}
        </span>
      </button>

      {open && (
        <div>
      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("emailTemplatesForm.subject")}
          </label>
          <input
            className={inputClass()}
            value={fields.subject}
            onChange={(e) => update({ subject: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("emailTemplatesForm.heading")}
          </label>
          <input
            className={inputClass()}
            value={fields.heading}
            onChange={(e) => update({ heading: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("emailTemplatesForm.body")}
          </label>
          <textarea
            className={inputClass()}
            rows={5}
            value={fields.body}
            onChange={(e) => update({ body: e.target.value })}
          />
          <p className="mt-1 text-xs text-slate-400">{t("emailTemplatesForm.bodyHint")}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {t("emailTemplatesForm.cta")}
          </label>
          <input
            className={inputClass()}
            value={fields.cta}
            onChange={(e) => update({ cta: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span>{t("emailTemplatesForm.placeholders")}</span>
        {KIND_PLACEHOLDERS[card.kind].map((p) => (
          <code
            key={p}
            title={t(`emailPlaceholders.${p}`)}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700"
          >
            {`{${p}}`}
          </code>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={pending || !customized}
          onClick={handleReset}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-40"
        >
          {t("emailTemplatesForm.reset")}
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-700">{t("emailTemplatesForm.saved")}</span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? t("emailTemplatesForm.saving") : t("emailTemplatesForm.save")}
          </button>
        </div>
      </div>
        </div>
      )}
    </section>
  );
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function EmailTemplatesForm({
  cards,
  targetClientId,
}: {
  cards: TemplateCard[];
  targetClientId: string;
}) {
  const { t } = usePreferences();
  const [language, setLanguage] = useState<string>(EMAIL_LANGUAGES[0]);
  const [query, setQuery] = useState("");
  // Every message starts collapsed (just its title); open ones are tracked by kind.
  const [openKinds, setOpenKinds] = useState<Set<string>>(new Set());

  const q = normalize(query.trim());
  const visible = cards.filter(
    (c) =>
      c.language === language &&
      (!q ||
        normalize(t(`emailKindLabels.${c.kind}`)).includes(q) ||
        normalize(t(`emailKindRecipients.${c.kind}`)).includes(q)),
  );
  const allOpen = visible.length > 0 && visible.every((c) => openKinds.has(c.kind));

  function toggle(kind: string) {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function toggleAll() {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      for (const c of visible) {
        if (allOpen) next.delete(c.kind);
        else next.add(c.kind);
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">
            {t("emailTemplatesForm.languageLabel")}
          </span>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {EMAIL_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-4 py-1.5 text-sm font-medium ${
                  language === lang
                    ? "bg-violet-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {lang === "es" ? t("emailTemplatesForm.spanish") : t("emailTemplatesForm.english")}
              </button>
            ))}
          </div>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("emailTemplatesForm.search")}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-72"
        />
        {visible.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {allOpen ? t("emailTemplatesForm.collapseAll") : t("emailTemplatesForm.expandAll")}
          </button>
        )}
      </div>
      {visible.length === 0 && (
        <p className="text-sm text-slate-500">{t("emailTemplatesForm.noMatch")}</p>
      )}
      {visible.map((card) => (
        <Card
          key={`${card.kind}:${card.language}`}
          card={card}
          targetClientId={targetClientId}
          open={openKinds.has(card.kind)}
          onToggle={() => toggle(card.kind)}
        />
      ))}
    </div>
  );
}
