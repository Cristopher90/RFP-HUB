"use client";

import { useState, useTransition } from "react";
import {
  SupplierSearchPicker,
  type PickedContact,
  type SupplierDirectoryEntry,
} from "@/components/SupplierSearchPicker";
import { inviteSupplier } from "./actions";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function InviteSupplierForm({
  rfpId,
  supplierDirectory,
}: {
  rfpId: string;
  supplierDirectory: SupplierDirectoryEntry[];
}) {
  const { t } = usePreferences();
  const [selectedDir, setSelectedDir] = useState<SupplierDirectoryEntry | null>(
    null,
  );
  const [selectedContacts, setSelectedContacts] = useState<PickedContact[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dir = selectedDir;
    if (!dir || selectedContacts.length === 0) {
      setError(t("inviteSupplierForm.selectSupplierError"));
      return;
    }
    startTransition(async () => {
      for (const contact of selectedContacts) {
        const result = await inviteSupplier(rfpId, {
          name: contact.name,
          email: contact.email,
          company: dir.companyName,
          supplierDirectoryId: dir.id,
        });
        if (result?.error) {
          setError(result.error);
          return;
        }
      }
      setSelectedDir(null);
      setSelectedContacts([]);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="w-full sm:w-80">
        <SupplierSearchPicker
          suppliers={supplierDirectory}
          selectedLabel={
            selectedDir
              ? `${selectedDir.companyName} — ${selectedContacts.length} ${selectedContacts.length === 1 ? t("inviteSupplierForm.contact") : t("inviteSupplierForm.contacts")}`
              : null
          }
          onConfirm={(dir, contacts) => {
            setSelectedDir(dir);
            setSelectedContacts(contacts);
          }}
        />
      </div>
      <button
        type="submit"
        disabled={pending || supplierDirectory.length === 0}
        className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {pending ? t("inviteSupplierForm.inviting") : t("inviteSupplierForm.invite")}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {supplierDirectory.length === 0 && (
        <span className="text-xs text-amber-600">
          {t("inviteSupplierForm.noActiveSuppliers")}
        </span>
      )}
    </form>
  );
}
