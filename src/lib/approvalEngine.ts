import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import type { ApprovalStageKind, ApproverMode } from "@/generated/prisma/enums";

export type LevelConfig = {
  mode: ApproverMode;
  userIds: string | null; // JSON string[]
  approvalGroupId: string | null;
  cumulative: boolean;
};

type ApprovalRow = {
  id: string;
  rfpId: string;
  stage: ApprovalStageKind;
  order: number;
  mode: ApproverMode;
  userIds: string | null;
  approvalGroupId: string | null;
  cumulative: boolean;
  requiredValue: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

// A user may hold a different approval limit per group (e.g. "Aprobador IT"
// up to $500 and "Aprobador Compras" up to $999,999) — never a single flat
// limit across every group they belong to.
type DeciderUser = {
  id: string;
  groups: { approvalGroupId: string; limit: number }[];
};

async function loadDeciderUser(userId: string): Promise<DeciderUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { approvalGroups: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    groups: user.approvalGroups.map((g) => ({
      approvalGroupId: g.approvalGroupId,
      limit: g.limit,
    })),
  };
}

// Picks the first matched template (in match order — same "first match
// wins" convention already used for item/question application via
// matchesTemplate) that has an active approval workflow assigned.
export function pickApprovalWorkflow<
  T extends {
    approvalWorkflow:
      | { active: boolean; levels: { stage: ApprovalStageKind; order: number }[] }
      | null;
  },
>(matchingTemplates: T[]): NonNullable<T["approvalWorkflow"]> | null {
  for (const t of matchingTemplates) {
    if (t.approvalWorkflow?.active) return t.approvalWorkflow;
  }
  return null;
}

export function levelsForStage(
  workflow: {
    levels: {
      stage: ApprovalStageKind;
      order: number;
      mode: ApproverMode;
      userIds: string | null;
      approvalGroupId: string | null;
      cumulative: boolean;
    }[];
  } | null,
  stage: ApprovalStageKind,
): LevelConfig[] {
  if (!workflow) return [];
  return workflow.levels
    .filter((l) => l.stage === stage)
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      mode: l.mode,
      userIds: l.userIds,
      approvalGroupId: l.approvalGroupId,
      cumulative: l.cumulative,
    }));
}

// The lowest limit, among group members who have NOT yet approved this
// level, that must decide next — null once everyone has already approved
// (shouldn't happen in practice: the level would already be APPROVED by
// then). Acumulativo approval is an ascending chain: $1,000 must approve
// before $2,000 gets a turn, even if $2,000 alone would already cover the
// RFP's value, so the sum genuinely reflects everyone who had to sign off
// in order, not just whoever got there first.
async function nextCumulativeApproverLimit(
  approvalId: string,
  approvalGroupId: string,
): Promise<number | null> {
  const [members, approvedDecisions] = await Promise.all([
    prisma.userApprovalGroup.findMany({ where: { approvalGroupId } }),
    prisma.rfpApprovalDecision.findMany({
      where: { approvalId, decision: "APPROVED" },
    }),
  ]);
  const approvedUserIds = new Set(approvedDecisions.map((d) => d.userId));
  const remaining = members.filter((m) => !approvedUserIds.has(m.userId));
  if (remaining.length === 0) return null;
  return Math.min(...remaining.map((m) => m.limit));
}

// Eligibility check shared by the UI (show/hide Aprobar/Rechazar) and the
// action layer (authoritative gate) — must never drift between the two.
export async function canDecide(
  approval: Pick<
    ApprovalRow,
    "id" | "mode" | "userIds" | "approvalGroupId" | "cumulative" | "requiredValue"
  >,
  user: DeciderUser,
): Promise<boolean> {
  if (approval.mode === "USERS") {
    const ids = approval.userIds ? (JSON.parse(approval.userIds) as string[]) : [];
    return ids.includes(user.id);
  }
  // GROUP — the caller's limit is specific to *this* group, not a flat
  // per-user value, so an unrelated group membership never qualifies them.
  const membership = user.groups.find((g) => g.approvalGroupId === approval.approvalGroupId);
  if (!membership) return false;
  if (!approval.cumulative) return membership.limit >= approval.requiredValue;

  const nextLimit = await nextCumulativeApproverLimit(
    approval.id,
    approval.approvalGroupId ?? "",
  );
  if (nextLimit === null) return false;
  return membership.limit === nextLimit;
}

// A user may only decide once per level — otherwise a cumulative GROUP
// level could be "completed" by the same approver clicking Aprobar twice
// instead of two distinct group members reaching the required sum.
async function hasAlreadyDecided(approvalId: string, userId: string) {
  const existing = await prisma.rfpApprovalDecision.findFirst({
    where: { approvalId, userId },
  });
  return Boolean(existing);
}

