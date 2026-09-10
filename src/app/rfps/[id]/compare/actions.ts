"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  matchesTemplate,
  resolveAppliedTemplates,
  ancestorChain,
} from "@/lib/templateMatch";
import {
  pickApprovalWorkflow,
  levelsForStage,
  startStage,
  recordDecision,
  sendReminder,
} from "@/lib/approvalEngine";
import { addAwardedItemsToCatalog } from "@/lib/itemCatalog";
import { getDictionary } from "@/i18n/getDictionary";

export type AwardCriteria = "ITEMS" | "QUESTIONS" | "WEIGHTED" | "PRICE";

export async function scoreAnswer(
  rfpId: string,
  answerId: string,
  score: number | null,
) {
  const clamped =
    score === null ? null : Math.min(10, Math.max(0, Math.round(score)));
  await prisma.answer.update({
    where: { id: answerId },
    data: { score: clamped },
  });
  revalidatePath(`/rfps/${rfpId}/compare`);
}

export async function awardInvitation(
  rfpId: string,
  invitationId: string,
  criteria: AwardCriteria,
  priceWeightPct: number,
) {
  const user = await requireUser();
  const dictionary = getDictionary(user.language);
  const rfp = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: { items: true },
  });
  if (!rfp) return { error: dictionary.compareActions.rfpNotFound };

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { response: { include: { itemPrices: true } } },
  });
  if (!invitation?.response) return { error: dictionary.compareActions.invitationNotFound };

  // "El valor que se adjudicó": el total cotizado por el proveedor propuesto.
  const awardedValue = rfp.items.reduce((sum, item) => {
    const price = invitation.response!.itemPrices.find((p) => p.itemId === item.id);
    return sum + (price ? price.unitPrice * item.quantity : 0);
  }, 0);

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
  const matchingTemplates = resolveAppliedTemplates(
    allTemplates.filter((t) =>
      matchesTemplate(t, commodityChain, regionChain, rfp.estimatedPrice),
    ),
    rfp.selectedTemplateId,
  );

  const workflow = pickApprovalWorkflow(matchingTemplates);
  const levels = levelsForStage(workflow, "AWARD");

  // A rejected earlier proposal may have left AWARD-stage rows behind.
  await prisma.rfpApproval.deleteMany({ where: { rfpId, stage: "AWARD" } });

  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      pendingAwardInvitationId: invitationId,
      awardCriteria: criteria,
      priceWeightPct,
      approvalWorkflowId: workflow?.id ?? null,
    },
  });

  const completed =
    levels.length === 0
      ? true
      : (
          await startStage({
            rfpId,
            stage: "AWARD",
            levels,
            requiredValue: awardedValue,
            requesterId: user.id,
          })
        ).completed;

  if (completed) {
    await prisma.rfp.update({
      where: { id: rfpId },
      data: {
        awardedInvitationId: invitationId,
        pendingAwardInvitationId: null,
        awardedAt: new Date(),
      },
    });
  }
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
  return { status: completed ? "AWARDED" : "PENDING" } as const;
}

export async function approveAward(rfpId: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp?.pendingAwardInvitationId) {
    return { error: getDictionary(user.language).compareActions.noPendingAwardApproval };
  }
  const result = await recordDecision({
    rfpId,
    stage: "AWARD",
    userId: user.id,
    decision: "APPROVED",
  });
  if (!result.ok) return { error: result.error };
  const awardedInvitationId = rfp.pendingAwardInvitationId;
  if (result.stageCompleted) {
    await prisma.rfp.update({
      where: { id: rfpId },
      data: {
        awardedInvitationId,
        pendingAwardInvitationId: null,
        awardedAt: new Date(),
      },
    });
  }
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
  return {
    completed: result.stageCompleted,
    invitationId: awardedInvitationId,
  } as const;
}

export async function rejectAward(rfpId: string, reason: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp?.pendingAwardInvitationId) {
    return { error: getDictionary(user.language).compareActions.noPendingAwardApproval };
  }
  const result = await recordDecision({
    rfpId,
    stage: "AWARD",
    userId: user.id,
    decision: "REJECTED",
    reason,
  });
  if (!result.ok) return { error: result.error };
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { pendingAwardInvitationId: null },
  });
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
}

export async function revokeAward(rfpId: string) {
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { awardedInvitationId: null, awardedAt: null },
  });
  await prisma.rfpApproval.deleteMany({ where: { rfpId, stage: "AWARD" } });
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
}

export async function sendApprovalReminder(rfpId: string, approvalId: string) {
  const user = await requireUser();
  const result = await sendReminder(approvalId, user.language);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/rfps/${rfpId}/compare`);
  return { error: null };
}

export async function confirmAddToCatalog(
  rfpId: string,
  invitationId: string,
  catalogName: string,
) {
  const user = await requireUser();
  const result = await addAwardedItemsToCatalog(rfpId, invitationId, catalogName, user.language);
  if ("error" in result) return result;
  revalidatePath("/rfps/new");
  return result;
}
