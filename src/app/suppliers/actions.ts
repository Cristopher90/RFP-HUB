"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { canBlockSuppliers, canRateSuppliers } from "@/lib/supplierAccess";
import { canSeeByGroups } from "@/lib/viewGroups";

type Result = { error: string } | { success: true };

// Loads a supplier the current user may act on: same client (a Super
// Administrador may act on any) and visible through their view groups.
async function loadSupplier(directoryId: string) {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).suppliersScreen;
  const supplier = await prisma.supplierDirectory.findUnique({ where: { id: directoryId } });
  if (
    !supplier ||
    (!scope.isSuperAdmin && supplier.clientId !== user.clientId) ||
    !canSeeByGroups(user, supplier.viewGroupIds)
  ) {
    return { user, d, supplier: null } as const;
  }
  return { user, d, supplier } as const;
}

export async function rateSupplier(
  directoryId: string,
  stars: number,
  comment: string,
): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canRateSuppliers(user)) return { error: d.noPermissionRate };
  if (!supplier) return { error: d.notFound };
  const rounded = Math.round(Number(stars));
  if (!Number.isFinite(rounded) || rounded < 1 || rounded > 5) return { error: d.invalidStars };
  const text = (comment ?? "").trim().slice(0, 1000) || null;
  await prisma.supplierRating.upsert({
    where: { supplierDirectoryId_userId: { supplierDirectoryId: supplier.id, userId: user.id } },
    create: {
      clientId: supplier.clientId,
      supplierDirectoryId: supplier.id,
      userId: user.id,
      stars: rounded,
      comment: text,
    },
    update: { stars: rounded, comment: text },
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export async function removeMyRating(directoryId: string): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canRateSuppliers(user)) return { error: d.noPermissionRate };
  if (!supplier) return { error: d.notFound };
  await prisma.supplierRating.deleteMany({
    where: { supplierDirectoryId: supplier.id, userId: user.id },
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export async function setSupplierBlocked(directoryId: string, blocked: boolean): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canBlockSuppliers(user)) return { error: d.noPermissionBlock };
  if (!supplier) return { error: d.notFound };
  await prisma.supplierDirectory.update({
    where: { id: supplier.id },
    data: { blocked, blockedAt: blocked ? new Date() : null },
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export async function setContactBlocked(linkId: string, blocked: boolean): Promise<Result> {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).suppliersScreen;
  if (!canBlockSuppliers(user)) return { error: d.noPermissionBlock };
  const link = await prisma.supplierUserLink.findUnique({
    where: { id: linkId },
    include: { supplierDirectory: true },
  });
  if (
    !link ||
    (!scope.isSuperAdmin && link.clientId !== user.clientId) ||
    !canSeeByGroups(user, link.supplierDirectory.viewGroupIds)
  ) {
    return { error: d.contactNotFound };
  }
  await prisma.supplierUserLink.update({ where: { id: link.id }, data: { blocked } });
  revalidatePath("/suppliers");
  return { success: true };
}
