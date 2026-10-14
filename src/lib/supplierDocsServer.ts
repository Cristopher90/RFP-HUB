import "server-only";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { applicableRequirements, docStatus, todayUtc, unmetRequirements, type DocRequirement } from "@/lib/supplierDocs";
import { readCustomValues } from "@/lib/customFields";

// For each supplier-directory entry, the document types it has valid today.
export async function validDocTypesBySupplier(
  clientId: string,
  supplierIds?: string[],
): Promise<Map<string, Set<string>>> {
  const docs = await prisma.supplierDocument.findMany({
    where: { clientId, ...(supplierIds ? { supplierDirectoryId: { in: supplierIds } } : {}) },
    select: {
      supplierDirectoryId: true,
      typeId: true,
      startDate: true,
      endDate: true,
      type: { select: { hasDates: true, active: true } },
    },
  });
  const today = todayUtc();
  const map = new Map<string, Set<string>>();
  for (const d of docs) {
    if (!d.type.active || docStatus(d, d.type.hasDates, today) !== "active") continue;
    const set = map.get(d.supplierDirectoryId) ?? new Set<string>();
    set.add(d.typeId);
    map.set(d.supplierDirectoryId, set);
  }
  return map;
}

// Error text when any of the (directory) suppliers lacks a valid document the
// applicable requirements ask for; null when all comply.
export async function documentationError(
  clientId: string,
  directoryIds: string[],
  requirements: DocRequirement[],
  language: string,
): Promise<string | null> {
  if (requirements.length === 0 || directoryIds.length === 0) return null;
  const ids = [...new Set(directoryIds)];
  const [valid, suppliers, types] = await Promise.all([
    validDocTypesBySupplier(clientId, ids),
    prisma.supplierDirectory.findMany({ where: { id: { in: ids } }, select: { id: true, companyName: true } }),
    prisma.supplierDocumentType.findMany({ where: { clientId }, select: { id: true, name: true } }),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const d = getDictionary(language).supplierDocs;
  const problems: string[] = [];
  for (const s of suppliers) {
    const unmet = unmetRequirements(requirements, valid.get(s.id) ?? new Set());
    if (unmet.length > 0) {
      const needs = unmet.map((r) => r.typeIds.map((id) => typeName.get(id) ?? id).join(` ${d.or} `)).join("; ");
      problems.push(`${s.companyName} (${needs})`);
    }
  }
  return problems.length > 0 ? d.supplierMissingDocs.replace("{list}", problems.join(" · ")) : null;
}

// The documentation requirements that apply to an existing RFP: those of the
// templates applied to it, for the header values it currently has.
export async function rfpDocumentRequirements(rfpId: string): Promise<DocRequirement[]> {
  const rfp = await prisma.rfp.findUnique({
    where: { id: rfpId },
    select: { id: true, clientId: true, commodity: true, region: true, appliedTemplates: true },
  });
  if (!rfp?.appliedTemplates) return [];
  let ids: string[] = [];
  try {
    ids = (JSON.parse(rfp.appliedTemplates) as { id: string }[]).map((t) => t.id);
  } catch {
    return [];
  }
  const [templates, custom] = await Promise.all([
    prisma.rfpTemplate.findMany({ where: { id: { in: ids } }, select: { documentRequirements: true } }),
    readCustomValues(rfp.clientId, "RFP", [rfp.id]),
  ]);
  return applicableRequirements(templates, {
    commodity: rfp.commodity,
    region: rfp.region,
    custom: custom.get(rfp.id) ?? {},
  });
}
