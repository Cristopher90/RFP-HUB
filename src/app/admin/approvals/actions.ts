"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

export type ApproverMode = "ROLE" | "USERS" | "GROUP";
export type ApprovalStageKind = "PUBLISH" | "AWARD";

export type ApprovalLevelInput = {
  stage: ApprovalStageKind;
  mode: ApproverMode;
  minRole: UserRole; // mode = ROLE
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

function shapeLevels(levels: ApprovalLevelInput[], workflowId: string) {
  const byStage: Record<ApprovalStageKind, ApprovalLevelInput[]> = {
    PUBLISH: [],
    AWARD: [],
  };
  for (const l of levels) byStage[l.stage].push(l);

  return (Object.keys(byStage) as ApprovalStageKind[]).flatMap((stage) =>
    byStage[stage].map((l, order) => ({
      workflowId,
      stage,
      order,
      mode: l.mode,
      minRole: l.mode === "ROLE" ? l.minRole : null,
      userIds: l.mode === "USERS" ? JSON.stringify(l.userIds) : null,
      approvalGroupId: l.mode === "GROUP" ? l.approvalGroupId : null,
      cumulative: l.mode === "GROUP" ? l.cumulative : false,
    })),
  );
}

export async function createApprovalWorkflow(
  input: ApprovalWorkflowInput,
): Promise<{ error: string } | never> {
  await requireRole("ADMIN");
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      name: input.name.trim(),
      description: input.description.trim() || null,
      active: input.active,
    },
  });
  await prisma.approvalLevel.createMany({
    data: shapeLevels(input.levels, workflow.id),
  });
  await prisma.rfpTemplate.updateMany({
    where: { id: { in: input.templateIds } },
    data: { approvalWorkflowId: workflow.id },
  });
  revalidatePath("/admin/approvals");
  redirect(`/admin/approvals/${workflow.id}`);
}

export async function updateApprovalWorkflow(
  id: string,
  input: ApprovalWorkflowInput,
): Promise<{ error: string } | { success: true }> {
  await requireRole("ADMIN");
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

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
  await prisma.approvalLevel.createMany({ data: shapeLevels(input.levels, id) });
  // Reasignar plantillas: las que ya no están seleccionadas se sueltan.
  await prisma.rfpTemplate.updateMany({
    where: { approvalWorkflowId: id },
    data: { approvalWorkflowId: null },
  });
  await prisma.rfpTemplate.updateMany({
    where: { id: { in: input.templateIds } },
    data: { approvalWorkflowId: id },
  });
  revalidatePath("/admin/approvals");
  revalidatePath(`/admin/approvals/${id}`);
  return { success: true };
}

export async function deleteApprovalWorkflow(id: string) {
  await requireRole("ADMIN");
  await prisma.rfpTemplate.updateMany({
    where: { approvalWorkflowId: id },
    data: { approvalWorkflowId: null },
  });
  await prisma.approvalWorkflow.delete({ where: { id } });
  revalidatePath("/admin/approvals");
  redirect("/admin/approvals");
}
