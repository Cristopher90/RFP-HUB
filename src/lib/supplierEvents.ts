import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type SupplierEventKind =
  | "INITIAL_BLOCK"
  | "EDITED"
  | "BLOCKED"
  | "UNBLOCKED"
  | "DOCUMENT_DELETED"
  | "CONTACT_BLOCKED"
  | "CONTACT_UNBLOCKED";

// Records a change in a supplier's history. Never breaks the action that caused it.
export async function logSupplierEvent(
  supplierDirectoryId: string,
  userId: string | null,
  kind: SupplierEventKind,
  detail?: Record<string, unknown>,
) {
  try {
    await prisma.supplierEvent.create({
      data: { supplierDirectoryId, userId, kind, ...(detail ? { detail: detail as Prisma.InputJsonValue } : {}) },
    });
  } catch (error) {
    console.error("[supplier:event]", kind, error);
  }
}
