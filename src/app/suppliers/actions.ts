"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import {
  canAddSupplierContacts,
  canBlockSuppliers,
  canCreateSuppliers,
  canEditSuppliers,
  canManageSupplierDocs,
  canRateSuppliers,
} from "@/lib/supplierAccess";
import { addContact, sendHeldInvitations } from "@/lib/supplierContacts";
import { clientAi, researchSupplier, ResearchError } from "@/lib/supplierResearch";
import { canSeeByGroups } from "@/lib/viewGroups";
import { validViewGroupIds } from "@/lib/viewGroupsServer";
import { logSupplierEvent } from "@/lib/supplierEvents";
import { filterTreeByGroups } from "@/lib/viewGroups";
import { loadCustomFields, prepareCustomValues, readCustomValues, saveCustomValues } from "@/lib/customFields";
import { applyViewGroupsToFields, emptyContext, labelFor } from "@/lib/customFieldsShared";

type Result = { error: string } | { success: true };

// Loads a supplier the current user may act on: same client (a Super
// Administrador may act on any) and visible through their view groups.
async function loadSupplier(directoryId: string) {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).suppliersScreen;
  const supplier = await prisma.supplierDirectory.findUnique({ where: { id: directoryId } });
  if (
    !supplier ||
    (!scope.isSuperAdmin && supplier.clientId !== user.clientId) ||
    !canSeeByGroups(user, supplier.viewGroupIds)
  ) {
    return { user, d, supplier: null } as const;
  }
  return { user, d, supplier } as const;
}

export async function rateSupplier(
  directoryId: string,
  stars: number,
  comment: string,
): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canRateSuppliers(user)) return { error: d.noPermissionRate };
  if (!supplier) return { error: d.notFound };
  const rounded = Math.round(Number(stars));
  if (!Number.isFinite(rounded) || rounded < 1 || rounded > 5) return { error: d.invalidStars };
  const text = (comment ?? "").trim().slice(0, 1000) || null;
  await prisma.supplierRating.upsert({
    where: { supplierDirectoryId_userId: { supplierDirectoryId: supplier.id, userId: user.id } },
    create: {
      clientId: supplier.clientId,
      supplierDirectoryId: supplier.id,
      userId: user.id,
      stars: rounded,
      comment: text,
    },
    update: { stars: rounded, comment: text },
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export async function removeMyRating(directoryId: string): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canRateSuppliers(user)) return { error: d.noPermissionRate };
  if (!supplier) return { error: d.notFound };
  await prisma.supplierRating.deleteMany({
    where: { supplierDirectoryId: supplier.id, userId: user.id },
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export async function setSupplierBlocked(directoryId: string, blocked: boolean): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canBlockSuppliers(user)) return { error: d.noPermissionBlock };
  if (!supplier) return { error: d.notFound };
  await prisma.supplierDirectory.update({
    where: { id: supplier.id },
    // Any manual block / unblock ends the "initial block" mark.
    data: { blocked, blockedAt: blocked ? new Date() : null, initialBlock: false },
  });
  await logSupplierEvent(supplier.id, user.id, blocked ? "BLOCKED" : "UNBLOCKED", {
    wasInitial: supplier.initialBlock,
  });
  // Contacts added while it was blocked get their invitation now.
  if (!blocked) await sendHeldInvitations(supplier.id, user.language);
  revalidatePath("/suppliers");
  return { success: true };
}

export async function setContactBlocked(linkId: string, blocked: boolean): Promise<Result> {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).suppliersScreen;
  if (!canBlockSuppliers(user)) return { error: d.noPermissionBlock };
  const link = await prisma.supplierUserLink.findUnique({
    where: { id: linkId },
    include: { supplierDirectory: true },
  });
  if (
    !link ||
    (!scope.isSuperAdmin && link.clientId !== user.clientId) ||
    !canSeeByGroups(user, link.supplierDirectory.viewGroupIds)
  ) {
    return { error: d.contactNotFound };
  }
  await prisma.supplierUserLink.update({ where: { id: link.id }, data: { blocked } });
  const person = await prisma.supplierUser.findUnique({
    where: { id: link.supplierUserId },
    select: { name: true, lastName: true, email: true },
  });
  await logSupplierEvent(link.supplierDirectoryId, user.id, blocked ? "CONTACT_BLOCKED" : "CONTACT_UNBLOCKED", {
    name: person ? `${person.name} ${person.lastName}`.trim() || person.email : "",
  });
  revalidatePath("/suppliers");
  return { success: true };
}

