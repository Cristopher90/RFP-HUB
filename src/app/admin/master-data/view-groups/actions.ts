"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { stripViewGroupId } from "@/lib/viewGroupsServer";

export type ViewGroupInput = { id?: string; name: string; description: string };

export async function saveViewGroups(
  rows: ViewGroupInput[],
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const d = getDictionary(scope.user.language).viewGroups;
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") return { error: d.noPermission };
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: d.selectClient };

  const cleaned = rows
    .map((r) => ({
      id: r.id,
      name: (r.name ?? "").trim().slice(0, 80),
      description: (r.description ?? "").trim().slice(0, 300) || null,
    }))
    .filter((r) => r.name);
  const seen = new Set<string>();
  for (const r of cleaned) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return { error: d.duplicateName.replace("{name}", r.name) };
    seen.add(key);
  }

  const existing = await prisma.viewGroup.findMany({ where: { clientId } });
  const keep = new Set(cleaned.map((r) => r.id).filter((id): id is string => Boolean(id)));
  for (const g of existing) {
    if (!keep.has(g.id)) {
      await prisma.viewGroup.delete({ where: { id: g.id } });
      await stripViewGroupId(clientId, g.id);
    }
  }
  const existingIds = new Set(existing.map((g) => g.id));
  // Renames first (avoids a transient name clash), then creations.
  for (const r of cleaned) {
    if (r.id && existingIds.has(r.id)) {
      await prisma.viewGroup.update({ where: { id: r.id }, data: { name: r.name, description: r.description } });
    }
  }
  for (const r of cleaned) {
    if (!r.id || !existingIds.has(r.id)) {
      await prisma.viewGroup.create({ data: { clientId, name: r.name, description: r.description } });
    }
  }
  revalidatePath("/admin/master-data/view-groups");
  return { success: true };
}
