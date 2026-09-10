"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { hashPassword } from "@/lib/auth";
import { getDictionary } from "@/i18n/getDictionary";

export type SupplierDirectoryStatus = "ACTIVE" | "INACTIVE";

export type SupplierDirectoryItemInput = {
  clientKey: string;
  code: string;
  taxId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone: string;
  status: SupplierDirectoryStatus;
};

// Guarda una única fila (crea o actualiza), en vez del reemplazo total de
// saveSupplierDirectory — así una fila recién agregada queda utilizable en
// "Usuarios de proveedor" de inmediato, sin tener que guardar y recargar
// toda la tabla primero (mismo espíritu que "Crear usuario").
export async function saveSupplierRow(
  item: SupplierDirectoryItemInput,
  targetClientId?: string,
): Promise<{ error: string } | { success: true; id: string }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { error: dictionary.suppliersActions.noPermissionSuppliers };
  }
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) {
    return { error: dictionary.suppliersActions.selectClientForSuppliers };
  }

  const code = item.code.trim();
  const companyName = item.companyName.trim();
  if (!code || !companyName) {
    return { error: dictionary.suppliersActions.codeAndCompanyRequired };
  }

  const existing = await prisma.supplierDirectory.findUnique({
    where: { id: item.clientKey },
  });
  const isUpdate = Boolean(existing && existing.clientId === clientId);

  const dupe = await prisma.supplierDirectory.findFirst({
    where: {
      clientId,
      code: { equals: code, mode: "insensitive" },
      ...(isUpdate ? { NOT: { id: item.clientKey } } : {}),
    },
  });
  if (dupe) {
    return { error: dictionary.suppliersActions.duplicateSupplierCode.replace("{code}", code) };
  }

  const data = {
    code,
    taxId: item.taxId.trim(),
    companyName,
    contactFirstName: item.contactFirstName.trim(),
    contactLastName: item.contactLastName.trim(),
    email: item.email.trim(),
    phone: item.phone.trim(),
    status: item.status,
  };

  const saved = isUpdate
    ? await prisma.supplierDirectory.update({
        where: { id: item.clientKey },
        data,
      })
    : await prisma.supplierDirectory.create({ data: { ...data, clientId } });

  revalidatePath("/admin/master-data/suppliers");
  return { success: true, id: saved.id };
}

