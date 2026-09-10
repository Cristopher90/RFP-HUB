"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";

export type ApproverMode = "USERS" | "GROUP";
export type ApprovalStageKind = "PUBLISH" | "AWARD";

export type ApprovalLevelInput = {
  stage: ApprovalStageKind;
  mode: ApproverMode;
  userIds: string[]; // mode = USERS
  approvalGroupId: string; // mode = GROUP
  cumulative: boolean; // mode = GROUP
};

export type ApprovalWorkflowInput = {
  name: string;
  description: string;
  active: boolean;
  levels: ApprovalLevelInput[]; // order within each stage = array order
  templateIds: string[];
};

function shapeLevels(
  levels: ApprovalLevelInput[],
  workflowId: string,
  clientId: string,
) {
  const byStage: Record<ApprovalStageKind, ApprovalLevelInput[]> = {
    PUBLISH: [],
    AWARD: [],
  };
  for (const l of levels) byStage[l.stage].push(l);

  return (Object.keys(byStage) as ApprovalStageKind[]).flatMap((stage) =>
    byStage[stage].map((l, order) => ({
      clientId,
      workflowId,
      stage,
      order,
      mode: l.mode,
      userIds: l.mode === "USERS" ? JSON.stringify(l.userIds) : null,
      approvalGroupId: l.mode === "GROUP" ? l.approvalGroupId : null,
      cumulative: l.mode === "GROUP" ? l.cumulative : false,
    })),
  );
}

async function requireApprovalsScope() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  return scope;
}

export async function createApprovalWorkflow(
  input: ApprovalWorkflowInput,
  targetClientId?: string,
): Promise<{ error: string } | never> {
  const scope = await requireApprovalsScope();
  const dictionary = getDictionary(scope.user.language);
  if (!input.name.trim()) return { error: dictionary.approvalsActions.nameRequired };
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: dictionary.approvalsActions.selectClientForWorkflow };

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      clientId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      active: input.active,
    },
  });
  await prisma.approvalLevel.createMany({
    data: shapeLevels(input.levels, workflow.id, clientId),
  });
  await prisma.rfpTemplate.updateMany({
    where: { id: { in: input.templateIds }, clientId },
    data: { approvalWorkflowId: workflow.id },
  });
  revalidatePath("/admin/approvals");
  redirect(`/admin/approvals/${workflow.id}`);
}

export async function updateApprovalWorkflow(
  id: string,
  input: ApprovalWorkflowInput,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireApprovalsScope();
  const dictionary = getDictionary(scope.user.language);
  if (!input.name.trim()) return { error: dictionary.approvalsActions.nameRequired };

  const existing = await prisma.approvalWorkflow.findUnique({ where: { id } });
  if (!existing) return { error: dictionary.approvalsActions.workflowNotFound };
  if (!scope.isSuperAdmin && existing.clientId !== scope.user.clientId) {
    return { error: dictionary.approvalsActions.cannotEditOtherClientWorkflow };
  }
  const clientId = existing.clientId;

  await prisma.approvalWorkflow.update({
    where: { id },
    data: {
      name: input.name.trim(),
      description: input.description.trim() || null,
      active: input.active,
    },
  });
  // Niveles: reemplazo total (mismo patrón que artículos/preguntas de plantilla).
  await prisma.approvalLevel.deleteMany({ where: { workflowId: id } });
  await prisma.approvalLevel.createMany({
    data: shapeLevels(input.levels, id, clientId),
  });
  // Reasignar plantillas: las que ya no están seleccionadas se sueltan.
  await prisma.rfpTemplate.updateMany({
    where: { approvalWorkflowId: id },
    data: { approvalWorkflowId: null },
  });
  await prisma.rfpTemplate.updateMany({
    where: { id: { in: input.templateIds }, clientId },
    data: { approvalWorkflowId: id },
  });
  revalidatePath("/admin/approvals");
  revalidatePath(`/admin/approvals/${id}`);
  return { success: true };
}

export async function deleteApprovalWorkflow(id: string) {
  const scope = await requireApprovalsScope();
  const existing = await prisma.approvalWorkflow.findUnique({ where: { id } });
  if (!existing) redirect("/admin/approvals");
  if (!scope.isSuperAdmin && existing.clientId !== scope.user.clientId) {
    redirect("/admin/approvals");
  }
  await prisma.rfpTemplate.updateMany({
    where: { approvalWorkflowId: id },
    data: { approvalWorkflowId: null },
  });
  await prisma.approvalWorkflow.delete({ where: { id } });
  revalidatePath("/admin/approvals");
  redirect("/admin/approvals");
}
