"use server";

import { logRfpEvent } from "@/lib/rfpEvents";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { applicableRequirements } from "@/lib/supplierDocs";
import { documentationError, rfpDocumentRequirements } from "@/lib/supplierDocsServer";
import { validateAndShapeRfp, type CreateRfpInput } from "../new/actions";
import {
  pickApprovalWorkflow,
  levelsForStage,
  startStage,
  recordDecision,
  sendReminder,
} from "@/lib/approvalEngine";
import {
  matchesTemplate,
  resolveAppliedTemplates,
  ancestorChain,
  strictestMinSuppliers,
} from "@/lib/templateMatch";
import { findUnacceptedContacts } from "@/lib/supplierContacts";
import { resolveOpenStatus } from "@/lib/rfpStatus";
import { extractTags } from "@/lib/tags";
import { editDenied } from "@/lib/rfpAccess";
import { zonedTimeToUtc } from "@/lib/timezone";
import { getDictionary } from "@/i18n/getDictionary";
import { notifyCreatorOfStatusChange, sendPendingInvitations } from "@/lib/notifications";
import {
  deleteCustomValues,
  readCustomValues,
  saveCustomValues,
  validateStoredRfpCustom,
} from "@/lib/customFields";

export async function inviteSupplier(
  rfpId: string,
  input: {
    name: string;
    email: string;
    company: string;
    supplierDirectoryId?: string | null;
  },
) {
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const denied = await editDenied(user, rfpId, dictionary.rfpTeam.noEditPermission);
  if (denied) return { error: denied };
  const name = input.name.trim();
  const email = input.email.trim();
  const company = input.company.trim();
  if (!name || !email) {
    return { error: dictionary.rfpIdActions.nameAndEmailRequired };
  }

  const rfp = await prisma.rfp.findUniqueOrThrow({
    where: { id: rfpId },
    select: { clientId: true, status: true },
  });
  // Suppliers are chosen while the RFP is a draft; a published one goes back to draft to change them.
  if (rfp.status !== "DRAFT") return { error: dictionary.rfpIdActions.invitesOnlyInDraft };
  // ... and only if it holds the documentation the RFP's templates require.
  if (input.supplierDirectoryId) {
    const docError = await documentationError(
      rfp.clientId,
      [input.supplierDirectoryId],
      await rfpDocumentRequirements(rfpId),
      user.language,
    );
    if (docError) return { error: docError };
  }
  // A directory supplier can only be invited through an accepted contact.
  const unaccepted = await findUnacceptedContacts([
    { email, supplierDirectoryId: input.supplierDirectoryId },
  ]);
  if (unaccepted.length > 0) {
    return { error: dictionary.rfpActions.contactNotAccepted.replace("{emails}", unaccepted.join(", ")) };
  }
  const supplier = await prisma.supplier.create({
    data: {
      name,
      email,
      company,
      clientId: rfp.clientId,
      supplierDirectoryId: input.supplierDirectoryId || null,
    },
  });
  await prisma.invitation.create({
    data: { rfpId, supplierId: supplier.id, clientId: rfp.clientId },
  });
  await logRfpEvent(rfpId, user.id, "SUPPLIER_INVITED", { name: company ? `${name} (${company})` : name });
  await sendPendingInvitations(rfpId);

  revalidatePath(`/rfps/${rfpId}`);
  return { error: null };
}

