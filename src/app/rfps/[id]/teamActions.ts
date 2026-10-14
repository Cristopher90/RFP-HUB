"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/getDictionary";
import { BUYER_ROLES } from "@/lib/requestFields";
import { canManageTeam } from "@/lib/rfpAccess";

type Result = { error: string } | { success: true };
type Permission = "VIEW" | "EDIT";

const validPermission = (p: string): p is Permission => p === "VIEW" || p === "EDIT";

// Team management: only the RFP's creator or an administrator, and it works in
// any status (a published RFP can still get new people).
async function loadForTeam(rfpId: string) {
  const user = await requireUser();
  const d = getDictionary(user.language).rfpTeam;
  const rfp = await prisma.rfp.findUnique({
    where: { id: rfpId },
    select: { id: true, clientId: true, createdByUserId: true },
  });
  if (!rfp || (user.role !== "ADMIN" && rfp.clientId !== user.clientId)) return { user, d, rfp: null } as const;
  return { user, d, rfp } as const;
}

export async function addRfpMember(rfpId: string, userId: string, permission: string): Promise<Result> {
  const { user, d, rfp } = await loadForTeam(rfpId);
  if (!rfp) return { error: d.notFound };
  if (!canManageTeam(user, rfp)) return { error: d.noPermission };
  if (!validPermission(permission)) return { error: d.invalidPermission };
  if (userId === rfp.createdByUserId) return { error: d.isOwner };

  // Only people of the same company who can work on RFPs.
  const target = await prisma.user.findFirst({
    where: { id: userId, clientId: rfp.clientId, role: { in: [...BUYER_ROLES] } },
    select: { id: true },
  });
  if (!target) return { error: d.invalidUser };
  const existing = await prisma.rfpMember.findUnique({ where: { rfpId_userId: { rfpId, userId } } });
  if (existing) return { error: d.alreadyMember };

  await prisma.rfpMember.create({ data: { rfpId, userId, permission, addedByUserId: user.id } });
  revalidatePath(`/rfps/${rfpId}`);
  return { success: true };
}

export async function setRfpMemberPermission(memberId: string, permission: string): Promise<Result> {
  const member = await prisma.rfpMember.findUnique({ where: { id: memberId }, select: { rfpId: true } });
  const user = await requireUser();
  const d = getDictionary(user.language).rfpTeam;
  if (!member) return { error: d.notFound };
  const { rfp } = await loadForTeam(member.rfpId);
  if (!rfp) return { error: d.notFound };
  if (!canManageTeam(user, rfp)) return { error: d.noPermission };
  if (!validPermission(permission)) return { error: d.invalidPermission };
  await prisma.rfpMember.update({ where: { id: memberId }, data: { permission } });
  revalidatePath(`/rfps/${rfp.id}`);
  return { success: true };
}

export async function removeRfpMember(memberId: string): Promise<Result> {
  const member = await prisma.rfpMember.findUnique({ where: { id: memberId }, select: { rfpId: true } });
  const user = await requireUser();
  const d = getDictionary(user.language).rfpTeam;
  if (!member) return { error: d.notFound };
  const { rfp } = await loadForTeam(member.rfpId);
  if (!rfp) return { error: d.notFound };
  if (!canManageTeam(user, rfp)) return { error: d.noPermission };
  await prisma.rfpMember.delete({ where: { id: memberId } });
  revalidatePath(`/rfps/${rfp.id}`);
  return { success: true };
}
