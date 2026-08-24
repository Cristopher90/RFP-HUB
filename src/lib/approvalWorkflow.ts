import type { UserRole } from "@/generated/prisma/enums";
import type { ApprovalState } from "@/lib/approvalState";

type WorkflowStageFields = {
  required: boolean;
  approverMode: "ROLE" | "USERS";
  minRole: UserRole;
  approverUserIds: string | null;
};

// Picks the first matched template (in match order) that has an active
// approval workflow assigned. Templates are checked in the order the
// caller passes them — same "first match wins" convention already used
// for item/question application via matchesTemplate.
export function pickApprovalWorkflow<
  T extends { approvalWorkflow: { active: boolean } | null },
>(matchingTemplates: T[]): T["approvalWorkflow"] | null {
  for (const t of matchingTemplates) {
    if (t.approvalWorkflow?.active) return t.approvalWorkflow;
  }
  return null;
}

export function buildApprovalState(stage: WorkflowStageFields | null): ApprovalState {
  if (!stage || !stage.required) {
    return { required: false, mode: "ROLE", status: "APPROVED" };
  }
  const userIds = stage.approverUserIds
    ? (JSON.parse(stage.approverUserIds) as string[])
    : [];
  return {
    required: true,
    mode: stage.approverMode,
    minRole: stage.approverMode === "ROLE" ? stage.minRole : undefined,
    userIds: stage.approverMode === "USERS" ? userIds : undefined,
    status: "PENDING",
  };
}