export async function saveSupplierDirectory(
  items: SupplierDirectoryItemInput[],
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { error: dictionary.suppliersActions.noPermissionSuppliers };
  }
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) {
    return { error: dictionary.suppliersActions.selectClientForSuppliers };
  }

  const cleaned = items
    .map((i) => ({
      clientKey: i.clientKey,
      code: i.code.trim(),
      taxId: i.taxId.trim(),
      companyName: i.companyName.trim(),
      contactFirstName: i.contactFirstName.trim(),
      contactLastName: i.contactLastName.trim(),
      email: i.email.trim(),
      phone: i.phone.trim(),
      status: i.status,
    }))
    .filter((i) => i.code.length > 0 && i.companyName.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    const key = i.code.toLowerCase();
    if (seen.has(key)) {
      return { error: dictionary.suppliersActions.duplicateSupplierCode.replace("{code}", i.code) };
    }
    seen.add(key);
  }

  // Rows here can be referenced by SupplierUser logins and by past
  // Supplier/Invitation history (via supplierDirectoryId) — unlike the
  // flat/tree datos maestros, a wholesale delete+recreate would silently
  // wipe out portal logins and orphan that history on every save. Existing
  // rows (clientKey = their real id) are updated in place; new rows are
  // created; rows dropped from the list are deleted (cascading their
  // SupplierUser logins, which is the intended behavior for removing a
  // supplier outright).
  const existing = await prisma.supplierDirectory.findMany({
    where: { clientId },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const submittedIds = new Set(
    cleaned.filter((i) => existingIds.has(i.clientKey)).map((i) => i.clientKey),
  );

  for (const row of existing) {
    if (!submittedIds.has(row.id)) {
      await prisma.supplierDirectory.delete({ where: { id: row.id } });
    }
  }
  for (const i of cleaned) {
    const data = {
      code: i.code,
      taxId: i.taxId,
      companyName: i.companyName,
      contactFirstName: i.contactFirstName,
      contactLastName: i.contactLastName,
      email: i.email,
      phone: i.phone,
      status: i.status,
    };
    if (existingIds.has(i.clientKey)) {
      await prisma.supplierDirectory.update({
        where: { id: i.clientKey },
        data,
      });
    } else {
      await prisma.supplierDirectory.create({ data: { ...data, clientId } });
    }
  }

  revalidatePath("/admin/master-data/suppliers");
  return { success: true };
}

// Wholesale delete — gated to Super Administrador regardless of who can
// otherwise edit this directory. Cascades each row's SupplierUser portal
// logins and nulls Supplier.supplierDirectoryId on past invitations
// (same cascade behavior as removing one row at a time via saveSupplierDirectory).
export async function clearSupplierDirectory(
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (!scope.isSuperAdmin) {
    return { error: dictionary.suppliersActions.onlySuperAdminDeleteFullTable };
  }
  if (!targetClientId) {
    return { error: dictionary.suppliersActions.selectClientToClearSuppliers };
  }
  await prisma.supplierDirectory.deleteMany({ where: { clientId: targetClientId } });
  revalidatePath("/admin/master-data/suppliers");
  return { success: true };
}

export type SupplierUserItemInput = {
  clientKey: string;
  name: string;
  lastName: string;
  email: string;
  password: string; // blank on an existing row = keep current password
};

export async function saveSupplierUsers(
  supplierDirectoryId: string,
  items: SupplierUserItemInput[],
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { error: dictionary.suppliersActions.noPermissionSupplierUsers };
  }

  const directory = await prisma.supplierDirectory.findUnique({
    where: { id: supplierDirectoryId },
  });
  if (!directory) return { error: dictionary.suppliersActions.supplierNotFound };
  if (!scope.isSuperAdmin && directory.clientId !== scope.user.clientId) {
    return { error: dictionary.suppliersActions.cannotEditOtherClientSuppliers };
  }

  const cleaned = items
    .map((i) => ({
      clientKey: i.clientKey,
      name: i.name.trim(),
      lastName: i.lastName.trim(),
      email: i.email.trim().toLowerCase(),
      password: i.password,
    }))
    .filter((i) => i.name.length > 0 && i.email.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    if (seen.has(i.email)) {
      return { error: dictionary.suppliersActions.duplicateEmail.replace("{email}", i.email) };
    }
    seen.add(i.email);
  }

  const existing = await prisma.supplierUser.findMany({
    where: { supplierDirectoryId },
  });
  const existingIds = new Set(existing.map((u) => u.id));
  const submittedIds = new Set(
    cleaned.filter((i) => existingIds.has(i.clientKey)).map((i) => i.clientKey),
  );

  for (const row of existing) {
    if (!submittedIds.has(row.id)) {
      await prisma.supplierUser.delete({ where: { id: row.id } });
    }
  }
  for (const i of cleaned) {
    if (existingIds.has(i.clientKey)) {
      await prisma.supplierUser.update({
        where: { id: i.clientKey },
        data: {
          name: i.name,
          lastName: i.lastName,
          email: i.email,
          ...(i.password ? { passwordHash: hashPassword(i.password) } : {}),
        },
      });
    } else {
      if (!i.password) {
        return {
          error: dictionary.suppliersActions.passwordRequiredForNewUser.replace("{email}", i.email),
        };
      }
      const emailTaken = await prisma.supplierUser.findUnique({
        where: { email: i.email },
      });
      if (emailTaken) {
        return { error: dictionary.suppliersActions.emailAlreadyTaken.replace("{email}", i.email) };
      }
      await prisma.supplierUser.create({
        data: {
          clientId: directory.clientId,
          supplierDirectoryId,
          name: i.name,
          lastName: i.lastName,
          email: i.email,
          passwordHash: hashPassword(i.password),
        },
      });
    }
  }

  revalidatePath("/admin/master-data/suppliers");
  return { success: true };
}
