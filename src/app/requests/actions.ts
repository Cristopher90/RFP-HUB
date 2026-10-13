"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import {
  buyerGroupIdsOf,
  canAssignRequests,
  canImportRequests,
  visibilityWhere,
} from "@/lib/requestAccess";
import { deriveRequestStatus } from "@/lib/requestStatus";
import { BUYER_ROLES } from "@/lib/requestFields";
import type { ParsedDocument } from "@/lib/requestImport";
import {
  deleteCustomValues,
  loadCustomFields,
  saveCustomValues,
} from "@/lib/customFields";
import { coerceValue, type CustomFieldDef } from "@/lib/customFieldsShared";

const MAX_DOCUMENTS = 2000;
const MAX_LINES = 20000;

export type ImportResult =
  | { error: string }
  | {
      created: number;
      updated: number;
      skipped: number;
      failed: string[]; // document numbers that couldn't be saved
    };

function clean(value: unknown, max: number): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, max) : null;
}

// Raw custom values as sent by the client: short strings under short keys.
function cleanCustom(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 50)) {
    const v = clean(value, 500);
    if (v && /^[a-z0-9_]{1,40}$/.test(key)) out[key] = v;
  }
  return out;
}

// Keeps only the importable fields' values that fit their type.
function coerceCustom(fields: CustomFieldDef[], raw: Record<string, string> | undefined) {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = coerceValue(field, raw?.[field.key]);
    if (value !== "") out[field.key] = value;
  }
  return out;
}

function validDocuments(input: unknown): ParsedDocument[] | null {
  if (!Array.isArray(input)) return null;
  const result: ParsedDocument[] = [];
  for (const raw of input) {
    const doc = raw as Partial<ParsedDocument>;
    const documentNumber = clean(doc.documentNumber, 100);
    const documentType = clean(doc.documentType, 50);
    if (!documentNumber || !documentType || !Array.isArray(doc.lines)) return null;
    const requestDate =
      typeof doc.requestDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(doc.requestDate)
        ? doc.requestDate
        : null;
    const lines = [];
    for (const rawLine of doc.lines) {
      const line = rawLine as Partial<ParsedDocument["lines"][number]>;
      const description = clean(line.description, 500);
      const quantity = Number(line.quantity);
      if (!description || !Number.isFinite(quantity)) return null;
      const price =
        line.historicalPrice === null || line.historicalPrice === undefined
          ? null
          : Number(line.historicalPrice);
      lines.push({
        position: clean(line.position, 50) ?? String(lines.length + 1),
        itemCode: clean(line.itemCode, 100),
        description,
        historicalPrice: price !== null && Number.isFinite(price) ? price : null,
        quantity,
        unit: clean(line.unit, 50),
        commodity: clean(line.commodity, 200),
        customValues: cleanCustom(line.customValues),
      });
    }
    if (lines.length === 0) continue;
    result.push({
      documentNumber,
      documentType,
      creator: clean(doc.creator, 200),
      requestDate,
      commodity: clean(doc.commodity, 200),
      customValues: cleanCustom(doc.customValues),
      lines,
    });
  }
  return result;
}

