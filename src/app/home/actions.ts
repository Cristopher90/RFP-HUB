"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { zonedTimeToUtc } from "@/lib/timezone";
import { getDictionary } from "@/i18n/getDictionary";
import { canManageNote, noteRights } from "@/lib/notes";

export type NoteInput = {
  id?: string;
  body: string;
  weight: number;
  scope: "PRIVATE" | "TARGETED" | "ALL";
  startsAt: string; // datetime-local in the author's timezone, or ""
  endsAt: string;
  targetUserIds: string[];
  clientId?: string | null; // Super Administrador only: a specific client, or null for every client
};

export async function saveNote(input: NoteInput): Promise<{ error: string } | { success: true }> {
  const user = await requireUser();
  const d = getDictionary(user.language).homeNotes;
  const rights = noteRights(user);

  const body = input.body.trim();
  if (!body) return { error: d.bodyRequired };
  if (body.length > 1000) return { error: d.bodyTooLong };
  const weight = Math.round(Number(input.weight));
  if (!(weight >= 1 && weight <= 5)) return { error: d.invalidWeight };
  if (input.scope === "PRIVATE" && !rights.own) return { error: d.noPermission };
  if (input.scope === "TARGETED" && !rights.targeted) return { error: d.noPermission };
  if (input.scope === "ALL" && !rights.all) return { error: d.noPermission };

  const startsAt = input.startsAt ? zonedTimeToUtc(input.startsAt, user.timezone) : null;
  const endsAt = input.endsAt ? zonedTimeToUtc(input.endsAt, user.timezone) : null;
  if (startsAt && endsAt && endsAt <= startsAt) return { error: d.endBeforeStart };

  // Notes always belong to the author's client; only the Super Administrador
  // can post news to a chosen client or to all of them (null).
  let clientId = user.clientId;
  if (user.role === "ADMIN" && input.scope === "ALL") {
    clientId = input.clientId || null;
  }

  let targetUserIds: string[] = [];
  if (input.scope === "TARGETED") {
    const wanted = [...new Set(input.targetUserIds)];
    if (wanted.length === 0) return { error: d.pickTargets };
    const valid = await prisma.user.findMany({
      where: { id: { in: wanted }, clientId: user.clientId },
      select: { id: true },
    });
    targetUserIds = valid.map((u) => u.id);
    if (targetUserIds.length === 0) return { error: d.pickTargets };
  }

  const data = {
    clientId,
    body,
    weight,
    scope: input.scope,
    startsAt,
    endsAt,
  };

  if (input.id) {
    const existing = await prisma.note.findUnique({ where: { id: input.id } });
    if (!existing || !canManageNote(user, existing)) return { error: d.notFound };
    await prisma.$transaction([
      prisma.noteTarget.deleteMany({ where: { noteId: existing.id } }),
      prisma.note.update({
        where: { id: existing.id },
        data: { ...data, targets: { create: targetUserIds.map((userId) => ({ userId })) } },
      }),
    ]);
  } else {
    await prisma.note.create({
      data: {
        ...data,
        authorId: user.id,
        targets: { create: targetUserIds.map((userId) => ({ userId })) },
      },
    });
  }
  revalidatePath("/home");
  return { success: true };
}

export async function deleteNote(id: string): Promise<{ error: string } | { success: true }> {
  const user = await requireUser();
  const d = getDictionary(user.language).homeNotes;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note || !canManageNote(user, note)) return { error: d.notFound };
  await prisma.note.delete({ where: { id } });
  revalidatePath("/home");
  return { success: true };
}