const MAX_DOC_BYTES = 8 * 1024 * 1024;

function dayUtc(value: unknown): Date | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
}

// Uploads a document to a supplier's record. The file is kept in the database.
export async function uploadSupplierDocument(directoryId: string, formData: FormData): Promise<Result> {
  const { user, supplier } = await loadSupplier(directoryId);
  const d = getDictionary(user.language).supplierDocs;
  if (!canManageSupplierDocs(user)) return { error: d.errNoPermission };
  if (!supplier) return { error: d.errNotFound };

  const typeId = String(formData.get("typeId") ?? "");
  const type = typeId
    ? await prisma.supplierDocumentType.findFirst({ where: { id: typeId, clientId: supplier.clientId, active: true } })
    : null;
  if (!type || !canSeeByGroups(user, type.viewGroupIds)) return { error: d.errTypeRequired };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: d.errFileRequired };
  if (file.size > MAX_DOC_BYTES) return { error: d.errFileTooBig };

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  if (type.hasDates) {
    startDate = dayUtc(formData.get("startDate"));
    endDate = dayUtc(formData.get("endDate"));
    if (!startDate || !endDate) return { error: d.errDatesRequired };
    if (endDate < startDate) return { error: d.errEndBeforeStart };
  }
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;

  await prisma.supplierDocument.create({
    data: {
      clientId: supplier.clientId,
      supplierDirectoryId: supplier.id,
      typeId: type.id,
      startDate,
      endDate,
      note,
      fileName: file.name.replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, "_").slice(0, 150) || "documento",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      fileData: Buffer.from(await file.arrayBuffer()),
      uploadedByUserId: user.id,
    },
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export async function deleteSupplierDocument(documentId: string): Promise<Result> {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).supplierDocs;
  if (!canManageSupplierDocs(user)) return { error: d.errNoPermission };
  const doc = await prisma.supplierDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      clientId: true,
      supplierDirectoryId: true,
      fileName: true,
      supplierDirectory: { select: { viewGroupIds: true } },
      type: { select: { viewGroupIds: true, name: true } },
    },
  });
  if (
    !doc ||
    (!scope.isSuperAdmin && doc.clientId !== user.clientId) ||
    !canSeeByGroups(user, doc.supplierDirectory.viewGroupIds) ||
    !canSeeByGroups(user, doc.type.viewGroupIds)
  ) {
    return { error: d.errNotFound };
  }
  await prisma.supplierDocument.delete({ where: { id: doc.id } });
  await logSupplierEvent(doc.supplierDirectoryId, user.id, "DOCUMENT_DELETED", {
    type: doc.type.name,
    fileName: doc.fileName,
  });
  revalidatePath("/suppliers");
  return { success: true };
}

export type NewSupplierInput = {
  code: string;
  taxId: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
  viewGroupIds: string[];
  commodity?: string;
  region?: string;
  customValues?: Record<string, string>; // the client's SUPPLIER custom fields (key → value)
};

// Commodity / region (must exist in the client's trees and be visible to the user)
// and the supplier custom fields, validated. On update, values the user can't
// edit or see keep what is stored.
async function shapeSupplierExtras(
  clientId: string,
  user: Parameters<typeof applyViewGroupsToFields>[1] & { language: string },
  input: NewSupplierInput,
  existingId?: string,
): Promise<
  | { error: string }
  | { commodity: string | null; region: string | null; values: Record<string, string>; fieldLabels: Map<string, string> }
