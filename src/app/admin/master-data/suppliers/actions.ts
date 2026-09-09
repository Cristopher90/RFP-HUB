"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { hashPassword } from "@/lib/auth";

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

export async function saveSupplierDirectory(
  items: SupplierDirectoryItemInput[],
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { error: "No tenés permiso para editar el directorio de proveedores." };
  }
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) {
    return { error: "Selecciona el cliente cuyos proveedores vas a editar." };
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
      return { error: `El código de proveedor "${i.code}" está repetido.` };
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
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { error: "No tenés permiso para editar usuarios de proveedor." };
  }

  const directory = await prisma.supplierDirectory.findUnique({
    where: { id: supplierDirectoryId },
  });
  if (!directory) return { error: "Proveedor no encontrado." };
  if (!scope.isSuperAdmin && directory.clientId !== scope.user.clientId) {
    return { error: "No podés editar proveedores de otro cliente." };
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
      return { error: `El correo "${i.email}" está repetido.` };
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
          error: `Ingresa una contraseña para el nuevo usuario "${i.email}".`,
        };
      }
      const emailTaken = await prisma.supplierUser.findUnique({
        where: { email: i.email },
      });
      if (emailTaken) {
        return { error: `Ya existe un usuario de proveedor con el correo "${i.email}".` };
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
