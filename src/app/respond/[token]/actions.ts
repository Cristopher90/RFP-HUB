"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isQuestionConditionMet } from "@/lib/questionCondition";

export async function submitResponse(token: string, formData: FormData) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      rfp: {
        include: {
          items: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" } },
        },
      },
      response: true,
    },
  });

  if (!invitation) return { error: "Invitación no encontrada." };
  if (invitation.response)
    return { error: "Esta invitación ya fue respondida." };
  if (invitation.rfp.status !== "OPEN")
    return { error: "Esta RFP no está abierta para recibir cotizaciones." };

  const itemPrices: {
    itemId: string;
    unitPrice: number;
    notes: string | null;
  }[] = [];
  for (const item of invitation.rfp.items) {
    const raw = formData.get(`item-${item.id}`);
    const value = raw ? Number(raw) : NaN;
    if (Number.isNaN(value) || value < 0) {
      return { error: `Ingresa un precio válido para "${item.name}".` };
    }
    itemPrices.push({ itemId: item.id, unitPrice: value, notes: null });
  }

  const rawValues: Record<string, string> = {};
  for (const question of invitation.rfp.questions) {
    const raw = formData.get(`question-${question.id}`);
    if (typeof raw === "string") rawValues[question.id] = raw.trim();
  }

  const header = {
    commodity: invitation.rfp.commodity,
    region: invitation.rfp.region,
  };

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const answers: { questionId: string; value: string }[] = [];

  for (const question of invitation.rfp.questions) {
    if (question.visibility === "INTERNAL" || question.respondedBy === "BUYER")
      continue;
    if (!isQuestionConditionMet(question, header, rawValues)) continue;

    if (question.isPrerequisite) {
      const raw = formData.get(`question-${question.id}`);
      if (raw !== "on" && raw !== "true") {
        return {
          error: `Debes aceptar "${question.text}" para poder participar.`,
        };
      }
      answers.push({ questionId: question.id, value: "Aceptado" });
      continue;
    }

    if (question.type === "ATTACHMENT") {
      const file = formData.get(`question-${question.id}`);
      if (file instanceof File && file.size > 0) {
        await mkdir(uploadsDir, { recursive: true });
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const storedName = `${randomUUID()}-${safeName}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(path.join(uploadsDir, storedName), buffer);
        answers.push({
          questionId: question.id,
          value: `/uploads/${storedName}|${safeName}`,
        });
      } else if (question.required) {
        return { error: `Adjunta un archivo para "${question.text}".` };
      }
      continue;
    }

    const value = rawValues[question.id] ?? "";
    if (question.required && !value) {
      return { error: `La pregunta "${question.text}" es obligatoria.` };
    }
    if (
      value &&
      question.type === "NUMBER" &&
      (question.numberMin !== null || question.numberMax !== null)
    ) {
      const numeric = Number(value);
      if (
        Number.isNaN(numeric) ||
        (question.numberMin !== null && numeric < question.numberMin) ||
        (question.numberMax !== null && numeric > question.numberMax)
      ) {
        return {
          error: `"${question.text}" debe estar entre ${question.numberMin ?? "-∞"} y ${question.numberMax ?? "∞"}.`,
        };
      }
    }
    if (value) answers.push({ questionId: question.id, value });
  }

  const notes = (formData.get("notes") as string | null)?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const response = await tx.response.create({
      data: {
        invitationId: invitation.id,
        notes,
        itemPrices: { create: itemPrices },
        answers: { create: answers },
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "RESPONDED" },
    });
    return response;
  });

  revalidatePath(`/respond/${token}`);
  revalidatePath(`/rfps/${invitation.rfpId}`);
  revalidatePath(`/rfps/${invitation.rfpId}/compare`);

  return { error: null };
}