> {
  const [commodities, regions, allFields] = await Promise.all([
    prisma.commodity.findMany({ where: { clientId } }),
    prisma.region.findMany({ where: { clientId } }),
    loadCustomFields(clientId, "SUPPLIER"),
  ]);
  const d = getDictionary(user.language).suppliersScreen;
  const pick = (list: { id: string; parentId: string | null; description: string; viewGroupIds: string[] }[], wanted?: string) => {
    const value = (wanted ?? "").trim();
    if (!value) return { ok: true as const, value: null };
    const found = filterTreeByGroups(list, user).find((n) => n.description === value);
    return found ? { ok: true as const, value } : { ok: false as const, value: null };
  };
  const commodity = pick(commodities, input.commodity);
  if (!commodity.ok) return { error: d.invalidCommodity };
  const region = pick(regions, input.region);
  if (!region.ok) return { error: d.invalidRegion };

  const fields = applyViewGroupsToFields(allFields, user);
  const sent = { ...(input.customValues ?? {}) };
  const stored = existingId ? ((await readCustomValues(clientId, "SUPPLIER", [existingId])).get(existingId) ?? {}) : {};
  for (const f of fields) {
    if (!f.editable || !f.visible) {
      if (stored[f.key] !== undefined) sent[f.key] = stored[f.key];
      else delete sent[f.key];
    }
  }
  const result = prepareCustomValues(fields, sent, emptyContext(), "userCustom", true);
  if ("error" in result) {
    const cf = getDictionary(user.language).customFields;
    const e = result.error;
    const label = labelFor(e.field.labels, user.language, e.field.key);
    const template = e.code === "mandatory" ? cf.errMandatory : e.code === "tooLong" ? cf.errTooLong : cf.errInvalid;
    return { error: template.replace("{field}", label) };
  }
  return {
    commodity: commodity.value,
    region: region.value,
    values: result.values,
    fieldLabels: new Map(fields.map((f) => [f.key, labelFor(f.labels, user.language, f.key)])),
  };
}

// Creates a supplier-directory entry with the same data the master-data screen
// holds. A user who can't block/unblock suppliers creates it blocked: someone
// with that permission has to unblock it before it can be used. A tax ID that
// already exists (same client) is refused.
export async function createSupplier(
  input: NewSupplierInput,
  targetClientId?: string,
): Promise<{ error: string } | { success: true; id: string; blocked: boolean }> {
  const scope = await requireClientScope();
  const { user } = scope;
  const d = getDictionary(user.language).suppliersScreen;
  if (user.role === "APPROVER" || !canCreateSuppliers(user)) return { error: d.noPermissionCreate };
  const clientId = scope.isSuperAdmin ? targetClientId : user.clientId;
  if (!clientId) return { error: d.createNoClient };

  const code = (input.code ?? "").trim().slice(0, 50);
  const taxId = (input.taxId ?? "").trim().slice(0, 50);
  const companyName = (input.companyName ?? "").trim().slice(0, 200);
  if (!code || !companyName) return { error: d.createCodeCompanyRequired };
  if (!taxId) return { error: d.createTaxIdRequired };

  const [sameCode, sameTaxId] = await Promise.all([
    prisma.supplierDirectory.findFirst({ where: { clientId, code: { equals: code, mode: "insensitive" } } }),
    prisma.supplierDirectory.findFirst({
      where: { clientId, taxId: { equals: taxId, mode: "insensitive" } },
      select: { companyName: true },
    }),
  ]);
  if (sameTaxId) {
    return { error: d.createTaxIdExists.replace("{taxId}", taxId).replace("{company}", sameTaxId.companyName) };
  }
  if (sameCode) return { error: d.createCodeExists.replace("{code}", code) };

  const extras = await shapeSupplierExtras(clientId, user, input);
  if ("error" in extras) return extras;

  const canBlock = canBlockSuppliers(user);
  const created = await prisma.supplierDirectory.create({
    data: {
      clientId,
      commodity: extras.commodity,
      region: extras.region,
      createdByUserId: user.id,
      initialBlock: !canBlock,
      code,
      taxId,
      companyName,
      contactFirstName: (input.contactFirstName ?? "").trim().slice(0, 100),
      contactLastName: (input.contactLastName ?? "").trim().slice(0, 100),
      email: (input.email ?? "").trim().slice(0, 200),
      phone: (input.phone ?? "").trim().slice(0, 50),
      status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      viewGroupIds: await validViewGroupIds(clientId, input.viewGroupIds),
      blocked: !canBlock,
      blockedAt: canBlock ? null : new Date(),
    },
  });
  if (Object.keys(extras.values).length > 0) await saveCustomValues(clientId, "SUPPLIER", created.id, extras.values);
  if (!canBlock) await logSupplierEvent(created.id, user.id, "INITIAL_BLOCK");
  revalidatePath("/suppliers");
  return { success: true, id: created.id, blocked: !canBlock };
}

