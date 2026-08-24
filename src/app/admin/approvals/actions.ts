"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

export type ApproverMode = "ROLE" | "USERS";

export type ApprovalWorkflowInput = {
  name: string;
  description: string;
  active: boolean;
  publishRequired: boolean;
  publishApproverMode: ApproverMode;
  publishMinRole: UserRole;
  publishApproverUserIds: string[];
  awardRequired: boolean;
  awardApproverMode: ApproverMode;
  awardMinRole: UserRole;
  awardApproverUserIds: string[];
  templateIds: string[];
};

function shape(input: ApprovalWorkflowInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim() || null,
    active: input.active,
    publishRequired: input.publishRequired,
    publishApproverMode: input.publishApproverMode,
    publishMinRole: input.publishMinRole,
    publishApproverUserIds:
      input.publishApproverMode === "USERS"
        ? JSON.stringify(input.publishApproverUserIds)
        : null,
    awardRequired: input.awardRequired,
    awardApproverMode: input.awardApproverMode,
    awardMinRole: input.awardMinRole,
    awardApproverUserIds:
      input.awardApproverMode === "USERS"
        ? JSON.stringify(input.awardApproverUserIds)
        : null,
  };
}

export async function createApprovalWorkflow(
  input: ApprovalWorkflowInput,
): Promise<{ error: string } | never> {
  await requireRole("ADMIN");
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const workflow = await prisma.approvalWorkflow.create({ data: shape(input) });
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

  await prisma.approvalWorkflow.update({ where: { id }, data: shape(input) });
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
