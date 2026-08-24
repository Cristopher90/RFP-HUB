"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, ROLE_LEVEL } from "@/lib/auth";
import { matchesTemplate } from "@/lib/templateMatch";
import { pickApprovalWorkflow, buildApprovalState } from "@/lib/approvalWorkflow";
import { canDecideApproval, parseApprovalState } from "@/lib/approvalState";

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
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp) return { error: "RFP no encontrada." };

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
          required: workflow.awardRequired,
          approverMode: workflow.awardApproverMode,
          minRole: workflow.awardMinRole,
          approverUserIds: workflow.awardApproverUserIds,
        }
      : null,
  );
  if (canDecideApproval(state, user, ROLE_LEVEL)) {
    state.status = "APPROVED";
    state.decidedAt = new Date().toISOString();
    state.decidedByUserId = user.id;
  }

  if (state.status === "APPROVED") {
    await prisma.rfp.update({
      where: { id: rfpId },
      data: {
        awardedInvitationId: invitationId,
        pendingAwardInvitationId: null,
        awardedAt: new Date(),
        awardCriteria: criteria,
        priceWeightPct,
        approvalWorkflowId: workflow?.id ?? null,
        awardApprovalState: JSON.stringify(state),
      },
    });
  } else {
    // Requiere aprobación: se propone la adjudicación sin confirmarla.
    await prisma.rfp.update({
      where: { id: rfpId },
      data: {
        pendingAwardInvitationId: invitationId,
        awardCriteria: criteria,
        priceWeightPct,
        approvalWorkflowId: workflow?.id ?? null,
        awardApprovalState: JSON.stringify(state),
      },
    });
  }
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
  return { status: state.status === "APPROVED" ? "AWARDED" : "PENDING" } as const;
}

export async function approveAward(rfpId: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp?.pendingAwardInvitationId) {
    return { error: "No hay una adjudicación pendiente de aprobación." };
  }
  const state = parseApprovalState(rfp.awardApprovalState);
  if (!canDecideApproval(state, user, ROLE_LEVEL)) {
    return { error: "No tienes permiso para aprobar esta adjudicación." };
  }
  const updated = {
    ...state!,
    status: "APPROVED" as const,
    decidedAt: new Date().toISOString(),
    decidedByUserId: user.id,
  };
  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      awardedInvitationId: rfp.pendingAwardInvitationId,
      pendingAwardInvitationId: null,
      awardedAt: new Date(),
      awardApprovalState: JSON.stringify(updated),
    },
  });
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
}

export async function rejectAward(rfpId: string) {
  const user = await requireUser();
  const rfp = await prisma.rfp.findUnique({ where: { id: rfpId } });
  if (!rfp?.pendingAwardInvitationId) {
    return { error: "No hay una adjudicación pendiente de aprobación." };
  }
  const state = parseApprovalState(rfp.awardApprovalState);
  if (!canDecideApproval(state, user, ROLE_LEVEL)) {
    return { error: "No tienes permiso para rechazar esta adjudicación." };
  }
  const updated = {
    ...state!,
    status: "REJECTED" as const,
    decidedAt: new Date().toISOString(),
    decidedByUserId: user.id,
  };
  await prisma.rfp.update({
    where: { id: rfpId },
    data: {
      pendingAwardInvitationId: null,
      awardApprovalState: JSON.stringify(updated),
    },
  });
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
}

export async function revokeAward(rfpId: string) {
  await prisma.rfp.update({
    where: { id: rfpId },
    data: { awardedInvitationId: null, awardedAt: null, awardApprovalState: null },
  });
  revalidatePath(`/rfps/${rfpId}/compare`);
  revalidatePath(`/rfps/${rfpId}`);
}
