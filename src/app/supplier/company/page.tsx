import { prisma } from "@/lib/prisma";
import { acceptedLinks, requireSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { CompanyForm, type CompanyContact, type CompanyEntry } from "./CompanyForm";

// "Mis datos": the supplier fixes how it appears to every buyer — the company
// name (administrators) and each contact's name — in one place.
export default async function SupplierCompanyPage() {
  const supplierUser = await requireSupplierUser();
  const d = getDictionary(supplierUser.language).supplierCompany;
  const mine = acceptedLinks(supplierUser);
  const administered = mine.filter((l) => l.isAdmin);

  const entries: CompanyEntry[] = administered.map((l) => ({
    clientLabel: `${l.client.icon ? `${l.client.icon} ` : ""}${l.client.description}`,
    companyName: l.supplierDirectory.companyName,
  }));

  const links =
    administered.length > 0
      ? await prisma.supplierUserLink.findMany({
          where: { supplierDirectoryId: { in: administered.map((l) => l.supplierDirectoryId) } },
          include: { supplierUser: true },
          orderBy: { invitedAt: "asc" },
        })
      : [];
  const people = new Map<string, CompanyContact>();
  for (const l of links) {
    if (l.supplierUserId === supplierUser.id || people.has(l.supplierUserId)) continue;
    people.set(l.supplierUserId, { id: l.supplierUserId, name: l.supplierUser.name, lastName: l.supplierUser.lastName, email: l.supplierUser.email });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      <CompanyForm
        me={{ id: supplierUser.id, name: supplierUser.name, lastName: supplierUser.lastName, email: supplierUser.email }}
        isAdmin={administered.length > 0}
        entries={entries}
        contacts={[...people.values()]}
      />
    </div>
  );
}
