"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";

export type ApproverMode = "USERS" | "GROUP" | "SUPERIOR";
export type ApprovalStageKind = "PUBLISH" | "AWARD";

export type ApprovalLevelInput = {
  stage: ApprovalStageKind;
  mode: ApproverMode;
  userIds: string[]; // mode = USERS
  approvalGroupId: string; // mode = GROUP
  cumulative: boolean; // mode = GROUP o SUPERIOR
};

export type ApprovalWorkflowInput = {
  name: string;
  description: string;
  active: boolean;
  sequence: number; // 0 a 999: orden en que se recorren los procesos que aplican a una RFP
  appliesToAll: boolean; // aplica a todas las RFPs, sin depender de la plantilla
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
      cumulative: l.mode === "GROUP" || l.mode === "SUPERIOR" ? l.cumulative : false,
    })),
  );
}

// Only templates of the same client can be assigned.
async function templatesOfClient(templateIds: string[], clientId: string) {
  const found = await prisma.rfpTemplate.findMany({
    where: { id: { in: templateIds }, clientId },
    select: { id: true },
  });
  return found;
}

function validSequence(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 999;
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
  if (!validSequence(input.sequence)) return { error: dictionary.approvalsActions.sequenceInvalid };
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: dictionary.approvalsActions.selectClientForWorkflow };

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      clientId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      active: input.active,
      sequence: input.sequence,
      appliesToAll: input.appliesToAll,
    },
  });
  await prisma.approvalLevel.createMany({
    data: shapeLevels(input.levels, workflow.id, clientId),
  });
  await prisma.approvalWorkflow.update({
    where: { id: workflow.id },
    data: { templates: { set: await templatesOfClient(input.templateIds, clientId) } },
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
  if (!validSequence(input.sequence)) return { error: dictionary.approvalsActions.sequenceInvalid };

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
      sequence: input.sequence,
      appliesToAll: input.appliesToAll,
    },
  });
  // Niveles: reemplazo total (mismo patrón que artículos/preguntas de plantilla).
  await prisma.approvalLevel.deleteMany({ where: { workflowId: id } });
  await prisma.approvalLevel.createMany({
    data: shapeLevels(input.levels, id, clientId),
  });
  // Plantillas: una plantilla puede tener varios procesos, así que solo se
  // cambia la lista de este proceso; los demás procesos no se tocan.
  await prisma.approvalWorkflow.update({
    where: { id },
    data: { templates: { set: await templatesOfClient(input.templateIds, clientId) } },
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
  await prisma.approvalWorkflow.delete({ where: { id } });
  revalidatePath("/admin/approvals");
  // A Super Administrador goes back to the same client's list.
  redirect(scope.isSuperAdmin ? `/admin/approvals?clientId=${existing.clientId}` : "/admin/approvals");
}
