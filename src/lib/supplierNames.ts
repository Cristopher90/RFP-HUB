import "server-only";
import { prisma } from "@/lib/prisma";
import { logSupplierEvent } from "@/lib/supplierEvents";

// One name for everyone: when a supplier fixes its company name or a contact's
// name from the supplier side, every buyer sees the new one — in the directory
// entry of each client and in the copies kept on RFP invitations.

export const NAME_MAX = 120;
export const COMPANY_MAX = 200;

export function fullName(name: string, lastName: string) {
  return `${name} ${lastName}`.trim();
}

// Renames a person: their account, the contact of every directory entry that
// uses their e-mail, and the supplier rows shown on the RFPs of those clients.
export async function renameContact(supplierUserId: string, name: string, lastName: string, actorUserId: string | null) {
  const user = await prisma.supplierUser.update({
    where: { id: supplierUserId },
    data: { name, lastName },
    include: { links: { select: { supplierDirectoryId: true } } },
  });
  const directoryIds = user.links.map((l) => l.supplierDirectoryId);
  if (directoryIds.length === 0) return;
  const email = { equals: user.email, mode: "insensitive" as const };
  const directories = await prisma.supplierDirectory.findMany({
    where: { id: { in: directoryIds }, email },
    select: { id: true, contactFirstName: true, contactLastName: true },
  });
  for (const d of directories) {
    await prisma.supplierDirectory.update({ where: { id: d.id }, data: { contactFirstName: name, contactLastName: lastName } });
    await logSupplierEvent(d.id, null, "EDITED", {
      source: "supplier",
      field: "contactName",
      from: fullName(d.contactFirstName, d.contactLastName),
      to: fullName(name, lastName),
    });
  }
  await prisma.supplier.updateMany({
    where: { supplierDirectoryId: { in: directoryIds }, email },
    data: { name: fullName(name, lastName) },
  });
  void actorUserId;
}

// Sets the same company name on every directory entry the person administers.
export async function renameCompany(directoryIds: string[], companyName: string) {
  if (directoryIds.length === 0) return;
  const before = await prisma.supplierDirectory.findMany({ where: { id: { in: directoryIds } }, select: { id: true, companyName: true } });
  await prisma.supplierDirectory.updateMany({ where: { id: { in: directoryIds } }, data: { companyName } });
  await prisma.supplier.updateMany({ where: { supplierDirectoryId: { in: directoryIds } }, data: { company: companyName } });
  for (const d of before) {
    if (d.companyName !== companyName) {
      await logSupplierEvent(d.id, null, "EDITED", { source: "supplier", field: "companyName", from: d.companyName, to: companyName });
    }
  }
}
