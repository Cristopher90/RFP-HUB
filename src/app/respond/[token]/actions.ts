"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isQuestionConditionMet } from "@/lib/questionCondition";
import { computeAutoScore } from "@/lib/questionScoring";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";

export async function submitResponse(token: string, formData: FormData) {
  const preferences = await getViewerPreferences();
  const dictionary = getDictionary(preferences.language);
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

  if (!invitation) return { error: dictionary.respondActions.invitationNotFound };
  if (invitation.response)
    return { error: dictionary.respondActions.alreadyResponded };
  if (invitation.rfp.status !== "OPEN")
    return { error: dictionary.respondActions.rfpNotOpen };

  const itemPrices: {
    itemId: string;
    unitPrice: number;
    notes: string | null;
  }[] = [];
  for (const item of invitation.rfp.items) {
    const raw = formData.get(`item-${item.id}`);
    const value = raw ? Number(raw) : NaN;
    if (Number.isNaN(value) || value < 0) {
      return { error: dictionary.respondActions.invalidPriceFor.replace("{item}", item.name) };
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
  const answers: { questionId: string; value: string; score: number | null }[] = [];

  for (const question of invitation.rfp.questions) {
    if (question.visibility === "INTERNAL" || question.respondedBy === "BUYER")
      continue;
    if (!isQuestionConditionMet(question, header, rawValues)) continue;

    if (question.isPrerequisite) {
      const raw = formData.get(`question-${question.id}`);
      if (raw !== "on" && raw !== "true") {
        return {
          error: dictionary.respondActions.mustAcceptToParticipate.replace("{question}", question.text),
        };
      }
      answers.push({ questionId: question.id, value: "Aceptado", score: null });
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
          score: null,
        });
      } else if (question.required) {
        return { error: dictionary.respondActions.attachFileFor.replace("{question}", question.text) };
      }
      continue;
    }

    const value = rawValues[question.id] ?? "";
    if (question.required && !value) {
      return { error: dictionary.respondActions.questionRequired.replace("{question}", question.text) };
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
          error: dictionary.respondActions.numberOutOfRange
            .replace("{question}", question.text)
            .replace("{min}", String(question.numberMin ?? "-∞"))
            .replace("{max}", String(question.numberMax ?? "∞")),
        };
      }
    }
    if (value) {
      answers.push({
        questionId: question.id,
        value,
        score: computeAutoScore(question.type, question.scoringConfig, value),
      });
    }
  }

  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const clientId = invitation.rfp.clientId;
  await prisma.$transaction(async (tx) => {
    const response = await tx.response.create({
      data: {
        clientId,
        invitationId: invitation.id,
        notes,
        itemPrices: {
          create: itemPrices.map((p) => ({ ...p, clientId })),
        },
        answers: {
          create: answers.map((a) => ({ ...a, clientId })),
        },
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
