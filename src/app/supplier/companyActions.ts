"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { acceptedLinks, requireSupplierUser } from "@/lib/supplierAuth";
import { COMPANY_MAX, NAME_MAX, renameCompany, renameContact } from "@/lib/supplierNames";

type Result = { error: string } | { success: true };

function refresh() {
  revalidatePath("/supplier", "layout");
  revalidatePath("/suppliers");
  revalidatePath("/", "layout");
}

// Anyone renames themselves; an administrator also renames the people of their company.
export async function updateContactName(supplierUserId: string, name: string, lastName: string): Promise<Result> {
  const me = await requireSupplierUser();
  const d = getDictionary(me.language).supplierCompany;
  const first = name.trim();
  const last = lastName.trim();
  if (!first) return { error: d.nameRequired };
  if (first.length > NAME_MAX || last.length > NAME_MAX) return { error: d.tooLong };

  if (supplierUserId !== me.id) {
    const administered = acceptedLinks(me).filter((l) => l.isAdmin).map((l) => l.supplierDirectoryId);
    const shared = await prisma.supplierUserLink.findFirst({
      where: { supplierUserId, supplierDirectoryId: { in: administered } },
      select: { id: true },
    });
    if (!shared) return { error: d.notAllowed };
  }
  await renameContact(supplierUserId, first, last, null);
  refresh();
  return { success: true };
}

// The company name is set once and applies to every client that has this supplier.
export async function updateCompanyName(companyName: string): Promise<Result> {
  const me = await requireSupplierUser();
  const d = getDictionary(me.language).supplierCompany;
  const name = companyName.trim();
  if (!name) return { error: d.companyRequired };
  if (name.length > COMPANY_MAX) return { error: d.tooLong };
  const ids = acceptedLinks(me).filter((l) => l.isAdmin).map((l) => l.supplierDirectoryId);
  if (ids.length === 0) return { error: d.notAllowed };
  await renameCompany(ids, name);
  refresh();
  return { success: true };
}
