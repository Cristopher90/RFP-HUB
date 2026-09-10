"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import type { MasterDataKind } from "@/lib/masterDataSchema";
import { CURRENCIES } from "@/lib/profileOptions";
import { getDictionary } from "@/i18n/getDictionary";

export type MasterDataItemInput = {
  clientKey: string;
  code: string;
  description: string;
  parentClientKey: string | null;
  icon?: string; // solo usado por kind: "client" (ver ClientsForm.tsx)
  currency?: string; // solo usado por kind: "client" (ver ClientsForm.tsx)
  selectable?: boolean; // solo usado por kind: "commodity"
};

function pathFor(kind: Exclude<MasterDataKind, "client">) {
  if (kind === "commodity") return "/admin/master-data/commodities";
  if (kind === "region") return "/admin/master-data/regions";
  if (kind === "approvalGroup") return "/admin/master-data/approval-groups";
  return "/admin/master-data/origins";
}

// `kind: "client"` manages the Client list itself — ADMIN-only, flat (no
// parent/tree, no clientId scoping since it IS the tenant boundary).
export async function saveClientList(
  items: MasterDataItemInput[],
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (!scope.isSuperAdmin) {
    return { error: dictionary.masterDataActions.onlySuperAdminEditClients };
  }

  const cleaned = items
    .map((i) => ({
      clientKey: i.clientKey,
      code: i.code.trim(),
      description: i.description.trim(),
      icon: i.icon?.trim() || null,
      currency: (i.currency?.trim() || "USD").toUpperCase(),
    }))
    .filter((i) => i.code.length > 0 && i.description.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    const key = i.code.toLowerCase();
    if (seen.has(key)) return { error: dictionary.masterDataActions.duplicateId.replace("{id}", i.code) };
    seen.add(key);
    if (!CURRENCIES.includes(i.currency)) {
      return { error: dictionary.masterDataActions.invalidCurrency.replace("{currency}", i.currency) };
    }
  }

  // Every other table has a hard (RESTRICT) foreign key straight to
  // Client, unlike the flat/tree datos maestros (Commodity, Región, ...)
  // which nothing else references by id — so this can't be a wholesale
  // delete+recreate like those. Existing rows (clientKey = their real id)
  // are updated in place; new rows are created; rows dropped from the
  // list are deleted only if nothing depends on them yet.
  const existing = await prisma.client.findMany();
  const existingIds = new Set(existing.map((c) => c.id));
  const submittedIds = new Set(
    cleaned.filter((i) => existingIds.has(i.clientKey)).map((i) => i.clientKey),
  );

  for (const client of existing) {
    if (!submittedIds.has(client.id)) {
      try {
        await prisma.client.delete({ where: { id: client.id } });
      } catch {
        return {
          error: dictionary.masterDataActions.cannotDeleteClientInUse.replace("{name}", client.description),
        };
      }
    }
  }
  for (const i of cleaned) {
    if (existingIds.has(i.clientKey)) {
      await prisma.client.update({
        where: { id: i.clientKey },
        data: { code: i.code, description: i.description, icon: i.icon, currency: i.currency },
      });
    } else {
      await prisma.client.create({
        data: { code: i.code, description: i.description, icon: i.icon, currency: i.currency },
      });
    }
  }

  revalidatePath("/admin/master-data/clients");
  return { success: true };
}

// Wholesale delete — separate from (and stricter than) the normal save
// flow's diffing, and gated to Super Administrador only regardless of who
// can otherwise edit this list, since it's irreversible and has no "undo
// on next save" like removing a row does.
export async function clearClientList(): Promise<
  { error: string } | { success: true }
> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (!scope.isSuperAdmin) {
    return { error: dictionary.masterDataActions.onlySuperAdminDeleteClientsTable };
  }
  try {
    await prisma.client.deleteMany({});
  } catch {
    return {
      error: dictionary.masterDataActions.cannotDeleteAllClients,
    };
  }
  revalidatePath("/admin/master-data/clients");
  return { success: true };
}

export async function saveMasterDataList(
  kind: Exclude<MasterDataKind, "client">,
  items: MasterDataItemInput[],
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    return { error: dictionary.masterDataActions.noPermissionMasterData };
  }
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) {
    return { error: dictionary.masterDataActions.selectClientToEditMasterData };
  }

  const cleaned = items
    .map((i) => ({
      clientKey: i.clientKey,
      code: i.code.trim(),
      description: i.description.trim(),
      parentClientKey: i.parentClientKey,
      selectable: i.selectable ?? true,
    }))
    .filter((i) => i.code.length > 0 && i.description.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    const key = i.code.toLowerCase();
    if (seen.has(key)) {
      return { error: dictionary.masterDataActions.duplicateId.replace("{id}", i.code) };
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
        return { error: dictionary.masterDataActions.hierarchyCycle.replace("{id}", i.code) };
      }
      visited.add(current.clientKey);
      current = byKey.get(current.parentClientKey);
    }
  }

  type TreeDelegate = {
    deleteMany(args: { where: { clientId: string } }): Promise<unknown>;
    create(args: {
      data: {
        clientId: string;
        code: string;
        description: string;
        selectable?: boolean;
      };
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

  await model.deleteMany({ where: { clientId } });
  const idByKey = new Map<string, string>();
  for (const i of cleaned) {
    const row = await model.create({
      data: {
        clientId,
        code: i.code,
        description: i.description,
        ...(kind === "commodity" ? { selectable: i.selectable } : {}),
      },
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

// Wholesale delete of one client's list for one datos maestros table —
// gated to Super Administrador regardless of who can otherwise edit this
// list (a CLIENT_ADMIN can already replace the whole list via a normal
// save with an empty row set, but this skips that flow's per-row review).
export async function clearMasterDataTable(
  kind: Exclude<MasterDataKind, "client">,
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (!scope.isSuperAdmin) {
    return { error: dictionary.masterDataActions.onlySuperAdminDeleteFullTable };
  }
  if (!targetClientId) {
    return { error: dictionary.masterDataActions.selectClientToClearMasterData };
  }

  type DeleteDelegate = {
    deleteMany(args: { where: { clientId: string } }): Promise<unknown>;
  };
  const model: DeleteDelegate =
    kind === "commodity"
      ? prisma.commodity
      : kind === "region"
        ? prisma.region
        : kind === "approvalGroup"
          ? prisma.approvalGroup
          : prisma.origin;

  await model.deleteMany({ where: { clientId: targetClientId } });

  revalidatePath(pathFor(kind));
  revalidatePath("/rfps/new");
  return { success: true };
}
