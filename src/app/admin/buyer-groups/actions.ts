"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { BUYER_ROLES } from "@/lib/requestFields";

export type BuyerGroupInput = { id?: string; name: string; memberIds: string[] };

export async function saveBuyerGroups(
  groups: BuyerGroupInput[],
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const d = getDictionary(scope.user.language).requestsActions;
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") redirect("/");
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: d.selectClient };

  const cleaned = groups.map((g) => ({
    id: g.id,
    name: g.name.trim(),
    memberIds: [...new Set(g.memberIds)],
  }));
  const seen = new Set<string>();
  for (const g of cleaned) {
    if (!g.name) return { error: d.groupNameRequired };
    const key = g.name.toLowerCase();
    if (seen.has(key)) return { error: d.duplicateGroupName.replace("{name}", g.name) };
    seen.add(key);
  }

  // Only buyers of this client can be members, whatever the payload says.
  const buyers = await prisma.user.findMany({
    where: { clientId, role: { in: [...BUYER_ROLES] } },
    select: { id: true },
  });
  const buyerIds = new Set(buyers.map((b) => b.id));

  const existing = await prisma.buyerGroup.findMany({ where: { clientId }, select: { id: true } });
  const existingIds = new Set(existing.map((g) => g.id));
  const submittedIds = new Set(cleaned.filter((g) => g.id && existingIds.has(g.id)).map((g) => g.id!));

  // Rename first to avoid tripping the unique name constraint mid-update.
  await prisma.buyerGroup.deleteMany({
    where: { clientId, id: { in: [...existingIds].filter((id) => !submittedIds.has(id)) } },
  });
  for (const g of cleaned) {
    const memberIds = g.memberIds.filter((id) => buyerIds.has(id));
    if (g.id && existingIds.has(g.id)) {
      await prisma.buyerGroup.update({
        where: { id: g.id },
        data: {
          name: g.name,
          members: {
            deleteMany: {},
            create: memberIds.map((userId) => ({ userId })),
          },
        },
      });
    } else {
      await prisma.buyerGroup.create({
        data: { clientId, name: g.name, members: { create: memberIds.map((userId) => ({ userId })) } },
      });
    }
  }
  revalidatePath("/admin/buyer-groups");
  revalidatePath("/requests");
  return { success: true };
}
