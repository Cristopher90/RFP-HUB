import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type RfpEventKind =
  | "TEAM_ADDED"
  | "TEAM_REMOVED"
  | "TEAM_PERMISSION"
  | "EDITED"
  | "RETURNED_TO_DRAFT"
  | "REOPENED"
  | "SUPPLIER_INVITED"
  | "AWARD_REVOKED";

// Records a change in the RFP's history. Never breaks the action that caused it.
export async function logRfpEvent(
  rfpId: string,
  userId: string | null,
  kind: RfpEventKind,
  detail?: Record<string, unknown>,
) {
  try {
    await prisma.rfpEvent.create({
      data: { rfpId, userId, kind, ...(detail ? { detail: detail as Prisma.InputJsonValue } : {}) },
    });
  } catch (error) {
    console.error("[rfp:event]", kind, error);
  }
}