export async function closeRfp(rfpId: string) {
  const user = await requireUser();
  if (await editDenied(user, rfpId, "")) return;
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  const actor = await getCurrentUser();
  await notifyCreatorOfStatusChange(rfpId, "closed", { actorUserId: actor?.id });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function reopenRfp(rfpId: string) {
  const user = await requireUser();
  if (await editDenied(user, rfpId, "")) return;
  const rfp = await prisma.rfp.findUniqueOrThrow({
    where: { id: rfpId },
    select: { startDate: true },
  });
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { status: resolveOpenStatus(rfp.startDate), closedAt: null },
  });
  await logRfpEvent(rfpId, user.id, "REOPENED");
  const actor = await getCurrentUser();
  await notifyCreatorOfStatusChange(rfpId, "reopened", { actorUserId: actor?.id });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function setBuyerAnswer(
  rfpId: string,
  questionId: string,
  formData: FormData,
) {
  const user = await requireUser();
  if (await editDenied(user, rfpId, "")) return;

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
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const denied = await editDenied(user, rfpId, dictionary.rfpTeam.noEditPermission);
  if (denied) return { error: denied };
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "DRAFT") {
    return { error: dictionary.rfpIdActions.onlyDraftCanBeDeleted };
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
  const dictionary = getDictionary(user.language);
  const denied = await editDenied(user, rfpId, dictionary.rfpTeam.noEditPermission);
  if (denied) return { error: denied };
  const rfp = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: {
      _count: { select: { invitations: true } },
      invitations: { include: { supplier: true } },
    },
  });
  if (!rfp || rfp.status !== "DRAFT") {
    return { error: dictionary.rfpIdActions.onlyDraftCanBePublished };
  }

  const [allTemplates, commodities, regions] = await Promise.all([
    prisma.rfpTemplate.findMany({
      where: { active: true, clientId: rfp.clientId },
      include: { approvalWorkflow: { include: { levels: true } } },
    }),
    prisma.commodity.findMany({ where: { clientId: rfp.clientId } }),
    prisma.region.findMany({ where: { clientId: rfp.clientId } }),
  ]);
  const commodityChain = ancestorChain(commodities, rfp.commodity ?? "");
  const regionChain = ancestorChain(regions, rfp.region ?? "");
  const storedCustom = (await readCustomValues(rfp.clientId, "RFP", [rfp.id])).get(rfp.id) ?? {};
  const matchingTemplates = resolveAppliedTemplates(
    allTemplates.filter((t) =>
      matchesTemplate(t, commodityChain, regionChain, rfp.estimatedPrice, storedCustom),
    ),
    rfp.selectedTemplateId,
  );

  const customError = await validateStoredRfpCustom(rfp.id, user.language, {
    role: user.role,
    viewGroupIds: user.viewGroupIds,
  });
  if (customError) return { error: customError };

  const unacceptedContacts = await findUnacceptedContacts(
    rfp.invitations.map((i) => ({
      email: i.supplier.email,
      supplierDirectoryId: i.supplier.supplierDirectoryId,
    })),
  );
  if (unacceptedContacts.length > 0) {
    return {
      error: dictionary.rfpActions.contactNotAccepted.replace("{emails}", unacceptedContacts.join(", ")),
    };
  }

  const minRule = strictestMinSuppliers(matchingTemplates);
  if (minRule && rfp._count.invitations < minRule.min) {
    return {
      error: dictionary.rfpActions.minSuppliersRequired
        .replace("{min}", String(minRule.min))
        .replace("{template}", minRule.templateName)
        .replace("{count}", String(rfp._count.invitations)),
    };
  }

  const docError = await documentationError(
    rfp.clientId,
    rfp.invitations.map((i) => i.supplier.supplierDirectoryId).filter((id): id is string => Boolean(id)),
    applicableRequirements(matchingTemplates, {
      commodity: rfp.commodity,
      region: rfp.region,
      custom: storedCustom,
    }),
    user.language,
  );
  if (docError) return { error: docError };

  const workflow = pickApprovalWorkflow(matchingTemplates);
  const levels = levelsForStage(workflow, "PUBLISH");

  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      status:
        levels.length === 0 ? resolveOpenStatus(rfp.startDate) : "PENDING_PUBLISH_APPROVAL",
      publishedAt: levels.length === 0 ? new Date() : null,
      // No start date: the publication date is used.
      ...(levels.length === 0 && !rfp.startDate ? { startDate: new Date() } : {}),
      approvalWorkflowId: workflow?.id ?? null,
    },
  });

  if (levels.length > 0) {
    // A rejected earlier attempt may have left PUBLISH-stage rows behind.
    await prisma.rfpApproval.deleteMany({ where: { rfpId, stage: "PUBLISH" } });
    const { completed } = await startStage({
      rfpId,
      stage: "PUBLISH",
      levels,
      requiredValue: rfp.estimatedPrice ?? 0,
      requesterId: user.id,
    });
    if (completed) {
      await prisma.rfp.update({
        where: { id: rfpId },
        data: { status: resolveOpenStatus(rfp.startDate), publishedAt: new Date(), startDate: rfp.startDate ?? new Date() },
      });
    }
  }
  await sendPendingInvitations(rfpId);
  revalidatePath(`/rfps/${rfpId}`);
}

