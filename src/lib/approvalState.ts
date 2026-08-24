import type { UserRole } from "@/generated/prisma/enums";

// Snapshotted onto Rfp.publishApprovalState / Rfp.awardApprovalState as
// JSON when an ApprovalWorkflow applies, so editing the workflow later
// doesn't retroactively change an in-flight RFP's requirement — same
// snapshot convention as Rfp.appliedTemplates.
export type ApprovalState = {
  required: boolean;
  mode: "ROLE" | "USERS";
  minRole?: UserRole;
  userIds?: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedAt?: string;
  decidedByUserId?: string;
};

export function parseApprovalState(raw: string | null): ApprovalState | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApprovalState;
  } catch {
    return null;
  }
}

export function canDecideApproval(
  state: ApprovalState | null,
  user: { id: string; role: UserRole },
  roleLevel: Record<UserRole, number>,
): boolean {
  if (!state || !state.required || state.status !== "PENDING") return false;
  if (state.mode === "USERS") {
    return (state.userIds ?? []).includes(user.id);
  }
  return roleLevel[user.role] >= roleLevel[state.minRole ?? "SENIOR_BUYER"];
}
