"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireClientScope } from "@/lib/clientScope";
import type { UserRole } from "@/generated/prisma/enums";
import { getDictionary } from "@/i18n/getDictionary";
import type { Dictionary } from "@/i18n/getDictionary";
import { BUYER_ROLES } from "@/lib/requestFields";

export type UserFormInput = {
  name: string;
  lastName: string;
  clientId: string | null;
  email: string;
  companyCode: string;
  plant: string;
  costCenter: string;
  role: UserRole;
  password: string;
  allowFreeTextItems: boolean;
  canImportRequests: boolean;
  canAssignRequests: boolean;
  seeUnassignedRequests: boolean;
  seeMyRequests: boolean;
  seeAssignedRequests: boolean;
  seeAllRequests: boolean;
  canNoteOwn: boolean;
  canNoteTargeted: boolean;
  canNoteAll: boolean;
  approvalGroups: { approvalGroupId: string; limit: string }[];
  buyerGroupIds: string[]; // grupos de compradores (Configuración → Usuarios) a los que pertenece
};

// Cleans up the group-limit table: drops incomplete rows, dedupes by group
// (last one wins), parses the amount.
function shapeApprovalGroups(rows: { approvalGroupId: string; limit: string }[]) {
  const byGroupId = new Map<string, number>();
  for (const r of rows) {
    if (!r.approvalGroupId) continue;
    const n = Number(r.limit);
    if (!Number.isFinite(n)) continue;
    byGroupId.set(r.approvalGroupId, n);
  }
  return [...byGroupId.entries()].map(([approvalGroupId, limit]) => ({
    approvalGroupId,
    limit,
  }));
}

// Approval groups the payload may attach: only the target client's own, so a
// forged request can't link a user to another client's group.
async function validApprovalGroups(
  rows: { approvalGroupId: string; limit: string }[],
  clientId: string,
) {
  const shaped = shapeApprovalGroups(rows);
  if (shaped.length === 0) return [];
  const valid = new Set(
    (
      await prisma.approvalGroup.findMany({
        where: { clientId, id: { in: shaped.map((g) => g.approvalGroupId) } },
        select: { id: true },
      })
    ).map((g) => g.id),
  );
  return shaped.filter((g) => valid.has(g.approvalGroupId)).map((g) => ({ ...g, clientId }));
}

// Buyer-group memberships: only for buyer roles, and only the client's groups.
async function validBuyerGroupIds(ids: string[], role: UserRole, clientId: string | null) {
  if (!clientId || !(BUYER_ROLES as readonly string[]).includes(role)) return [];
  const unique = [...new Set(ids ?? [])];
  if (unique.length === 0) return [];
  const groups = await prisma.buyerGroup.findMany({
    where: { clientId, id: { in: unique } },
    select: { id: true },
  });
  return groups.map((g) => g.id);
}

// A CLIENT_ADMIN acts only within their own client and can never mint or
// edit a cross-client ADMIN; only ADMIN itself can do either. Returns the
// clientId to persist, or an error string.
function resolveTargetClientAndRole(
  scope: Awaited<ReturnType<typeof requireClientScope>>,
  input: UserFormInput,
  dictionary: Dictionary,
): { clientId: string | null } | { error: string } {
  if (scope.isSuperAdmin) {
    if (input.role === "ADMIN") {
      if (input.clientId) {
        return { error: dictionary.usersActions.superAdminNoClient };
      }
      return { clientId: null };
    }
    if (!input.clientId) {
      return { error: dictionary.usersActions.selectClientForUser };
    }
    return { clientId: input.clientId };
  }
  // CLIENT_ADMIN actor: fixed to their own client, can't grant ADMIN.
  if (input.role === "ADMIN") {
    return { error: dictionary.usersActions.onlySuperAdminCreatesAdmin };
  }
  if (!scope.user.clientId) {
    return { error: dictionary.usersActions.noClientAssigned };
  }
  return { clientId: scope.user.clientId };
}

