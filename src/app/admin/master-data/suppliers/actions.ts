"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";

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

  await prisma.supplierDirectory.deleteMany({ where: { clientId } });
  if (cleaned.length > 0) {
    await prisma.supplierDirectory.createMany({
      data: cleaned.map((i) => ({ ...i, clientId })),
    });
  }

  revalidatePath("/admin/master-data/suppliers");
  return { success: true };
}
