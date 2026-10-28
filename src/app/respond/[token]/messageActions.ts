"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";
import { chatOpen, markThreadRead, MESSAGE_MAX, recentSupplierMessages, SUPPLIER_HOURLY_LIMIT } from "@/lib/rfpMessages";
import { notifyMessage } from "@/lib/notifications";

// The supplier writes to the buyer from its invitation link (same trust as
// answering the RFP: whoever holds the link).
export async function sendSupplierMessage(token: string, body: string): Promise<{ error: string } | { success: true }> {
  const preferences = await getViewerPreferences();
  const d = getDictionary(preferences.language).rfpMessages;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { supplier: true, rfp: { select: { id: true, clientId: true, status: true } } },
  });
  if (!invitation) return { error: d.noPermission };
  if (!chatOpen(invitation.rfp.status)) return { error: d.notOpen };

  const text = body.trim();
  if (!text) return { error: d.empty };
  if (text.length > MESSAGE_MAX) return { error: d.tooLong.replace("{max}", String(MESSAGE_MAX)) };
  if ((await recentSupplierMessages(invitation.id)) >= SUPPLIER_HOURLY_LIMIT) return { error: d.tooMany };

  const senderName = invitation.supplier.company || invitation.supplier.name;
  await prisma.rfpMessage.create({
    data: {
      clientId: invitation.rfp.clientId,
      rfpId: invitation.rfp.id,
      invitationId: invitation.id,
      sender: "SUPPLIER",
      senderName,
      body: text,
    },
  });
  await notifyMessage(invitation.id, "SUPPLIER", senderName, text);
  revalidatePath(`/respond/${token}`);
  revalidatePath(`/rfps/${invitation.rfp.id}`);
  return { success: true };
}

export async function markSupplierThreadRead(token: string): Promise<void> {
  const invitation = await prisma.invitation.findUnique({ where: { token }, select: { id: true } });
  if (!invitation) return;
  await markThreadRead(invitation.id, "SUPPLIER");
}
