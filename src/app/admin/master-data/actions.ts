"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { MasterDataKind } from "@/lib/masterDataSchema";

export type MasterDataItemInput = {
  clientKey: string;
  code: string;
  description: string;
  parentClientKey: string | null;
};

function pathFor(kind: MasterDataKind) {
  if (kind === "commodity") return "/admin/master-data/commodities";
  if (kind === "region") return "/admin/master-data/regions";
  if (kind === "approvalGroup") return "/admin/master-data/approval-groups";
  return "/admin/master-data/origins";
}

export async function saveMasterDataList(
  kind: MasterDataKind,
  items: MasterDataItemInput[],
): Promise<{ error: string } | { success: true }> {
  await requireRole("ADMIN");

  const cleaned = items
    .map((i) => ({
      clientKey: i.clientKey,
      code: i.code.trim(),
      description: i.description.trim(),
      parentClientKey: i.parentClientKey,
    }))
    .filter((i) => i.code.length > 0 && i.description.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    const key = i.code.toLowerCase();
    if (seen.has(key)) {
      return { error: `El ID "${i.code}" está repetido.` };
    }
    seen.add(key);
  }

  // Drop parent references to rows that got filtered out above.
  const validKeys = new Set(cleaned.map((i) => i.clientKey));
  for (const i of cleaned) {
    if (i.parentClientKey && !validKeys.has(i.parentClientKey)) {
      i.parentClientKey = null;
    }
  }

  const byKey = new Map(cleaned.map((i) => [i.clientKey, i]));
  for (const i of cleaned) {
    const visited = new Set<string>();
    let current: (typeof i) | undefined = i;
    while (current?.parentClientKey) {
      if (visited.has(current.clientKey)) {
        return { error: `La jerarquía de "${i.code}" tiene un ciclo.` };
      }
      visited.add(current.clientKey);
      current = byKey.get(current.parentClientKey);
    }
  }

  type TreeDelegate = {
    deleteMany(args: Record<string, never>): Promise<unknown>;
    create(args: {
      data: { code: string; description: string };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: { parentId: string };
    }): Promise<unknown>;
  };

  const model: TreeDelegate =
    kind === "commodity"
      ? prisma.commodity
      : kind === "region"
        ? prisma.region
        : kind === "approvalGroup"
          ? prisma.approvalGroup
          : prisma.origin;

  await model.deleteMany({});
  const idByKey = new Map<string, string>();
  for (const i of cleaned) {
    const row = await model.create({
      data: { code: i.code, description: i.description },
    });
    idByKey.set(i.clientKey, row.id);
  }
  for (const i of cleaned) {
    if (!i.parentClientKey) continue;
    const parentId = idByKey.get(i.parentClientKey);
    if (!parentId) continue;
    await model.update({
      where: { id: idByKey.get(i.clientKey)! },
      data: { parentId },
    });
  }

  revalidatePath(pathFor(kind));
  revalidatePath("/rfps/new");
  return { success: true };
}
