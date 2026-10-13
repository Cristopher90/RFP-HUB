"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { validViewGroupIds } from "@/lib/viewGroupsServer";

export type LookupValueInput = {
  clientKey: string;
  code: string;
  description: string;
  descriptionEn: string;
  parentClientKey: string | null;
  viewGroupIds: string[];
};

type Result = { error: string } | { success: true };

async function gate(targetClientId?: string) {
  const scope = await requireClientScope();
  const d = getDictionary(scope.user.language).lookups;
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { ok: false, error: d.noPermission } as const;
  }
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { ok: false, error: d.selectClient } as const;
  return { ok: true, clientId, d } as const;
}

export async function createLookup(
  name: string,
  targetClientId?: string,
): Promise<{ error: string } | { success: true; id: string }> {
  const g = await gate(targetClientId);
  if (!g.ok) return { error: g.error };
  const clean = (name ?? "").trim().slice(0, 80);
  if (!clean) return { error: g.d.nameRequired };
  const dupe = await prisma.lookup.findUnique({
    where: { clientId_name: { clientId: g.clientId, name: clean } },
  });
  if (dupe) return { error: g.d.duplicateName.replace("{name}", clean) };
  const created = await prisma.lookup.create({ data: { clientId: g.clientId, name: clean } });
  revalidatePath("/admin/master-data/lookups");
  return { success: true, id: created.id };
}

export async function renameLookup(id: string, name: string, targetClientId?: string): Promise<Result> {
  const g = await gate(targetClientId);
  if (!g.ok) return { error: g.error };
  const clean = (name ?? "").trim().slice(0, 80);
  if (!clean) return { error: g.d.nameRequired };
  const lookup = await prisma.lookup.findFirst({ where: { id, clientId: g.clientId } });
  if (!lookup) return { error: g.d.notFound };
  const dupe = await prisma.lookup.findFirst({
    where: { clientId: g.clientId, name: clean, NOT: { id } },
  });
  if (dupe) return { error: g.d.duplicateName.replace("{name}", clean) };
  await prisma.lookup.update({ where: { id }, data: { name: clean } });
  revalidatePath("/admin/master-data/lookups");
  return { success: true };
}

export async function deleteLookup(id: string, targetClientId?: string): Promise<Result> {
  const g = await gate(targetClientId);
  if (!g.ok) return { error: g.error };
  const lookup = await prisma.lookup.findFirst({
    where: { id, clientId: g.clientId },
    include: { fields: { select: { key: true } } },
  });
  if (!lookup) return { error: g.d.notFound };
  if (lookup.fields.length > 0) {
    return {
      error: g.d.inUse.replace("{name}", lookup.name).replace("{fields}", lookup.fields.map((f) => f.key).join(", ")),
    };
  }
  await prisma.lookup.delete({ where: { id } });
  revalidatePath("/admin/master-data/lookups");
  return { success: true };
}

// Replaces every value of a lookup with the submitted rows (the stored custom
// field values hold the code, so recreating the rows loses nothing).
export async function saveLookupValues(
  lookupId: string,
  rows: LookupValueInput[],
  targetClientId?: string,
): Promise<Result> {
  const g = await gate(targetClientId);
  if (!g.ok) return { error: g.error };
  const lookup = await prisma.lookup.findFirst({ where: { id: lookupId, clientId: g.clientId } });
  if (!lookup) return { error: g.d.notFound };

  const cleaned = rows
    .map((r) => ({
      clientKey: r.clientKey,
      code: (r.code ?? "").trim().slice(0, 80),
      description: (r.description ?? "").trim().slice(0, 200),
      descriptionEn: (r.descriptionEn ?? "").trim().slice(0, 200),
      parentClientKey: r.parentClientKey,
      viewGroupIds: r.viewGroupIds ?? [],
    }))
    .filter((r) => r.code.length > 0);

  const seen = new Set<string>();
  for (const r of cleaned) {
    if (seen.has(r.code.toLowerCase())) return { error: g.d.duplicateCode.replace("{code}", r.code) };
    seen.add(r.code.toLowerCase());
  }
  const byKey = new Map(cleaned.map((r) => [r.clientKey, r]));
  for (const r of cleaned) {
    if (r.parentClientKey && !byKey.has(r.parentClientKey)) r.parentClientKey = null;
  }
  for (const r of cleaned) {
    const visited = new Set<string>();
    let cur: (typeof r) | undefined = r;
    while (cur?.parentClientKey) {
      if (visited.has(cur.clientKey)) return { error: g.d.cycle.replace("{code}", r.code) };
      visited.add(cur.clientKey);
      cur = byKey.get(cur.parentClientKey);
    }
  }

  const knownGroups = new Set(await validViewGroupIds(g.clientId, cleaned.flatMap((r) => r.viewGroupIds)));
  await prisma.lookupValue.deleteMany({ where: { lookupId } });
  const idByKey = new Map<string, string>();
  for (const [order, r] of cleaned.entries()) {
    const created = await prisma.lookupValue.create({
      data: {
        lookupId,
        code: r.code,
        description: r.description || r.code,
        descriptionEn: r.descriptionEn || null,
        viewGroupIds: r.viewGroupIds.filter((id) => knownGroups.has(id)),
        order,
      },
    });
    idByKey.set(r.clientKey, created.id);
  }
  for (const r of cleaned) {
    if (!r.parentClientKey) continue;
    const parentId = idByKey.get(r.parentClientKey);
    if (parentId) await prisma.lookupValue.update({ where: { id: idByKey.get(r.clientKey)! }, data: { parentId } });
  }
  revalidatePath("/admin/master-data/lookups");
  revalidatePath("/admin/custom-fields");
  return { success: true };
}
