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
import { addContact } from "@/lib/supplierContacts";
import { clientAi, researchSupplier, ResearchError } from "@/lib/supplierResearch";
import { canSeeByGroups } from "@/lib/viewGroups";
import { validViewGroupIds } from "@/lib/viewGroupsServer";

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
    data: { blocked, blockedAt: blocked ? new Date() : null },
  });
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
    select: { id: true, clientId: true, supplierDirectory: { select: { viewGroupIds: true } }, type: { select: { viewGroupIds: true } } },
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
};

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

  const canBlock = canBlockSuppliers(user);
  const created = await prisma.supplierDirectory.create({
    data: {
      clientId,
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

  await prisma.supplierDirectory.update({
    where: { id: supplier.id },
    data: {
      code,
      taxId,
      companyName,
      contactFirstName: (input.contactFirstName ?? "").trim().slice(0, 100),
      contactLastName: (input.contactLastName ?? "").trim().slice(0, 100),
      email: (input.email ?? "").trim().slice(0, 200),
      phone: (input.phone ?? "").trim().slice(0, 50),
      status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      viewGroupIds: await validViewGroupIds(supplier.clientId, input.viewGroupIds),
    },
  });
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