// Edits the data of an existing supplier (not the block flag: that has its own
// permission). A tax ID or code already used by another supplier is refused.
export async function updateSupplier(
  directoryId: string,
  input: NewSupplierInput,
): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canEditSuppliers(user)) return { error: d.noPermissionEdit };
  if (!supplier) return { error: d.notFound };

  const code = (input.code ?? "").trim().slice(0, 50);
  const taxId = (input.taxId ?? "").trim().slice(0, 50);
  const companyName = (input.companyName ?? "").trim().slice(0, 200);
  if (!code || !companyName) return { error: d.createCodeCompanyRequired };
  if (!taxId) return { error: d.createTaxIdRequired };

  if (code.toLowerCase() !== supplier.code.toLowerCase()) {
    const sameCode = await prisma.supplierDirectory.findFirst({
      where: { clientId: supplier.clientId, code: { equals: code, mode: "insensitive" }, NOT: { id: supplier.id } },
    });
    if (sameCode) return { error: d.createCodeExists.replace("{code}", code) };
  }
  if (taxId.toLowerCase() !== supplier.taxId.toLowerCase()) {
    const sameTaxId = await prisma.supplierDirectory.findFirst({
      where: { clientId: supplier.clientId, taxId: { equals: taxId, mode: "insensitive" }, NOT: { id: supplier.id } },
      select: { companyName: true },
    });
    if (sameTaxId) {
      return { error: d.createTaxIdExists.replace("{taxId}", taxId).replace("{company}", sameTaxId.companyName) };
    }
  }

  const extras = await shapeSupplierExtras(supplier.clientId, user, input, supplier.id);
  if ("error" in extras) return extras;
  const newGroups = await validViewGroupIds(supplier.clientId, input.viewGroupIds);
  const storedCustom = (await readCustomValues(supplier.clientId, "SUPPLIER", [supplier.id])).get(supplier.id) ?? {};

  // What changed, for the history.
  const text = (v: string | null | undefined) => (v ?? "").trim();
  const newStatus = input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const changed = [
    text(supplier.code) !== code && "code",
    text(supplier.taxId) !== taxId && "taxId",
    text(supplier.companyName) !== companyName && "companyName",
    text(supplier.contactFirstName) !== text(input.contactFirstName) && "contactFirstName",
    text(supplier.contactLastName) !== text(input.contactLastName) && "contactLastName",
    text(supplier.email) !== text(input.email) && "email",
    text(supplier.phone) !== text(input.phone) && "phone",
    supplier.status !== newStatus && "status",
    [...supplier.viewGroupIds].sort().join(",") !== [...newGroups].sort().join(",") && "viewGroups",
    text(supplier.commodity) !== text(extras.commodity) && "commodity",
    text(supplier.region) !== text(extras.region) && "region",
  ].filter((f): f is string => Boolean(f));
  const changedCustom = [...new Set([...Object.keys(storedCustom), ...Object.keys(extras.values)])]
    .filter((k) => (storedCustom[k] ?? "") !== (extras.values[k] ?? ""))
    .map((k) => extras.fieldLabels.get(k) ?? k);

  await prisma.supplierDirectory.update({
    where: { id: supplier.id },
    data: {
      commodity: extras.commodity,
      region: extras.region,
      code,
      taxId,
      companyName,
      contactFirstName: (input.contactFirstName ?? "").trim().slice(0, 100),
      contactLastName: (input.contactLastName ?? "").trim().slice(0, 100),
      email: (input.email ?? "").trim().slice(0, 200),
      phone: (input.phone ?? "").trim().slice(0, 50),
      status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      viewGroupIds: newGroups,
    },
  });
  await saveCustomValues(supplier.clientId, "SUPPLIER", supplier.id, extras.values);
  if (changed.length > 0 || changedCustom.length > 0) {
    await logSupplierEvent(supplier.id, user.id, "EDITED", { fields: changed, custom: changedCustom });
  }
  revalidatePath("/suppliers");
  return { success: true };
}