export async function updateRfp(
  rfpId: string,
  input: CreateRfpInput,
): Promise<{ error: string } | never> {
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const denied = await editDenied(user, rfpId, dictionary.rfpTeam.noEditPermission);
  if (denied) return { error: denied };

  const existing = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: {
      items: true,
      questions: true,
      invitations: true,
    },
  });
  if (!existing) return { error: dictionary.rfpIdActions.rfpNotFound };
  if (existing.status !== "DRAFT") {
    return { error: dictionary.rfpIdActions.onlyDraftCanBeEdited };
  }

  const title = input.title.trim();
  const buyerName = input.buyerName.trim();
  if (!title) return { error: dictionary.rfpActions.titleRequired };
  if (!buyerName) return { error: dictionary.rfpActions.buyerNameRequired };
  if (!input.deadlineAt) return { error: dictionary.rfpActions.deadlineRequired };

  const clientId = existing.clientId;
  const shaped = await validateAndShapeRfp(input, user, clientId, rfpId);
  if ("error" in shaped) return shaped;
  const { items, questions, suppliers, matchingTemplates, estimatedPrice, headerCustom } = shaped;

  const workflow = input.saveAsDraft ? null : pickApprovalWorkflow(matchingTemplates);
  const publishLevels = input.saveAsDraft ? [] : levelsForStage(workflow, "PUBLISH");
  const estimatedPriceValue =
    estimatedPrice !== null && !Number.isNaN(estimatedPrice) ? estimatedPrice : null;
  const internalNotes = (input.internalNotes ?? "").trim().slice(0, 2000);
  const startDateValue = input.startDate
    ? zonedTimeToUtc(input.startDate, user.timezone)
    : null;
  const status: "DRAFT" | "PENDING_PUBLISH_APPROVAL" | "OPEN" | "AWAITING_START" = input.saveAsDraft
    ? "DRAFT"
    : publishLevels.length === 0
      ? resolveOpenStatus(startDateValue)
      : "PENDING_PUBLISH_APPROVAL";

  // What changed in this save, for the history.
  const newDeadline = zonedTimeToUtc(input.deadlineAt, user.timezone);
  const same = (a: unknown, b: unknown) => (a ?? "") === (b ?? "");
  const changedFields = [
    !same(existing.title, title) && "title",
    !same(existing.description, input.description.trim()) && "description",
    !same(existing.internalNotes, internalNotes || null) && "internalNotes",
    !same(existing.buyerName, buyerName) && "buyerName",
    existing.deadlineAt.getTime() !== newDeadline.getTime() && "deadlineAt",
    !same(existing.commodity, input.commodity.trim() || null) && "commodity",
    !same(existing.region, input.region.trim() || null) && "region",
    (existing.startDate?.getTime() ?? null) !== (startDateValue?.getTime() ?? null) && "startDate",
    !same(existing.estimatedPrice, estimatedPriceValue) && "estimatedPrice",
    !same(existing.origin, input.origin.trim() || null) && "origin",
    !same(existing.predecessorDocument, input.predecessorDocument.trim() || null) && "predecessorDocument",
    existing.scoringEnabled !== input.scoringEnabled && "scoringEnabled",
  ].filter((f): f is string => Boolean(f));
  const signature = (list: { name?: string; text?: string; quantity?: number; unit?: string | null }[]) =>
    JSON.stringify(list.map((x) => [x.name ?? x.text ?? "", x.quantity ?? 0, x.unit ?? ""]));
  if (signature(existing.items) !== signature(items)) changedFields.push("items");
  if (signature(existing.questions) !== signature(questions)) changedFields.push("questions");
  if (changedFields.length > 0) await logRfpEvent(rfpId, user.id, "EDITED", { fields: changedFields });

  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      title,
      description: input.description.trim(),
      internalNotes: internalNotes || null,
      tags: extractTags(internalNotes),
      buyerName,
      deadlineAt: zonedTimeToUtc(input.deadlineAt, user.timezone),
      status,
      publishedAt:
        status === "OPEN" || status === "AWAITING_START" ? new Date() : null,
      // No start date: the publication date is used.
      commodity: input.commodity.trim() || null,
      region: input.region.trim() || null,
      startDate:
        startDateValue ?? (status === "OPEN" || status === "AWAITING_START" ? new Date() : null),
      estimatedPrice: estimatedPriceValue,
      origin: input.origin.trim() || null,
      predecessorDocument: input.predecessorDocument.trim() || null,
      basedOnRfpId: input.basedOnRfpId || null,
      selectedTemplateId: input.selectedTemplateId || null,
      scoringEnabled: input.scoringEnabled,
      approvalWorkflowId: workflow?.id ?? null,
      hideResponsesUntilClosed: matchingTemplates.some((t) => t.hideResponsesUntilClosed),
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
  const removedItemIds = [...existingItemIds].filter((id) => !submittedItemIds.has(id));
  for (const id of removedItemIds) await prisma.rfpItem.delete({ where: { id } });
  await deleteCustomValues(clientId, "RFP_LINE", removedItemIds);
  for (const [order, { id, customValues, ...item }] of items.entries()) {
    let itemId: string;
    if (id && existingItemIds.has(id)) {
      await prisma.rfpItem.update({ where: { id }, data: { ...item, order } });
      itemId = id;
    } else {
      const created = await prisma.rfpItem.create({
        data: { ...item, order, rfpId, clientId },
      });
      itemId = created.id;
    }
    await saveCustomValues(clientId, "RFP_LINE", itemId, customValues);
  }
  await saveCustomValues(clientId, "RFP", rfpId, headerCustom);

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
      scoringConfig: q.scoringConfig,
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
      const created = await prisma.rfpQuestion.create({
        data: { ...data, rfpId, clientId },
      });
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
      const createdSupplier = await prisma.supplier.create({
        data: { ...supplier, clientId },
      });
      await prisma.invitation.create({
        data: { rfpId, supplierId: createdSupplier.id, clientId },
      });
    }
  }

  if (publishLevels.length > 0) {
    // A rejected earlier attempt may have left PUBLISH-stage rows behind —
    // clear them before starting a fresh chain.
    await prisma.rfpApproval.deleteMany({ where: { rfpId, stage: "PUBLISH" } });
    const { completed } = await startStage({
      rfpId,
      stage: "PUBLISH",
      levels: publishLevels,
      requiredValue: estimatedPriceValue ?? 0,
      requesterId: user.id,
    });
    if (completed) {
      await prisma.rfp.update({
        where: { id: rfpId },
        data: { status: resolveOpenStatus(startDateValue), publishedAt: new Date(), startDate: startDateValue ?? new Date() },
      });
    }
  }

  await sendPendingInvitations(rfpId);
  revalidatePath(`/rfps/${rfpId}`);
  redirect(`/rfps/${rfpId}`);
}

