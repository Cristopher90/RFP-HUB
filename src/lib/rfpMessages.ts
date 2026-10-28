import "server-only";
import { prisma } from "@/lib/prisma";

// Chat between the buyer and each invited supplier, inside an RFP. One thread per
// invitation; the history is kept in RfpMessage and shown as a conversation.
export const MESSAGE_MAX = 2000;
const HOURLY_SUPPLIER_LIMIT = 30; // messages a supplier can send per invitation per hour

// Only published RFPs can be talked about: suppliers don't even see the rest.
export function chatOpen(status: string) {
  return status === "OPEN" || status === "CLOSED";
}

export type ChatMessage = {
  id: string;
  sender: "BUYER" | "SUPPLIER";
  senderName: string;
  body: string;
  createdAt: string;
  read: boolean;
};

function toChat(m: { id: string; sender: "BUYER" | "SUPPLIER"; senderName: string; body: string; createdAt: Date; readAt: Date | null }): ChatMessage {
  return { id: m.id, sender: m.sender, senderName: m.senderName, body: m.body, createdAt: m.createdAt.toISOString(), read: m.readAt !== null };
}

// Every thread of an RFP, keyed by invitation id (oldest message first).
export async function threadsForRfp(rfpId: string): Promise<Record<string, ChatMessage[]>> {
  const rows = await prisma.rfpMessage.findMany({ where: { rfpId }, orderBy: { createdAt: "asc" } });
  const out: Record<string, ChatMessage[]> = {};
  for (const m of rows) (out[m.invitationId] ??= []).push(toChat(m));
  return out;
}

export async function threadForInvitation(invitationId: string): Promise<ChatMessage[]> {
  const rows = await prisma.rfpMessage.findMany({ where: { invitationId }, orderBy: { createdAt: "asc" } });
  return rows.map(toChat);
}

// Marks as read what the OTHER side wrote: `reader` is who opened the thread.
export async function markThreadRead(invitationId: string, reader: "BUYER" | "SUPPLIER") {
  await prisma.rfpMessage.updateMany({
    where: { invitationId, sender: reader === "BUYER" ? "SUPPLIER" : "BUYER", readAt: null },
    data: { readAt: new Date() },
  });
}

export async function recentSupplierMessages(invitationId: string) {
  return prisma.rfpMessage.count({
    where: { invitationId, sender: "SUPPLIER", createdAt: { gt: new Date(Date.now() - 3_600_000) } },
  });
}

export const SUPPLIER_HOURLY_LIMIT = HOURLY_SUPPLIER_LIMIT;

// Unread buyer messages per invitation, for the supplier's home screen.
export async function unreadForSupplierInvitations(invitationIds: string[]) {
  if (invitationIds.length === 0) return new Map<string, number>();
  const rows = await prisma.rfpMessage.groupBy({
    by: ["invitationId"],
    where: { invitationId: { in: invitationIds }, sender: "BUYER", readAt: null },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.invitationId, r._count._all]));
}