export async function createUser(
  input: UserFormInput,
): Promise<{ error: string } | never> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: dictionary.usersActions.nameRequired };
  if (!email) return { error: dictionary.usersActions.emailRequired };
  if (!input.password || input.password.length < 6) {
    return { error: dictionary.usersActions.passwordMinLength };
  }

  const targetClient = resolveTargetClientAndRole(scope, input, dictionary);
  if ("error" in targetClient) return targetClient;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: dictionary.usersActions.emailAlreadyExists.replace("{email}", email) };
  }

  const approvalGroups = targetClient.clientId
    ? await validApprovalGroups(input.approvalGroups, targetClient.clientId)
    : [];
  const buyerGroupIds = await validBuyerGroupIds(input.buyerGroupIds, input.role, targetClient.clientId);
  await prisma.user.create({
    data: {
      name,
      lastName: input.lastName.trim() || null,
      clientId: targetClient.clientId,
      email,
      companyCode: input.companyCode.trim() || null,
      plant: input.plant.trim() || null,
      costCenter: input.costCenter.trim() || null,
      role: input.role,
      allowFreeTextItems: input.allowFreeTextItems,
      canImportRequests: input.canImportRequests,
      canAssignRequests: input.canAssignRequests,
      canNoteOwn: input.canNoteOwn,
      canNoteTargeted: input.canNoteTargeted,
      canNoteAll: input.canNoteAll,
      seeUnassignedRequests: input.seeUnassignedRequests,
      seeMyRequests: input.seeMyRequests,
      seeAssignedRequests: input.seeAssignedRequests,
      seeAllRequests: input.seeAllRequests,
      passwordHash: hashPassword(input.password),
      approvalGroups: { create: approvalGroups },
      buyerGroupMemberships: { create: buyerGroupIds.map((groupId) => ({ groupId })) },
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUser(
  userId: string,
  input: UserFormInput,
): Promise<{ error: string } | never> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: dictionary.usersActions.userNotFound };
  if (!scope.isSuperAdmin && target.clientId !== scope.user.clientId) {
    return { error: dictionary.usersActions.cannotEditOtherClientUser };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: dictionary.usersActions.nameRequired };
  if (!email) return { error: dictionary.usersActions.emailRequired };
  if (input.password && input.password.length < 6) {
    return { error: dictionary.usersActions.passwordMinLength };
  }

  const targetClient = resolveTargetClientAndRole(scope, input, dictionary);
  if ("error" in targetClient) return targetClient;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return { error: dictionary.usersActions.emailAlreadyExists.replace("{email}", email) };
  }

  const approvalGroups = targetClient.clientId
    ? await validApprovalGroups(input.approvalGroups, targetClient.clientId)
    : [];
  const buyerGroupIds = await validBuyerGroupIds(input.buyerGroupIds, input.role, targetClient.clientId);
  await prisma.userApprovalGroup.deleteMany({ where: { userId } });
  await prisma.buyerGroupMember.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      lastName: input.lastName.trim() || null,
      clientId: targetClient.clientId,
      email,
      companyCode: input.companyCode.trim() || null,
      plant: input.plant.trim() || null,
      costCenter: input.costCenter.trim() || null,
      role: input.role,
      allowFreeTextItems: input.allowFreeTextItems,
      canImportRequests: input.canImportRequests,
      canAssignRequests: input.canAssignRequests,
      canNoteOwn: input.canNoteOwn,
      canNoteTargeted: input.canNoteTargeted,
      canNoteAll: input.canNoteAll,
      seeUnassignedRequests: input.seeUnassignedRequests,
      seeMyRequests: input.seeMyRequests,
      seeAssignedRequests: input.seeAssignedRequests,
      seeAllRequests: input.seeAllRequests,
      approvalGroups: { create: approvalGroups },
      buyerGroupMemberships: { create: buyerGroupIds.map((groupId) => ({ groupId })) },
      ...(input.password ? { passwordHash: hashPassword(input.password) } : {}),
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
