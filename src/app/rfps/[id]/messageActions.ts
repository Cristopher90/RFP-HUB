"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rfpAccess } from "@/lib/rfpAccess";
import { getDictionary } from "@/i18n/getDictionary";
import { chatOpen, markThreadRead, MESSAGE_MAX } from "@/lib/rfpMessages";
import { notifyMessage } from "@/lib/notifications";

// The buyer writes to one or several of the RFP's invited suppliers: each one
// receives the message in its own thread (and an email).
export async function sendBuyerMessage(
  rfpId: string,
  invitationIds: string[],
  body: string,
): Promise<{ error: string } | { success: true }> {
  const user = await requireUser();
  const d = getDictionary(user.language).rfpMessages;
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId }, select: { id: true, clientId: true, status: true, createdByUserId: true } });
  if (!rfp || (await rfpAccess(user, rfp)) !== "edit") return { error: d.noPermission };
  if (!chatOpen(rfp.status)) return { error: d.notOpen };

  const text = body.trim();
  if (!text) return { error: d.empty };
  if (text.length > MESSAGE_MAX) return { error: d.tooLong.replace("{max}", String(MESSAGE_MAX)) };

  const invitations = await prisma.invitation.findMany({
    where: { rfpId, id: { in: [...new Set(invitationIds)] } },
    select: { id: true },
  });
  if (invitations.length === 0) return { error: d.pickRecipient };

  const senderName = `${user.name} ${user.lastName ?? ""}`.trim();
  await prisma.rfpMessage.createMany({
    data: invitations.map((i) => ({
      clientId: rfp.clientId,
      rfpId,
      invitationId: i.id,
      sender: "BUYER" as const,
      senderUserId: user.id,
      senderName,
      body: text,
    })),
  });
  for (const i of invitations) await notifyMessage(i.id, "BUYER", senderName, text);
  revalidatePath(`/rfps/${rfpId}`);
  return { success: true };
}

// The buyer opened a thread: what the supplier wrote there counts as read.
export async function markBuyerThreadRead(rfpId: string, invitationId: string): Promise<void> {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId }, select: { id: true, createdByUserId: true } });
  if (!rfp || (await rfpAccess(user, rfp)) !== "edit") return;
  const invitation = await prisma.invitation.findFirst({ where: { id: invitationId, rfpId }, select: { id: true } });
  if (!invitation) return;
  await markThreadRead(invitation.id, "BUYER");
}
