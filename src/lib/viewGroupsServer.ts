import "server-only";
import { prisma } from "@/lib/prisma";

export async function loadViewGroups(clientId: string) {
  return prisma.viewGroup.findMany({ where: { clientId }, orderBy: { name: "asc" } });
}

// Removes a deleted group's id from every list that references it.
export async function stripViewGroupId(clientId: string, groupId: string) {
  const tables = ["User", "SupplierDirectory", "Commodity", "Region", "RfpTemplate"];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "viewGroupIds" = array_remove("viewGroupIds", $1) WHERE "clientId" = $2 AND $1 = ANY("viewGroupIds")`,
      groupId,
      clientId,
    );
  }
}

// Only group ids that exist for this client (a forged payload can't point elsewhere).
export async function validViewGroupIds(clientId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids)) return [];
  const wanted = [...new Set(ids.filter((x): x is string => typeof x === "string"))];
  if (wanted.length === 0) return [];
  const found = await prisma.viewGroup.findMany({
    where: { clientId, id: { in: wanted } },
    select: { id: true },
  });
  return found.map((g) => g.id);
}