export async function importPurchaseRequests(
  templateId: string,
  documents: unknown,
  targetClientId?: string,
): Promise<ImportResult> {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).requestsActions;
  if (!canImportRequests(user)) return { error: d.noPermission };
  const clientId = scope.isSuperAdmin ? targetClientId : user.clientId;
  if (!clientId) return { error: d.selectClient };

  const template = await prisma.requestImportTemplate.findFirst({
    where: { id: templateId, clientId },
    select: { id: true },
  });
  if (!template) return { error: d.templateNotFound };

  const docs = validDocuments(documents);
  if (!docs) return { error: d.invalidData };
  if (docs.length > MAX_DOCUMENTS || docs.reduce((n, x) => n + x.lines.length, 0) > MAX_LINES) {
    return { error: d.tooManyDocuments };
  }

  // Request custom fields flagged for import (header / line).
  const importable = (await loadCustomFields(clientId)).filter((f) => f.importable);
  const headFields = importable.filter((f) => f.scope === "REQUEST_HEAD");
  const lineFields = importable.filter((f) => f.scope === "REQUEST_LINE");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const doc of docs) {
    try {
      const requestDate = doc.requestDate ? new Date(`${doc.requestDate}T00:00:00.000Z`) : null;
      const lineCustom = doc.lines.map((l) => coerceCustom(lineFields, l.customValues));
      const headerCustom = coerceCustom(headFields, doc.customValues);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const lines = doc.lines.map(({ customValues: _cv, ...l }, order) => ({ ...l, order }));
      let requestId: string | null = null;
      let oldLineIds: string[] = [];
      const existing = await prisma.purchaseRequest.findUnique({
        where: {
          clientId_documentType_documentNumber: {
            clientId,
            documentType: doc.documentType,
            documentNumber: doc.documentNumber,
          },
        },
        include: { rfp: { select: { status: true, awardedInvitationId: true } } },
      });

      if (!existing) {
        const createdRequest = await prisma.purchaseRequest.create({
          data: {
            clientId,
            documentType: doc.documentType,
            documentNumber: doc.documentNumber,
            creator: doc.creator,
            requestDate,
            commodity: doc.commodity,
            importedByUserId: user.id,
            templateId: template.id,
            lines: { create: lines },
          },
        });
        requestId = createdRequest.id;
        created++;
      } else if (deriveRequestStatus(existing) === "NEW") {
        requestId = existing.id;
        oldLineIds = (
          await prisma.purchaseRequestLine.findMany({
            where: { requestId: existing.id },
            select: { id: true },
          })
        ).map((l) => l.id);
        await prisma.$transaction([
          prisma.purchaseRequestLine.deleteMany({ where: { requestId: existing.id } }),
          prisma.purchaseRequest.update({
            where: { id: existing.id },
            data: {
              creator: doc.creator,
              requestDate,
              commodity: doc.commodity,
              importedAt: new Date(),
              importedByUserId: user.id,
              templateId: template.id,
              rfpId: null, // a previously linked RFP was deleted
              lines: { create: lines },
            },
          }),
        ]);
        updated++;
      } else {
        skipped++;
      }
      if (requestId && (headFields.length > 0 || lineFields.length > 0 || oldLineIds.length > 0)) {
        await deleteCustomValues(clientId, "REQUEST_LINE", oldLineIds);
        await saveCustomValues(clientId, "REQUEST", requestId, headerCustom);
        const newLines = await prisma.purchaseRequestLine.findMany({
          where: { requestId },
          orderBy: { order: "asc" },
          select: { id: true },
        });
        for (const [idx, line] of newLines.entries()) {
          const values = lineCustom[idx] ?? {};
          if (Object.keys(values).length > 0) await saveCustomValues(clientId, "REQUEST_LINE", line.id, values);
        }
      }
    } catch (error) {
      console.error("[requests:import]", doc.documentNumber, error);
      failed.push(doc.documentNumber);
    }
  }

  revalidatePath("/requests");
  return { created, updated, skipped, failed };
}

export type AssignTarget = { kind: "user" | "group"; id: string } | { kind: "none" };

// Loads a request the current user may act on, within their client scope and
// visibility. Returns null when it doesn't exist or isn't theirs to see.
async function loadAccessibleRequest(requestId: string) {
  const scope = await requireClientScope();
  const { user } = scope;
  const groupIds = await buyerGroupIdsOf(user.id);
  const request = await prisma.purchaseRequest.findFirst({
    where: {
      id: requestId,
      ...(scope.isSuperAdmin ? {} : { clientId: user.clientId as string }),
      ...visibilityWhere(user, groupIds),
    },
    include: { rfp: { select: { status: true, awardedInvitationId: true } } },
  });
  return { scope, user, request };
}

export async function assignRequest(
  requestId: string,
  target: AssignTarget,
): Promise<{ error: string } | { success: true }> {
  const { user, request } = await loadAccessibleRequest(requestId);
  const d = getDictionary(user.language).requestsActions;
  if (!canAssignRequests(user)) return { error: d.noPermission };
  if (!request) return { error: d.requestNotFound };
  const status = deriveRequestStatus(request);
  if (status !== "NEW" && status !== "PROCESSED") return { error: d.cannotChangeAssignment };

  let assignedUserId: string | null = null;
  let assignedGroupId: string | null = null;
  if (target.kind === "user") {
    const buyer = await prisma.user.findFirst({
      where: {
        id: target.id,
        clientId: request.clientId,
        role: { in: [...BUYER_ROLES] },
      },
      select: { id: true },
    });
    if (!buyer) return { error: d.invalidAssignee };
    assignedUserId = buyer.id;
  } else if (target.kind === "group") {
    const group = await prisma.buyerGroup.findFirst({
      where: { id: target.id, clientId: request.clientId },
      select: { id: true },
    });
    if (!group) return { error: d.invalidAssignee };
    assignedGroupId = group.id;
  }

  await prisma.purchaseRequest.update({
    where: { id: request.id },
    data: { assignedUserId, assignedGroupId },
  });
  revalidatePath("/requests");
  return { success: true };
}

export async function setRequestCancelled(
  requestId: string,
  cancelled: boolean,
): Promise<{ error: string } | { success: true }> {
  const { user, request } = await loadAccessibleRequest(requestId);
  const d = getDictionary(user.language).requestsActions;
  if (!canAssignRequests(user)) return { error: d.noPermission };
  if (!request) return { error: d.requestNotFound };
  const status = deriveRequestStatus(request);
  if (cancelled ? status !== "NEW" : status !== "CANCELLED") return { error: d.cannotCancel };

  await prisma.purchaseRequest.update({ where: { id: request.id }, data: { cancelled } });
  revalidatePath("/requests");
  return { success: true };
}
