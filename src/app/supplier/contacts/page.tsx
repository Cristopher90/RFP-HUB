import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { acceptedLinks, requireSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { ContactsManager } from "./ContactsManager";

// Supplier administrators only: who from their company is connected to each
// client, new contacts waiting for their approval, and the clients assigned.
export default async function SupplierContactsPage() {
  const supplierUser = await requireSupplierUser();
  const dictionary = getDictionary(supplierUser.language);
  const mine = acceptedLinks(supplierUser);
  const administered = mine.filter((l) => l.isAdmin);
  if (administered.length === 0) redirect("/supplier");

  const links = await prisma.supplierUserLink.findMany({
    where: { supplierDirectoryId: { in: administered.map((l) => l.supplierDirectoryId) } },
    include: { supplierUser: true, supplierDirectory: true, client: true },
    orderBy: [{ invitedAt: "asc" }],
  });

  const label = (l: { client: { icon: string | null; description: string }; supplierDirectory: { companyName: string } }) =>
    `${l.client.icon ? `${l.client.icon} ` : ""}${l.client.description} · ${l.supplierDirectory.companyName}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.supplierContactsPage.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{dictionary.supplierContactsPage.subtitle}</p>
      <ContactsManager
        directories={administered.map((l) => ({ id: l.supplierDirectoryId, label: label(l) }))}
        assignedClients={mine.map((l) => ({
          id: l.id,
          label: label(l),
          code: l.supplierDirectory.code,
          isAdmin: l.isAdmin,
        }))}
        contacts={links.map((l) => ({
          id: l.id,
          directoryLabel: label(l),
          name: `${l.supplierUser.name} ${l.supplierUser.lastName}`.trim(),
          email: l.supplierUser.email,
          status: l.status,
          isAdmin: l.isAdmin,
          isMe: l.supplierUserId === supplierUser.id,
        }))}
      />
    </div>
  );
}
