"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, ROLE_LEVEL } from "@/lib/auth";
import { validateAndShapeRfp, type CreateRfpInput } from "../new/actions";
import { pickApprovalWorkflow, buildApprovalState } from "@/lib/approvalWorkflow";
import { canDecideApproval, parseApprovalState } from "@/lib/approvalState";
import { matchesTemplate } from "@/lib/templateMatch";

export async function inviteSupplier(
  rfpId: string,
  input: { name: string; email: string; company: string },
) {
  const name = input.name.trim();
  const email = input.email.trim();
  const company = input.company.trim();
  if (!name || !email) {
    return { error: "Nombre y correo son obligatorios." };
  }

  const supplier = await prisma.supplier.create({
    data: { name, email, company },
  });
  await prisma.invitation.create({
    data: { rfpId, supplierId: supplier.id },
  });

  revalidatePath(`/rfps/${rfpId}`);
  return { error: null };
}

export async function closeRfp(rfpId: string) {
  await prisma.rfp.update({ where: { id: rfpId }, data: { status: "CLOSED" } });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function reopenRfp(rfpId: string) {
  await prisma.rfp.update({ where: { id: rfpId }, data: { status: "OPEN" } });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function setBuyerAnswer(
  rfpId: string,
  questionId: string,
  formData: FormData,
) {
  await requireUser();

  const question = await prisma.rfpQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question || question.rfpId !== rfpId || question.respondedBy !== "BUYER") {
    return;
  }

  let value = "";
  if (question.type === "ATTACHMENT") {
    const file = formData.get("value");
    if (file instanceof File && file.size > 0) {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const storedName = `${randomUUID()}-${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadsDir, storedName), buffer);
      value = `/uploads/${storedName}|${safeName}`;
    } else {
      return;
    }
  } else {
    value = ((formData.get("value") as string | null) ?? "").trim();
  }

  await prisma.rfpQuestion.update({
    where: { id: questionId },
    data: { buyerAnswerValue: value || null },
  });

  revalidatePath(`/rfps/${rfpId}`);
}

// Solo se puede eliminar (soft-delete) una RFP en borrador — los datos
// quedan en la base, solo cambia de estado.
export async function deleteRfpDraft(rfpId: string) {
  await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "DRAFT") {
    return { error: "Solo se pueden eliminar RFPs en borrador." };
  }
  await prisma.rfp.update({ where: { id: rfpId }, data: { status: "DELETED" } });
  revalidatePath("/");
  redirect("/");
}

// Publica un borrador tal cual está guardado (sin pasar por el editor):
// resuelve el flujo de aprobación aplicable y deja la RFP en OPEN o en
// PENDING_PUBLISH_APPROVAL.
export async function publishRfp(rfpId: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "DRAFT") {
    return { error: "Solo se puede publicar una RFP en borrador." };
  }

  const matchingTemplates = (
    await prisma.rfpTemplate.findMany({
      where: { active: true },
      include: { approvalWorkflow: true },
    })
  ).filter((t) => matchesTemplate(t, rfp.commodity ?? "", rfp.region ?? ""));

  const workflow = pickApprovalWorkflow(matchingTemplates);
  const state = buildApprovalState(
    workflow
      ? {
          required: workflow.publishRequired,
          approverMode: workflow.publishApproverMode,
          minRole: workflow.publishMinRole,
          approverUserIds: workflow.publishApproverUserIds,
        }
      : null,
  );
  if (canDecideApproval(state, user, ROLE_LEVEL)) {
    state.status = "APPROVED";
    state.decidedAt = new Date().toISOString();
    state.decidedByUserId = user.id;
  }
  const status = state.status === "APPROVED" ? "OPEN" : "PENDING_PUBLISH_APPROVAL";

  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      status,
      approvalWorkflowId: workflow?.id ?? null,
      publishApprovalState: JSON.stringify(state),
    },
  });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function updateRfp(
  rfpId: string,
  input: CreateRfpInput,
): Promise<{ error: string } | never> {
  const user = await requireUser();

  const existing = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: {
      items: true,
      questions: true,
      invitations: true,
    },
  });
  if (!existing) return { error: "RFP no encontrada." };
  if (existing.status !== "DRAFT") {
    return { error: "Solo se puede editar una RFP en estado borrador." };
  }

  const title = input.title.trim();
  const buyerName = input.buyerName.trim();
  if (!title) return { error: "El título de la RFP es obligatorio." };
  if (!buyerName) return { error: "El nombre del comprador es obligatorio." };
  if (!input.deadlineAt) return { error: "La fecha de cierre es obligatoria." };

  const shaped = await validateAndShapeRfp(input, user);
  if ("error" in shaped) return shaped;
  const { items, questions, suppliers, matchingTemplates, estimatedPrice } = shaped;

  let status: "DRAFT" | "PENDING_PUBLISH_APPROVAL" | "OPEN" = "DRAFT";
  let approvalWorkflowId: string | null = null;
  let publishApprovalState: string | null = existing.publishApprovalState;
  if (!input.saveAsDraft) {
    const workflow = pickApprovalWorkflow(matchingTemplates);
    approvalWorkflowId = workflow?.id ?? null;
    const state = buildApprovalState(
      workflow
        ? {
            required: workflow.publishRequired,
            approverMode: workflow.publishApproverMode,
            minRole: workflow.publishMinRole,
            approverUserIds: workflow.publishApproverUserIds,
          }
        : null,
    );
    if (canDecideApproval(state, user, ROLE_LEVEL)) {
      state.status = "APPROVED";
      state.decidedAt = new Date().toISOString();
      state.decidedByUserId = user.id;
    }
    status = state.status === "APPROVED" ? "OPEN" : "PENDING_PUBLISH_APPROVAL";
    publishApprovalState = JSON.stringify(state);
  }

  const estimatedPriceValue =
    estimatedPrice !== null && !Number.isNaN(estimatedPrice) ? estimatedPrice : null;

  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      title,
      description: input.description.trim(),
      buyerName,
      deadlineAt: new Date(input.deadlineAt),
      status,
      commodity: input.commodity.trim() || null,
      region: input.region.trim() || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      estimatedPrice: estimatedPriceValue,
      origin: input.origin.trim() || null,
      predecessorDocument: input.predecessorDocument.trim() || null,
      basedOnRfpId: input.basedOnRfpId || null,
      scoringEnabled: input.scoringEnabled,
      approvalWorkflowId,
      publishApprovalState,
      appliedTemplates:
        matchingTemplates.length > 0
          ? JSON.stringify(
              matchingTemplates.map((t) => ({ id: t.id, name: t.name })),
            )
          : null,
    },
  });

  // Items: update existing (by id), create new, delete removed.
  const existingItemIds = new Set(existing.items.map((i) => i.id));
  const submittedItemIds = new Set(items.map((i) => i.id).filter(Boolean));
  for (const id of existingItemIds) {
    if (!submittedItemIds.has(id)) await prisma.rfpItem.delete({ where: { id } });
  }
  for (const [order, { id, ...item }] of items.entries()) {
    if (id && existingItemIds.has(id)) {
      await prisma.rfpItem.update({ where: { id }, data: { ...item, order } });
    } else {
      await prisma.rfpItem.create({ data: { ...item, order, rfpId } });
    }
  }

  // Questions: same pattern, plus resolving dependsOnQuestionId via clientKey
  // across a mix of existing and newly created rows.
  const existingQuestionIds = new Set(existing.questions.map((q) => q.id));
  const submittedQuestionIds = new Set(questions.map((q) => q.id).filter(Boolean));
  for (const id of existingQuestionIds) {
    if (!submittedQuestionIds.has(id)) {
      await prisma.rfpQuestion.delete({ where: { id } });
    }
  }
  const realIdByClientKey = new Map<string, string>();
  for (const [order, q] of questions.entries()) {
    const data = {
      section: q.section,
      text: q.text,
      type: q.type,
      required: q.required,
      weight: q.weight,
      isPrerequisite: q.isPrerequisite,
      visibility: q.visibility,
      respondedBy: q.respondedBy,
      numberMin: q.numberMin,
      numberMax: q.numberMax,
      dependsOnHeaderField: q.dependsOnHeaderField,
      dependsOnValue: q.dependsOnValue || null,
      buyerAnswerValue: q.buyerAnswerValue,
      options: q.options,
      sourceTemplateQuestionId: q.sourceTemplateQuestionId,
      locked: q.locked,
      order,
    };
    if (q.id && existingQuestionIds.has(q.id)) {
      await prisma.rfpQuestion.update({ where: { id: q.id }, data });
      realIdByClientKey.set(q.clientKey, q.id);
    } else {
      const created = await prisma.rfpQuestion.create({ data: { ...data, rfpId } });
      realIdByClientKey.set(q.clientKey, created.id);
    }
  }
  for (const q of questions) {
    const ownId = realIdByClientKey.get(q.clientKey);
    if (!ownId) continue;
    const targetId = q.dependsOnQuestionKey
      ? (realIdByClientKey.get(q.dependsOnQuestionKey) ?? null)
      : null;
    await prisma.rfpQuestion.update({
      where: { id: ownId },
      data: { dependsOnQuestionId: targetId },
    });
  }

  // Suppliers/invitations: same pattern. Safe to delete removed invitations
  // outright — editing is only allowed while the RFP is still a DRAFT, so
  // nothing could have responded yet.
  const existingInvitationIds = new Set(existing.invitations.map((i) => i.id));
  const submittedInvitationIds = new Set(
    suppliers.map((s) => s.invitationId).filter(Boolean),
  );
  for (const id of existingInvitationIds) {
    if (!submittedInvitationIds.has(id)) {
      await prisma.invitation.delete({ where: { id } });
    }
  }
  for (const { invitationId, ...supplier } of suppliers) {
    if (invitationId && existingInvitationIds.has(invitationId)) {
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });
      if (invitation) {
        await prisma.supplier.update({
          where: { id: invitation.supplierId },
          data: supplier,
        });
      }
    } else {
      const createdSupplier = await prisma.supplier.create({ data: supplier });
      await prisma.invitation.create({
        data: { rfpId, supplierId: createdSupplier.id },
      });
    }
  }

  revalidatePath(`/rfps/${rfpId}`);
  redirect(`/rfps/${rfpId}`);
}

export async function approvePublish(rfpId: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "PENDING_PUBLISH_APPROVAL") {
    return { error: "Esta RFP no está pendiente de aprobación." };
  }
  const state = parseApprovalState(rfp.publishApprovalState);
  if (!canDecideApproval(state, user, ROLE_LEVEL)) {
    return { error: "No tienes permiso para aprobar esta publicación." };
  }
  const updated = {
    ...state!,
    status: "APPROVED" as const,
    decidedAt: new Date().toISOString(),
    decidedByUserId: user.id,
  };
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { status: "OPEN", publishApprovalState: JSON.stringify(updated) },
  });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function rejectPublish(rfpId: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "PENDING_PUBLISH_APPROVAL") {
    return { error: "Esta RFP no está pendiente de aprobación." };
  }
  const state = parseApprovalState(rfp.publishApprovalState);
  if (!canDecideApproval(state, user, ROLE_LEVEL)) {
    return { error: "No tienes permiso para rechazar esta publicación." };
  }
  const updated = {
    ...state!,
    status: "REJECTED" as const,
    decidedAt: new Date().toISOString(),
    decidedByUserId: user.id,
  };
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { status: "DRAFT", publishApprovalState: JSON.stringify(updated) },
  });
  revalidatePath(`/rfps/${rfpId}`);
}