// Convenience for pages: "can this user decide on the currently-active
// level of this stage right now?"
export async function canDecideActiveLevel(
  rfpId: string,
  stage: ApprovalStageKind,
  userId: string,
): Promise<boolean> {
  const { active, rejected } = await getActiveApproval(rfpId, stage);
  if (rejected || !active) return false;
  const user = await loadDeciderUser(userId);
  if (!user) return false;
  if (!(await canDecide(active, user))) return false;
  if (await hasAlreadyDecided(active.id, user.id)) return false;
  return true;
}

async function getActiveApproval(rfpId: string, stage: ApprovalStageKind) {
  const approvals = await prisma.rfpApproval.findMany({
    where: { rfpId, stage },
    orderBy: { order: "asc" },
  });
  const rejected = approvals.some((a) => a.status === "REJECTED");
  const active = rejected ? null : (approvals.find((a) => a.status === "PENDING") ?? null);
  return { approvals, active, rejected };
}

// Creates one RfpApproval row per level (re-sequenced 0..n-1 so gaps in the
// configured `order` never matter), stamping activatedAt on the first level
// only (later levels get it once they actually become active), and
// auto-decides on behalf of the requester through as many leading levels as
// they qualify for, so a sufficiently-authorized requester doesn't have to
// approve their own request in a second click.
export async function startStage(params: {
  rfpId: string;
  stage: ApprovalStageKind;
  levels: LevelConfig[];
  requiredValue: number;
  requesterId: string;
}): Promise<{ completed: boolean }> {
  const { rfpId, stage, levels, requiredValue, requesterId } = params;
  if (levels.length === 0) return { completed: true };

  const rfp = await prisma.rfp.findUniqueOrThrow({
    where: { id: rfpId },
    select: { clientId: true },
  });

  const now = new Date();
  await prisma.rfpApproval.createMany({
    data: levels.map((lvl, order) => ({
      clientId: rfp.clientId,
      rfpId,
      stage,
      order,
      mode: lvl.mode,
      userIds: lvl.userIds,
      approvalGroupId: lvl.approvalGroupId,
      cumulative: lvl.cumulative,
      requiredValue,
      activatedAt: order === 0 ? now : null,
    })),
  });

  for (let i = 0; i < levels.length; i++) {
    const result = await recordDecision({
      rfpId,
      stage,
      userId: requesterId,
      decision: "APPROVED",
    });
    if (!result.ok) break;
    if (result.stageCompleted) return { completed: true };
  }
  const remaining = await prisma.rfpApproval.count({
    where: { rfpId, stage, status: { not: "APPROVED" } },
  });
  return { completed: remaining === 0 };
}

export async function recordDecision(input: {
  rfpId: string;
  stage: ApprovalStageKind;
  userId: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
}): Promise<{ ok: true; stageCompleted: boolean } | { ok: false; error: string }> {
  const { rfpId, stage, userId, decision, reason } = input;

  const user = await loadDeciderUser(userId);
  if (!user) return { ok: false, error: "Usuario no encontrado." };

  const { active, rejected } = await getActiveApproval(rfpId, stage);
  if (rejected) return { ok: false, error: "Esta etapa ya fue rechazada." };
  if (!active) return { ok: false, error: "No hay ningún nivel pendiente de aprobación." };
  if (!(await canDecide(active, user))) {
    return { ok: false, error: "No tienes permiso para decidir sobre este nivel." };
  }
  if (await hasAlreadyDecided(active.id, userId)) {
    return { ok: false, error: "Ya registraste una decisión para este nivel." };
  }

  if (decision === "REJECTED") {
    if (!reason || !reason.trim()) {
      return { ok: false, error: "Debes indicar un motivo de rechazo." };
    }
    await prisma.rfpApprovalDecision.create({
      data: {
        clientId: active.clientId,
        approvalId: active.id,
        userId,
        decision: "REJECTED",
        reason: reason.trim(),
      },
    });
    await prisma.rfpApproval.update({
      where: { id: active.id },
      data: { status: "REJECTED", rejectedReason: reason.trim() },
    });
    return { ok: true, stageCompleted: false };
  }

  await prisma.rfpApprovalDecision.create({
    data: { clientId: active.clientId, approvalId: active.id, userId, decision: "APPROVED" },
  });

  let levelDone = true;
  if (active.mode === "GROUP" && active.cumulative) {
    const approvedDecisions = await prisma.rfpApprovalDecision.findMany({
      where: { approvalId: active.id, decision: "APPROVED" },
    });
    const approvedUserIds = approvedDecisions.map((d) => d.userId);
    const memberships = await prisma.userApprovalGroup.findMany({
      where: {
        approvalGroupId: active.approvalGroupId ?? "",
        userId: { in: approvedUserIds },
      },
    });
    const limitByUserId = new Map(memberships.map((m) => [m.userId, m.limit]));
    const sum = approvedUserIds.reduce((acc, id) => acc + (limitByUserId.get(id) ?? 0), 0);
    levelDone = sum >= active.requiredValue;
  }

  if (levelDone) {
    await prisma.rfpApproval.update({
      where: { id: active.id },
      data: { status: "APPROVED" },
    });
    // Activate the next level in the chain, if any — its "pending since"
    // clock starts now, not back when the whole stage was first triggered.
    const next = await prisma.rfpApproval.findFirst({
      where: { rfpId, stage, order: active.order + 1 },
    });
    if (next && !next.activatedAt) {
      await prisma.rfpApproval.update({
        where: { id: next.id },
        data: { activatedAt: new Date() },
      });
    }
  }

  const remaining = await prisma.rfpApproval.count({
    where: { rfpId, stage, status: { not: "APPROVED" } },
  });
  return { ok: true, stageCompleted: remaining === 0 };
}

