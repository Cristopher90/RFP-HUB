import "server-only";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import {
  applicableRequirements,
  betterState,
  describeUnmet,
  docStatus,
  todayUtc,
  type DocRequirement,
  type DocTypeState,
} from "@/lib/supplierDocs";
import { readCustomValues } from "@/lib/customFields";

// For each supplier-directory entry, its status for every document type it has a
// document of (the best one: valid beats not-yet-valid beats expired).
export async function docStatesBySupplier(
  clientId: string,
  supplierIds?: string[],
): Promise<Map<string, Record<string, DocTypeState>>> {
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
  const map = new Map<string, Record<string, DocTypeState>>();
  for (const d of docs) {
    if (!d.type.active) continue;
    const states = map.get(d.supplierDirectoryId) ?? {};
    states[d.typeId] = betterState(states[d.typeId], docStatus(d, d.type.hasDates, today));
    map.set(d.supplierDirectoryId, states);
  }
  return map;
}

// The document types it has valid today.
export async function validDocTypesBySupplier(
  clientId: string,
  supplierIds?: string[],
): Promise<Map<string, Set<string>>> {
  const states = await docStatesBySupplier(clientId, supplierIds);
  return new Map(
    [...states.entries()].map(([id, byType]) => [
      id,
      new Set(Object.entries(byType).filter(([, st]) => st === "active").map(([typeId]) => typeId)),
    ]),
  );
}

// What the RFP screens need to say why a supplier can't be invited: each supplier's
// document states and the names of the document types.
export async function loadDocContext(clientId: string) {
  const [states, types] = await Promise.all([
    docStatesBySupplier(clientId),
    prisma.supplierDocumentType.findMany({ where: { clientId }, select: { id: true, name: true } }),
  ]);
  return {
    states: Object.fromEntries(states) as Record<string, Record<string, DocTypeState>>,
    names: Object.fromEntries(types.map((t) => [t.id, t.name])) as Record<string, string>,
  };
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
    docStatesBySupplier(clientId, ids),
    prisma.supplierDirectory.findMany({ where: { id: { in: ids } }, select: { id: true, companyName: true } }),
    prisma.supplierDocumentType.findMany({ where: { clientId }, select: { id: true, name: true } }),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const d = getDictionary(language).supplierDocs;
  const problems: string[] = [];
  for (const s of suppliers) {
    const needs = describeUnmet(requirements, valid.get(s.id), (id) => typeName.get(id) ?? id, {
      missing: d.stateMissing,
      expired: d.stateExpired,
      upcoming: d.stateUpcoming,
      or: d.or,
    });
    if (needs) problems.push(`${s.companyName} (${needs})`);
  }
  return problems.length > 0 ? d.supplierMissingDocs.replace("{list}", problems.join(" · ")) : null;
}

// The documentation requirements that apply to an existing RFP: those of the
// templates applied to it, for the header values it currently has.
export async function rfpDocumentRequirements(rfpId: string): Promise<DocRequirement[]> {
  const rfp = await prisma.rfp.findUnique({
    where: { id: rfpId },
    select: { id: true, clientId: true, commodity: true, region: true, estimatedPrice: true, appliedTemplates: true },
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
    estimatedPrice: rfp.estimatedPrice,
  });
}
