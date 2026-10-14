"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { validViewGroupIds } from "@/lib/viewGroupsServer";

export type DocumentTypeInput = {
  id?: string;
  name: string;
  hasDates: boolean;
  viewGroupIds: string[];
  active: boolean;
};

export async function saveDocumentTypes(
  rows: DocumentTypeInput[],
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const d = getDictionary(scope.user.language).supplierDocs;
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") return { error: d.noPermission };
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: d.selectClient };

  const cleaned = rows
    .map((r) => ({
      id: r.id,
      name: (r.name ?? "").trim().slice(0, 80),
      hasDates: Boolean(r.hasDates),
      active: r.active !== false,
      viewGroupIds: r.viewGroupIds ?? [],
    }))
    .filter((r) => r.name);
  const seen = new Set<string>();
  for (const r of cleaned) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return { error: d.duplicateType.replace("{name}", r.name) };
    seen.add(key);
  }

  const existing = await prisma.supplierDocumentType.findMany({
    where: { clientId },
    include: { _count: { select: { documents: true } } },
  });
  const keep = new Set(cleaned.map((r) => r.id).filter((id): id is string => Boolean(id)));
  for (const t of existing) {
    if (keep.has(t.id)) continue;
    if (t._count.documents > 0) {
      return { error: d.typeInUse.replace("{name}", t.name).replace("{count}", String(t._count.documents)) };
    }
  }
  for (const t of existing) if (!keep.has(t.id)) await prisma.supplierDocumentType.delete({ where: { id: t.id } });

  const existingIds = new Set(existing.map((t) => t.id));
  const knownGroups = new Set(await validViewGroupIds(clientId, cleaned.flatMap((r) => r.viewGroupIds)));
  for (const r of cleaned) {
    const data = {
      name: r.name,
      hasDates: r.hasDates,
      active: r.active,
      viewGroupIds: r.viewGroupIds.filter((g) => knownGroups.has(g)),
    };
    if (r.id && existingIds.has(r.id)) await prisma.supplierDocumentType.update({ where: { id: r.id }, data });
  }
  for (const r of cleaned) {
    if (r.id && existingIds.has(r.id)) continue;
    await prisma.supplierDocumentType.create({
      data: {
        clientId,
        name: r.name,
        hasDates: r.hasDates,
        active: r.active,
        viewGroupIds: r.viewGroupIds.filter((g) => knownGroups.has(g)),
      },
    });
  }
  revalidatePath("/admin/master-data/document-types");
  revalidatePath("/suppliers");
  return { success: true };
}
