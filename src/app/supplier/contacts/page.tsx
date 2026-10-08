import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { acceptedLinks, requireSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { ContactsManager, type ContactRow } from "./ContactsManager";

// Supplier settings (administrators only): the company's contacts, which of
// its clients each one can take part in, and the clients assigned to it.
export default async function SupplierSettingsPage() {
  const supplierUser = await requireSupplierUser();
  const dictionary = getDictionary(supplierUser.language);
  const mine = acceptedLinks(supplierUser);
  const administered = mine.filter((l) => l.isAdmin);
  if (administered.length === 0) redirect("/supplier");

  const links = await prisma.supplierUserLink.findMany({
    where: { supplierDirectoryId: { in: administered.map((l) => l.supplierDirectoryId) } },
    include: { supplierUser: true },
    orderBy: [{ invitedAt: "asc" }],
  });

  const directories = administered.map((l) => ({
    id: l.supplierDirectoryId,
    clientLabel: `${l.client.icon ? `${l.client.icon} ` : ""}${l.client.description}`,
    companyName: l.supplierDirectory.companyName,
    code: l.supplierDirectory.code,
  }));

  // One row per person, with their connection to each of the clients above.
  const byPerson = new Map<string, ContactRow>();
  for (const l of links) {
    const row = byPerson.get(l.supplierUserId) ?? {
      id: l.supplierUserId,
      name: `${l.supplierUser.name} ${l.supplierUser.lastName}`.trim(),
      email: l.supplierUser.email,
      isMe: l.supplierUserId === supplierUser.id,
      links: [],
    };
    row.links.push({
      linkId: l.id,
      supplierDirectoryId: l.supplierDirectoryId,
      status: l.status,
      isAdmin: l.isAdmin,
    });
    byPerson.set(l.supplierUserId, row);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.supplierContactsPage.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{dictionary.supplierContactsPage.subtitle}</p>
      <ContactsManager directories={directories} contacts={[...byPerson.values()]} />
    </div>
  );
}
