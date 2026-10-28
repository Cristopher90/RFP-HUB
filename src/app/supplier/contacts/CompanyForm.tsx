"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { updateCompanyName, updateContactName } from "../companyActions";

export type CompanyEntry = { clientLabel: string; companyName: string };
export type CompanyContact = { id: string; name: string; lastName: string; email: string };

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// One row to rename a person; the same editor serves "my name" and the company's contacts.
function NameEditor({ person, label }: { person: CompanyContact; label?: string }) {
  const { t } = usePreferences();
  const [name, setName] = useState(person.name);
  const [lastName, setLastName] = useState(person.lastName);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = name.trim() !== person.name || lastName.trim() !== person.lastName;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateContactName(person.id, name, lastName);
      setMessage("error" in result ? { ok: false, text: result.error } : { ok: true, text: t("supplierCompany.saved") });
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">{label ?? person.email}</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("supplierCompany.firstName")} placeholder={t("supplierCompany.firstName")} />
        <input className={inputClass()} value={lastName} onChange={(e) => setLastName(e.target.value)} aria-label={t("supplierCompany.lastName")} placeholder={t("supplierCompany.lastName")} />
        <button
          type="button"
          disabled={pending || !changed || !name.trim()}
          onClick={save}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
      {message && <p className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
    </div>
  );
}

export function CompanyForm({
  me,
  isAdmin,
  entries,
  contacts,
}: {
  me: CompanyContact;
  isAdmin: boolean;
  entries: CompanyEntry[];
  contacts: CompanyContact[];
}) {
  const { t } = usePreferences();
  const names = [...new Set(entries.map((e) => e.companyName))];
  const [company, setCompany] = useState(names[0] ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function saveCompany() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCompanyName(company);
      setMessage("error" in result ? { ok: false, text: result.error } : { ok: true, text: t("supplierCompany.companySaved") });
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t("supplierCompany.myNameTitle")}</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">{t("supplierCompany.myNameHint")}</p>
        <NameEditor person={me} />
      </section>

      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t("supplierCompany.companyTitle")}</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">{t("supplierCompany.companyHint")}</p>
          <ul className="mb-4 space-y-1 text-sm">
            {entries.map((e, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5">
                <span className="text-slate-500">{e.clientLabel}</span>
                <span className="font-medium text-slate-800">{e.companyName}</span>
              </li>
            ))}
          </ul>
          {names.length > 1 && <p className="mb-3 text-xs text-amber-700">{t("supplierCompany.differentNames")}</p>}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input className={inputClass()} value={company} onChange={(e) => setCompany(e.target.value)} aria-label={t("supplierCompany.companyTitle")} maxLength={200} />
            <button
              type="button"
              disabled={pending || !company.trim() || (names.length === 1 && company.trim() === names[0])}
              onClick={saveCompany}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {pending ? t("common.saving") : names.length > 1 ? t("supplierCompany.unify") : t("common.save")}
            </button>
          </div>
          {message && <p className={`mt-2 text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}
        </section>
      )}

      {isAdmin && contacts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t("supplierCompany.contactsTitle")}</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">{t("supplierCompany.contactsHint")}</p>
          <div className="space-y-5">
            {contacts.map((c) => (
              <NameEditor key={c.id} person={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