// Adds a person as a contact of the supplier. Same rules as the master-data
// screen: they get an invitation email, or wait for the supplier's own
// administrator to approve them.
export async function addSupplierContact(
  directoryId: string,
  input: { name: string; lastName: string; email: string; isAdmin: boolean },
): Promise<{ error: string } | { success: true; pendingApproval: boolean }> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canAddSupplierContacts(user)) return { error: d.noPermissionAddContact };
  if (!supplier) return { error: d.notFound };

  const name = (input.name ?? "").trim().slice(0, 100);
  const email = (input.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!name) return { error: d.contactNameRequired };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: d.contactEmailInvalid };

  const result = await addContact({
    supplierDirectoryId: supplier.id,
    name,
    lastName: (input.lastName ?? "").trim().slice(0, 100),
    email,
    isAdmin: Boolean(input.isAdmin),
    byAdmin: false,
    language: user.language,
    duplicateError: d.contactExists.replace("{email}", email),
  });
  if ("error" in result) return result;
  revalidatePath("/suppliers");
  return { success: true, pendingApproval: result.status === "PENDING_APPROVAL" };
}

// Asks the client's AI (web search) about the supplier and stores the summary
// on it, so the question is only paid for once. `onlyIfMissing` makes repeated
// calls (e.g. the page re-mounting right after creation) free.
export async function generateSupplierSummary(
  directoryId: string,
  options: { onlyIfMissing?: boolean } = {},
): Promise<Result> {
  const { user, d, supplier } = await loadSupplier(directoryId);
  if (!canCreateSuppliers(user) && !canEditSuppliers(user)) return { error: d.noPermissionEdit };
  if (!supplier) return { error: d.notFound };
  if (options.onlyIfMissing && supplier.aiSummary) return { success: true };

  const ai = await clientAi(supplier.clientId);
  if (!ai) return { error: d.aiNotConfigured };

  const log = (inputTokens: number, outputTokens: number, status: "OK" | "ERROR", error?: string) =>
    prisma.assistantLog
      .create({
        data: {
          clientId: supplier.clientId,
          userId: user.id,
          question: `Supplier summary: ${supplier.companyName}`.slice(0, 500),
          tools: ["supplier_summary"],
          inputTokens,
          outputTokens,
          status,
          error: error?.slice(0, 300) ?? null,
        },
      })
      .catch(() => null);

  try {
    const research = await researchSupplier({
      ai,
      companyName: supplier.companyName,
      taxId: supplier.taxId,
      language: user.language,
    });
    await prisma.supplierDirectory.update({
      where: { id: supplier.id },
      data: {
        aiSummary: research.text.slice(0, 4000),
        aiSummaryAt: new Date(),
        aiSummaryModel: research.model,
        aiSummaryKey: `${supplier.companyName}|${supplier.taxId}`,
        aiSummarySources: research.sources,
      },
    });
    await log(research.inputTokens, research.outputTokens, "OK");
    revalidatePath("/suppliers");
    return { success: true };
  } catch (error) {
    console.error("[supplier:summary]", error);
    await log(0, 0, "ERROR", error instanceof Error ? error.message : "error");
    if (error instanceof ResearchError) {
      if (error.kind === "auth") return { error: d.aiAuthError };
      if (error.kind === "rate") return { error: d.aiRateError };
      if (error.kind === "empty") return { error: d.aiEmptyError };
    }
    return { error: d.aiFailed };
  }
}
