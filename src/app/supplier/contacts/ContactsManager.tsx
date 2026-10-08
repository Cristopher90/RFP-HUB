"use client";

import { useState, useTransition } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import {
  addSupplierContact,
  approveContact,
  rejectContact,
  removeSupplierContact,
  resendContactInvitation,
  saveContactClients,
  type ClientAssignment,
} from "../actions";

type LinkStatus = "PENDING_APPROVAL" | "SENT" | "ACCEPTED";

export type ContactRow = {
  id: string; // the person's account id
  name: string;
  email: string;
  isMe: boolean;
  links: { linkId: string; supplierDirectoryId: string; status: LinkStatus; isAdmin: boolean }[];
};

type Directory = { id: string; clientLabel: string; companyName: string; code: string };

const STATUS_STYLES: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
};

function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";
}

// Draft of "which clients is this person assigned to".
type Draft = Record<string, { assigned: boolean; isAdmin: boolean }>;

export function ContactsManager({
  directories,
  contacts,
}: {
  directories: Directory[];
  contacts: ContactRow[];
}) {
  const { t } = usePreferences();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  // Modal state: assigning clients to an existing contact, or adding a new one.
  const [assigning, setAssigning] = useState<ContactRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [newContact, setNewContact] = useState({ name: "", lastName: "", email: "" });

  const directoryById = new Map(directories.map((d) => [d.id, d]));
  const waiting = contacts.flatMap((c) =>
    c.links.filter((l) => l.status === "PENDING_APPROVAL").map((l) => ({ ...l, contact: c })),
  );

  function run(
    action: () => Promise<{ error: string } | { success: true }>,
    okText?: string,
    onSuccess?: () => void,
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setMessage({ kind: "error", text: result.error });
      else {
        if (okText) setMessage({ kind: "ok", text: okText });
        onSuccess?.();
      }
    });
  }

  function emptyDraft(): Draft {
    return Object.fromEntries(directories.map((d) => [d.id, { assigned: false, isAdmin: false }]));
  }

  function openAssign(contact: ContactRow) {
    const next = emptyDraft();
    for (const l of contact.links) next[l.supplierDirectoryId] = { assigned: true, isAdmin: l.isAdmin };
    setDraft(next);
    setAssigning(contact);
    setMessage(null);
  }

  function openAdd() {
    setDraft(emptyDraft());
    setNewContact({ name: "", lastName: "", email: "" });
    setAdding(true);
    setMessage(null);
  }

  function setDraftEntry(directoryId: string, patch: Partial<{ assigned: boolean; isAdmin: boolean }>) {
    setDraft((prev) => ({ ...prev, [directoryId]: { ...prev[directoryId], ...patch } }));
  }

  function clientPicker(contact: ContactRow | null) {
    return (
      <div className="space-y-1">
        {directories.map((d) => {
          const entry = draft[d.id] ?? { assigned: false, isAdmin: false };
          const link = contact?.links.find((l) => l.supplierDirectoryId === d.id);
          return (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2 hover:bg-violet-50"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={entry.assigned}
                  onChange={(e) => setDraftEntry(d.id, { assigned: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-slate-800">{d.clientLabel}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {d.companyName} · {d.code}
                  </span>
                </span>
              </label>
              {link && (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[link.status]}`}
                >
                  {t(`supplierContactsPage.status${link.status}`)}
                </span>
              )}
              {link?.status === "SENT" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => resendContactInvitation(link.linkId), t("supplierContactsPage.resent"))}
                  className="text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-60"
                >
                  {t("supplierContactsPage.resend")}
                </button>
              )}
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  disabled={!entry.assigned}
                  checked={entry.assigned && entry.isAdmin}
                  onChange={(e) => setDraftEntry(d.id, { isAdmin: e.target.checked })}
                />
                {t("supplierContactsPage.adminBadge")}
              </label>
            </div>
          );
        })}
      </div>
    );
  }

  function saveAssignment() {
    if (!assigning) return;
    const assignments: ClientAssignment[] = directories.map((d) => ({
      supplierDirectoryId: d.id,
      assigned: draft[d.id]?.assigned ?? false,
      isAdmin: draft[d.id]?.isAdmin ?? false,
    }));
    run(
      () => saveContactClients(assigning.id, assignments),
      t("supplierContactsPage.assignmentSaved"),
      () => setAssigning(null),
    );
  }

  function saveNew() {
    const chosen = directories.filter((d) => draft[d.id]?.assigned).map((d) => d.id);
    run(
      () =>
        addSupplierContact({
          ...newContact,
          isAdmin: chosen.some((id) => draft[id]?.isAdmin),
          supplierDirectoryIds: chosen,
        }),
      t("supplierContactsPage.added"),
      () => setAdding(false),
    );
  }

  const th = "px-4 py-2.5";
  const modalOpen = Boolean(assigning) || adding;

  return (
    <div className="mt-8 space-y-8">
      {message && !modalOpen && (
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
            {waiting.map((w) => (
              <li key={w.linkId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-slate-800">{w.contact.name}</span>{" "}
                  <span className="text-slate-500">{w.contact.email}</span>{" "}
                  <span className="text-xs text-slate-400">
                    · {directoryById.get(w.supplierDirectoryId)?.clientLabel}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => approveContact(w.linkId), t("supplierContactsPage.approved"))}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {t("supplierContactsPage.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => rejectContact(w.linkId))}
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
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("supplierContactsPage.contactsTitle")}</h2>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
          >
            {t("supplierContactsPage.addButton")}
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className={th}>{t("supplierContactsPage.colName")}</th>
                <th className={th}>{t("supplierContactsPage.colEmail")}</th>
                <th className={th}>{t("supplierContactsPage.colClients")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {c.name}
                    {c.links.some((l) => l.isAdmin) && (
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        {t("supplierContactsPage.adminBadge")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {c.links.map((l) => (
                        <span
                          key={l.linkId}
                          title={t(`supplierContactsPage.status${l.status}`)}
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[l.status]}`}
                        >
                          {directoryById.get(l.supplierDirectoryId)?.clientLabel}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {!c.isMe && (
                      <>
                        <button
                          type="button"
                          onClick={() => openAssign(c)}
                          className="mr-3 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                        >
                          {t("supplierContactsPage.assignClients")}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(t("supplierContactsPage.deleteConfirm"))) {
                              run(() => removeSupplierContact(c.id));
                            }
                          }}
                          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                        >
                          {t("supplierContactsPage.delete")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("supplierContactsPage.clientsTitle")}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className={th}>{t("supplierContactsPage.colClient")}</th>
                <th className={th}>{t("supplierContactsPage.colCompany")}</th>
                <th className={th}>{t("supplierContactsPage.supplierCode")}</th>
                <th className={th}>{t("supplierContactsPage.colContacts")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {directories.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{d.clientLabel}</td>
                  <td className="px-4 py-2.5 text-slate-600">{d.companyName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{d.code}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {
                      contacts.filter((c) =>
                        c.links.some((l) => l.supplierDirectoryId === d.id && l.status === "ACCEPTED"),
                      ).length
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-12"
          onClick={() => {
            setAssigning(null);
            setAdding(false);
          }}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-base font-semibold text-slate-900">
                {assigning
                  ? `${t("supplierContactsPage.assignClients")} · ${assigning.name}`
                  : t("supplierContactsPage.addTitle")}
              </h2>
              {adding && <p className="mt-1 text-xs text-slate-500">{t("supplierContactsPage.addHint")}</p>}
            </div>
            <div className="space-y-4 p-4">
              {message && (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    message.kind === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {message.text}
                </div>
              )}
              {adding && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    className={inputClass()}
                    placeholder={t("supplierContactsPage.firstName")}
                    value={newContact.name}
                    onChange={(e) => setNewContact((f) => ({ ...f, name: e.target.value }))}
                  />
                  <input
                    className={inputClass()}
                    placeholder={t("supplierContactsPage.lastName")}
                    value={newContact.lastName}
                    onChange={(e) => setNewContact((f) => ({ ...f, lastName: e.target.value }))}
                  />
                  <input
                    type="email"
                    className={`${inputClass()} sm:col-span-2`}
                    placeholder={t("supplierContactsPage.colEmail")}
                    value={newContact.email}
                    onChange={(e) => setNewContact((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("supplierContactsPage.clientsToAssign")}
                </p>
                {clientPicker(assigning)}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => {
                  setAssigning(null);
                  setAdding(false);
                }}
                className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t("supplierContactsPage.cancel")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={assigning ? saveAssignment : saveNew}
                className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {assigning ? t("supplierContactsPage.saveAssignment") : t("supplierContactsPage.addAndInvite")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