// Records a reminder nudge on a still-pending level. No email/notification
// system exists in this app — this only stamps lastReminderAt so the chip
// popover can show "recordatorio enviado hace X".
export async function sendReminder(
  approvalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const approval = await prisma.rfpApproval.findUnique({ where: { id: approvalId } });
  if (!approval) return { ok: false, error: "Nivel no encontrado." };
  if (approval.status !== "PENDING") {
    return { ok: false, error: "Este nivel ya no está pendiente." };
  }
  await prisma.rfpApproval.update({
    where: { id: approvalId },
    data: { lastReminderAt: new Date() },
  });
  return { ok: true };
}

// Homepage "pendientes de validar": every (rfpId, stage) pair with a
// currently-active PENDING level the given user is eligible to decide.
// Small demo-scale dataset — fetches everything and groups in memory
// rather than trying to express "earliest pending, no rejected sibling"
// as a single SQL query.
export async function findPendingApprovalsForUser(userId: string) {
  const user = await loadDeciderUser(userId);
  if (!user) return [];

  const rows = await prisma.rfpApproval.findMany({
    include: { rfp: { select: { id: true, number: true, title: true } } },
    orderBy: { order: "asc" },
  });

  const byKey = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.rfpId}:${r.stage}`;
    const group = byKey.get(key);
    if (group) group.push(r);
    else byKey.set(key, [r]);
  }

  const results: {
    rfpId: string;
    rfpNumber: number;
    rfpTitle: string;
    stage: ApprovalStageKind;
    approvalId: string;
    createdAt: Date;
  }[] = [];
  for (const group of byKey.values()) {
    if (group.some((g) => g.status === "REJECTED")) continue;
    const active = group.find((g) => g.status === "PENDING");
    if (!active) continue;
    if (await canDecide(active, user)) {
      results.push({
        rfpId: active.rfpId,
        rfpNumber: active.rfp.number,
        rfpTitle: active.rfp.title,
        stage: active.stage,
        approvalId: active.id,
        createdAt: active.createdAt,
      });
    }
  }
  return results;
}

// Companion to findPendingApprovalsForUser: RFPs this user has already
// decided on (approve or reject), regardless of whether the stage since
// moved past them — so an approver keeps being able to consult an RFP
// after acting on it instead of it disappearing from their list.
export async function findDecidedRfpIdsForUser(userId: string): Promise<string[]> {
  const decisions = await prisma.rfpApprovalDecision.findMany({
    where: { userId },
    select: { approval: { select: { rfpId: true } } },
  });
  return [...new Set(decisions.map((d) => d.approval.rfpId))];
}

export type ApprovalLevelView = {
  id: string;
  order: number;
  label: string;
  cumulative: boolean;
  requiredValue: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectedReason: string | null;
  active: boolean;
  approverNames: string[];
  pendingSince: string | null;
  lastReminderAt: string | null;
  eligibleApprovers: { id: string; name: string; limit: number | null }[];
};

// Builds the display data for the header approval-flow chips: one row per
// level, with a human label (user names / group + threshold), which chip
// is currently "active" (awaiting a decision), and enough detail (who's
// eligible, since when, last reminder) to power the click-to-open popover.
export async function describeApprovals(
  rfpId: string,
  stage: ApprovalStageKind,
): Promise<ApprovalLevelView[]> {
  const approvals = await prisma.rfpApproval.findMany({
    where: { rfpId, stage },
    orderBy: { order: "asc" },
    include: { decisions: { include: { user: true } } },
  });
  if (approvals.length === 0) return [];

  const groupIds = [
    ...new Set(approvals.map((a) => a.approvalGroupId).filter((x): x is string => Boolean(x))),
  ];
  const groups = groupIds.length
    ? await prisma.approvalGroup.findMany({ where: { id: { in: groupIds } } })
    : [];
  const groupNameById = new Map(groups.map((g) => [g.id, g.description]));

  const memberships = groupIds.length
    ? await prisma.userApprovalGroup.findMany({
        where: { approvalGroupId: { in: groupIds } },
        include: { user: true },
      })
    : [];
  const membersByGroupId = new Map<
    string,
    { id: string; name: string; limit: number | null }[]
  >();
  for (const m of memberships) {
    const arr = membersByGroupId.get(m.approvalGroupId) ?? [];
    arr.push({ id: m.userId, name: m.user.name, limit: m.limit });
    membersByGroupId.set(m.approvalGroupId, arr);
  }

  const allUserIds = [
    ...new Set(
      approvals.flatMap((a) => (a.userIds ? (JSON.parse(a.userIds) as string[]) : [])),
    ),
  ];
  const users = allUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: allUserIds } } })
    : [];
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  const rejectedStage = approvals.some((a) => a.status === "REJECTED");
  let blocked = false;

  return approvals.map((a) => {
    const approvedUserIds = new Set(
      a.decisions.filter((d) => d.decision === "APPROVED").map((d) => d.userId),
    );
    const label =
      a.mode === "USERS"
        ? (a.userIds ? (JSON.parse(a.userIds) as string[]) : [])
            .map((id) => userNameById.get(id) ?? "?")
            .join(", ")
        : `${groupNameById.get(a.approvalGroupId ?? "") ?? "Grupo"}${
            a.cumulative
              ? " (acumulativo)"
              : ` (hasta ${formatCurrency(a.requiredValue)})`
          }`;
    const active = !blocked && a.status === "PENDING" && !rejectedStage;
    if (a.status !== "APPROVED") blocked = true;
    const groupMembers = membersByGroupId.get(a.approvalGroupId ?? "") ?? [];
    const eligibleApprovers =
      a.mode === "USERS"
        ? (a.userIds ? (JSON.parse(a.userIds) as string[]) : []).map((id) => ({
            id,
            name: userNameById.get(id) ?? "?",
            limit: null,
          }))
        : a.cumulative
          ? // Ascending chain: only whoever is tied for the lowest limit among
            // members who haven't approved yet gets to act next.
            (() => {
              const remaining = groupMembers.filter((m) => !approvedUserIds.has(m.id));
              if (remaining.length === 0) return [];
              const nextLimit = Math.min(...remaining.map((m) => m.limit ?? Infinity));
              return remaining.filter((m) => m.limit === nextLimit);
            })()
          : groupMembers;
    return {
      id: a.id,
      order: a.order,
      label,
      cumulative: a.cumulative,
      requiredValue: a.requiredValue,
      status: a.status,
      rejectedReason: a.rejectedReason,
      active,
      approverNames: a.decisions
        .filter((d) => d.decision === "APPROVED")
        .map((d) => d.user.name),
      pendingSince: a.activatedAt ? a.activatedAt.toISOString() : null,
      lastReminderAt: a.lastReminderAt ? a.lastReminderAt.toISOString() : null,
      eligibleApprovers,
    };
  });
}

export type ApprovalHistoryEntry = {
  stage: ApprovalStageKind;
  order: number;
  decision: "APPROVED" | "REJECTED";
  userName: string;
  reason: string | null;
  decidedAt: string;
};

// Flat, chronologically-sortable list of every approve/reject decision
// across both stages, for the RFP detail page's "Histórico" section.
export async function getApprovalHistory(rfpId: string): Promise<ApprovalHistoryEntry[]> {
  const approvals = await prisma.rfpApproval.findMany({
    where: { rfpId },
    include: { decisions: { include: { user: true } } },
    orderBy: [{ stage: "asc" }, { order: "asc" }],
  });
  const entries: ApprovalHistoryEntry[] = [];
  for (const a of approvals) {
    for (const d of a.decisions) {
      entries.push({
        stage: a.stage,
        order: a.order,
        decision: d.decision as "APPROVED" | "REJECTED",
        userName: d.user.name,
        reason: d.reason,
        decidedAt: d.decidedAt.toISOString(),
      });
    }
  }
  return entries.sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
}