export async function approvePublish(rfpId: string) {
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "PENDING_PUBLISH_APPROVAL") {
    return { error: dictionary.rfpIdActions.notPendingApproval };
  }
  const result = await recordDecision({
    rfpId,
    stage: "PUBLISH",
    userId: user.id,
    decision: "APPROVED",
  });
  if (!result.ok) return { error: result.error };
  if (result.stageCompleted) {
    await prisma.rfp.update({
      where: { id: rfpId },
      data: { status: resolveOpenStatus(rfp.startDate), publishedAt: new Date(), startDate: rfp.startDate ?? new Date() },
    });
    await sendPendingInvitations(rfpId);
    await notifyCreatorOfStatusChange(rfpId, "published", { actorUserId: user.id });
  }
  revalidatePath(`/rfps/${rfpId}`);
}

export async function rejectPublish(rfpId: string, reason: string) {
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp || rfp.status !== "PENDING_PUBLISH_APPROVAL") {
    return { error: dictionary.rfpIdActions.notPendingApproval };
  }
  const result = await recordDecision({
    rfpId,
    stage: "PUBLISH",
    userId: user.id,
    decision: "REJECTED",
    reason,
  });
  if (!result.ok) return { error: result.error };
  await prisma.rfp.update({ where: { id: rfpId }, data: { status: "DRAFT" } });
  revalidatePath(`/rfps/${rfpId}`);
}

export async function sendApprovalReminder(rfpId: string, approvalId: string) {
  const user = await requireUser();
  const result = await sendReminder(approvalId, user.language);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/rfps/${rfpId}`);
  return { error: null };
}

// "Editar" on a published RFP: sends it back to draft so it can be edited again.
// The suppliers' responses are deleted (their invitations stay and get notified
// again on the next publication), the approval flow restarts and any award is
// cleared. A start date already in the past is cleared so it is filled with the
// new publication date.
export async function returnRfpToDraft(rfpId: string): Promise<{ error: string } | { success: true }> {
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const denied = await editDenied(user, rfpId, dictionary.rfpTeam.noEditPermission);
  if (denied) return { error: denied };
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId }, select: { status: true, startDate: true } });
  if (!rfp) return { error: dictionary.rfpIdActions.rfpNotFound };
  if (!["PENDING_PUBLISH_APPROVAL", "AWAITING_START", "OPEN", "CLOSED"].includes(rfp.status)) {
    return { error: dictionary.rfpIdActions.cannotReturnToDraft };
  }
  const responseCount = await prisma.response.count({ where: { invitation: { rfpId } } });
  await prisma.$transaction([
    prisma.response.deleteMany({ where: { invitation: { rfpId } } }),
    prisma.invitation.updateMany({
      where: { rfpId },
      data: { status: "INVITED", viewedAt: null, notifiedAt: null },
    }),
    prisma.rfpApproval.deleteMany({ where: { rfpId } }),
    prisma.rfp.update({
      where: { id: rfpId },
      data: {
        status: "DRAFT",
        publishedAt: null,
        closedAt: null,
        awardedInvitationId: null,
        awardedAt: null,
        awardCriteria: null,
        pendingAwardInvitationId: null,
        ...(rfp.startDate && rfp.startDate.getTime() <= Date.now() ? { startDate: null } : {}),
      },
    }),
  ]);
  await logRfpEvent(rfpId, user.id, "RETURNED_TO_DRAFT", { responses: responseCount });
  revalidatePath(`/rfps/${rfpId}`);
  revalidatePath("/");
  return { success: true };
}
