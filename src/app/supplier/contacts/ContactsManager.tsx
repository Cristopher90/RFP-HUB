"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  addSupplierContact,
  approveContact,
  rejectContact,
  removeSupplierContact,
  resendContactInvitation,
} from "../actions";

type Contact = {
  id: string;
  directoryLabel: string;
  name: string;
  email: string;
  status: "PENDING_APPROVAL" | "SENT" | "ACCEPTED";
  isAdmin: boolean;
  isMe: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

export function ContactsManager({
  directories,
  assignedClients,
  contacts,
}: {
  directories: { id: string; label: string }[];
  assignedClients: { id: string; label: string; code: string; isAdmin: boolean }[];
  contacts: Contact[];
}) {
  const { t } = usePreferences();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [form, setForm] = useState({
    supplierDirectoryId: directories[0]?.id ?? "",
    name: "",
    lastName: "",
    email: "",
    isAdmin: false,
  });

  function run(action: () => Promise<{ error: string } | { success: true }>, okText?: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setMessage({ kind: "error", text: result.error });
      else if (okText) setMessage({ kind: "ok", text: okText });
    });
  }

  const waiting = contacts.filter((c) => c.status === "PENDING_APPROVAL");
  const th = "px-4 py-2.5";

  return (
    <div className="mt-8 space-y-8">
      {message && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            message.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {waiting.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800">{t("supplierContactsPage.waitingTitle")}</h2>
          <p className="mt-1 text-xs text-amber-700">{t("supplierContactsPage.waitingHint")}</p>
          <ul className="mt-3 divide-y divide-amber-200">
            {waiting.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-slate-800">{c.name}</span>{" "}
                  <span className="text-slate-500">{c.email}</span>{" "}
                  <span className="text-xs text-slate-400">· {c.directoryLabel}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => approveContact(c.id), t("supplierContactsPage.approved"))}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {t("supplierContactsPage.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => rejectContact(c.id))}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    {t("supplierContactsPage.reject")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("supplierContactsPage.contactsTitle")}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className={th}>{t("supplierContactsPage.colName")}</th>
                <th className={th}>{t("supplierContactsPage.colEmail")}</th>
                <th className={th}>{t("supplierContactsPage.colClient")}</th>
                <th className={th}>{t("supplierContactsPage.colStatus")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {c.name}
                    {c.isAdmin && (
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        {t("supplierContactsPage.adminBadge")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.directoryLabel}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                      {t(`supplierContactsPage.status${c.status}`)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {c.status === "SENT" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => resendContactInvitation(c.id), t("supplierContactsPage.resent"))}
                        className="mr-3 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-60"
                      >
                        {t("supplierContactsPage.resend")}
                      </button>
                    )}
                    {!c.isMe && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(t("supplierContactsPage.deleteConfirm"))) run(() => removeSupplierContact(c.id));
                        }}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        {t("supplierContactsPage.delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">{t("supplierContactsPage.addTitle")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("supplierContactsPage.addHint")}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            className={inputClass()}
            value={form.supplierDirectoryId}
            onChange={(e) => setForm((f) => ({ ...f, supplierDirectoryId: e.target.value }))}
          >
            {directories.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            type="email"
            className={inputClass()}
            placeholder={t("supplierContactsPage.colEmail")}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className={inputClass()}
            placeholder={t("supplierContactsPage.firstName")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className={inputClass()}
            placeholder={t("supplierContactsPage.lastName")}
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.isAdmin}
            onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))}
          />
          {t("supplierContactsPage.makeAdmin")}
        </label>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await addSupplierContact(form);
                if ("success" in result) {
                  setForm((f) => ({ ...f, name: "", lastName: "", email: "", isAdmin: false }));
                }
                return result;
              }, t("supplierContactsPage.added"))
            }
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
          >
            {t("supplierContactsPage.addButton")}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("supplierContactsPage.clientsTitle")}</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
          {assignedClients.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-800">{c.label}</span>
              <span className="text-xs text-slate-500">
                {t("supplierContactsPage.supplierCode")}: {c.code}
                {c.isAdmin && ` · ${t("supplierContactsPage.adminBadge")}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
