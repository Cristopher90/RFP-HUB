import "server-only";
import { prisma } from "@/lib/prisma";
import { findDecidedRfpIdsForUser, findPendingApprovalsForUser } from "@/lib/approvalEngine";

// Who can open / change an RFP:
//  - Super Administrador and Administrador de cliente: everything in their scope.
//  - The creator, and the people on the RFP's team ("Equipo"): the creator always
//    edits; a team member edits or only views according to the permission given.
//  - An approver involved in the RFP (pending or already decided): view only.
export type RfpAccess = "edit" | "view" | null;

type AccessUser = { id: string; role: string };

export const isRfpAdmin = (user: { role: string }) => user.role === "ADMIN" || user.role === "CLIENT_ADMIN";

// Prisma filter for the RFPs a user takes part in (created or shared with them).
export function participantWhere(userId: string) {
  return { OR: [{ createdByUserId: userId }, { members: { some: { userId } } }] };
}

export async function rfpAccess(user: AccessUser, rfp: { id: string; createdByUserId: string | null }): Promise<RfpAccess> {
  if (isRfpAdmin(user) || rfp.createdByUserId === user.id) return "edit";
  const member = await prisma.rfpMember.findUnique({
    where: { rfpId_userId: { rfpId: rfp.id, userId: user.id } },
    select: { permission: true },
  });
  if (member) return member.permission === "EDIT" ? "edit" : "view";
  if (user.role === "APPROVER") {
    const [pending, decided] = await Promise.all([findPendingApprovalsForUser(user.id), findDecidedRfpIdsForUser(user.id)]);
    if (pending.some((p) => p.rfpId === rfp.id) || decided.includes(rfp.id)) return "view";
  }
  return null;
}

// Loads the RFP and returns the user's access, or null when the RFP doesn't exist.
export async function rfpAccessById(user: AccessUser, rfpId: string) {
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId }, select: { id: true, createdByUserId: true, clientId: true } });
  if (!rfp) return null;
  return { rfp, access: await rfpAccess(user, rfp) };
}

// Guard for the actions that change an RFP: returns an error text unless the
// user may edit it.
export async function editDenied(user: AccessUser, rfpId: string, message: string): Promise<string | null> {
  const found = await rfpAccessById(user, rfpId);
  return found?.access === "edit" ? null : message;
}

// The creator or an administrator manages the team.
export function canManageTeam(user: AccessUser, rfp: { createdByUserId: string | null }) {
  return isRfpAdmin(user) || rfp.createdByUserId === user.id;
}
