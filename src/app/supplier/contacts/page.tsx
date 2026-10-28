import { prisma } from "@/lib/prisma";
import { acceptedLinks, requireSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { ContactsManager, type ContactRow } from "./ContactsManager";
import { CompanyForm, type CompanyContact, type CompanyEntry } from "./CompanyForm";

// Supplier settings. Everyone: their own name. Administrators also: the company
// name (one for all clients), the names of their colleagues, the company's
// contacts and which of its clients each one can take part in.
export default async function SupplierSettingsPage() {
  const supplierUser = await requireSupplierUser();
  const dictionary = getDictionary(supplierUser.language);
  const mine = acceptedLinks(supplierUser);
  const administered = mine.filter((l) => l.isAdmin);
  const isAdmin = administered.length > 0;

  const links = isAdmin
    ? await prisma.supplierUserLink.findMany({
        where: { supplierDirectoryId: { in: administered.map((l) => l.supplierDirectoryId) } },
        include: { supplierUser: true },
        orderBy: [{ invitedAt: "asc" }],
      })
    : [];

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

  // The details block: the person themselves, the company name per client and the colleagues' names.
  const entries: CompanyEntry[] = administered.map((l) => ({
    clientLabel: `${l.client.icon ? `${l.client.icon} ` : ""}${l.client.description}`,
    companyName: l.supplierDirectory.companyName,
  }));
  const colleagues: CompanyContact[] = [...byPerson.values()]
    .filter((c) => !c.isMe)
    .map((c) => {
      const person = links.find((l) => l.supplierUserId === c.id)!.supplierUser;
      return { id: person.id, name: person.name, lastName: person.lastName, email: person.email };
    });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.supplierContactsPage.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isAdmin ? dictionary.supplierContactsPage.subtitle : dictionary.supplierCompany.subtitle}
      </p>
      <CompanyForm
        me={{ id: supplierUser.id, name: supplierUser.name, lastName: supplierUser.lastName, email: supplierUser.email }}
        isAdmin={isAdmin}
        entries={entries}
        contacts={colleagues}
      />
      {isAdmin && <ContactsManager directories={directories} contacts={[...byPerson.values()]} />}
    </div>
  );
}
