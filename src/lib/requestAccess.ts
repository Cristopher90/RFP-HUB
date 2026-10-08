import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";

type RequestUser = {
  id: string;
  role: string;
  clientId: string | null;
  canImportRequests: boolean;
  canAssignRequests: boolean;
  seeUnassignedRequests: boolean;
  seeMyRequests: boolean;
  seeAssignedRequests: boolean;
  seeAllRequests: boolean;
};

// Super Administrador and Administrador de cliente have every request
// permission implicitly; everyone else needs the per-user checkboxes.
export function isRequestAdmin(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "CLIENT_ADMIN";
}

export function canImportRequests(user: RequestUser): boolean {
  return isRequestAdmin(user) || user.canImportRequests;
}

export function canAssignRequests(user: RequestUser): boolean {
  return isRequestAdmin(user) || user.canAssignRequests;
}

export function canViewRequests(user: RequestUser): boolean {
  return (
    isRequestAdmin(user) ||
    user.seeUnassignedRequests ||
    user.seeMyRequests ||
    user.seeAssignedRequests ||
    user.seeAllRequests
  );
}

export async function buyerGroupIdsOf(userId: string): Promise<string[]> {
  const memberships = await prisma.buyerGroupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return memberships.map((m) => m.groupId);
}

// Which requests (of the already-scoped client) this user may see: the union
// of whatever view checkboxes they have. No view permission = nothing.
export function visibilityWhere(user: RequestUser, groupIds: string[]): Record<string, unknown> {
  if (isRequestAdmin(user) || user.seeAllRequests) return {};
  const clauses: Record<string, unknown>[] = [];
  if (user.seeUnassignedRequests) clauses.push({ assignedUserId: null, assignedGroupId: null });
  if (user.seeMyRequests) {
    clauses.push({ assignedUserId: user.id });
    if (groupIds.length > 0) clauses.push({ assignedGroupId: { in: groupIds } });
  }
  if (user.seeAssignedRequests) {
    clauses.push({ assignedUserId: { not: null } }, { assignedGroupId: { not: null } });
  }
  return clauses.length > 0 ? { OR: clauses } : { id: "__none__" };
}

// Only the assigned user — directly or through the assigned buyer group — may
// turn a request into an RFP. Not even administrators, unless assigned.
export function canGenerateRfp(
  request: { assignedUserId: string | null; assignedGroupId: string | null },
  userId: string,
  groupIds: string[],
): boolean {
  if (request.assignedUserId) return request.assignedUserId === userId;
  if (request.assignedGroupId) return groupIds.includes(request.assignedGroupId);
  return false;
}

// Gate + client resolution for the requests screens (list). Unlike the
// master-data screens, regular buyers can enter here if they have any view
// permission; a Super Administrador picks the client via ?clientId=.
export async function requireRequestsScope(searchParams: {
  clientId?: string | string[];
}) {
  const scope = await requireClientScope();
  const { user } = scope;
  if (!canViewRequests(user)) redirect("/");

  const groupIds = await buyerGroupIdsOf(user.id);
  let clients: { id: string; code: string; description: string }[] = [];
  let effectiveClientId: string | undefined;
  if (scope.isSuperAdmin) {
    clients = await prisma.client.findMany({ orderBy: { description: "asc" } });
    effectiveClientId =
      typeof searchParams.clientId === "string" && searchParams.clientId
        ? searchParams.clientId
        : undefined;
  } else {
    effectiveClientId = user.clientId ?? undefined;
  }
  return {
    scope,
    user,
    clients,
    effectiveClientId,
    groupIds,
    canImport: canImportRequests(user),
    canAssign: canAssignRequests(user),
  };
}
