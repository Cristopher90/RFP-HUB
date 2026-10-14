// Supplier documentation: validity of a document and the template rules that
// require valid documents from the suppliers invited to an RFP. Client-safe.

import { templateConditionHolds, type ConditionHeader, type TemplateCondition } from "@/lib/templateConditions";

export type DocStatus = "active" | "expired" | "upcoming";

// Today as a calendar day (UTC midnight, the way document dates are stored).
export function todayUtc(now = new Date()): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

// A document of a type with dates is valid from startDate to endDate (both
// included); a missing bound is open; a type without dates never expires.
export function docStatus(
  doc: { startDate: Date | string | null; endDate: Date | string | null },
  hasDates: boolean,
  today: number,
): DocStatus {
  if (!hasDates) return "active";
  const start = doc.startDate ? new Date(doc.startDate).getTime() : null;
  const end = doc.endDate ? new Date(doc.endDate).getTime() : null;
  if (start !== null && today < start) return "upcoming";
  if (end !== null && today > end) return "expired";
  return "active";
}

export type DocRequirement = { typeIds: string[]; condition: TemplateCondition | null };

export function parseDocRequirements(raw: unknown): DocRequirement[] {
  if (!Array.isArray(raw)) return [];
  const out: DocRequirement[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { typeIds, condition } = r as { typeIds?: unknown; condition?: unknown };
    if (!Array.isArray(typeIds)) continue;
    const ids = typeIds.filter((x): x is string => typeof x === "string" && x !== "");
    if (ids.length === 0) continue;
    const c =
      condition && typeof condition === "object" &&
      typeof (condition as TemplateCondition).field === "string" &&
      typeof (condition as TemplateCondition).value === "string" &&
      (condition as TemplateCondition).value !== ""
        ? { field: (condition as TemplateCondition).field, value: (condition as TemplateCondition).value }
        : null;
    out.push({ typeIds: ids, condition: c });
  }
  return out;
}

// Requirements of the applied templates that the RFP's header makes applicable.
export function applicableRequirements(
  templates: { documentRequirements?: unknown }[],
  header: ConditionHeader,
): DocRequirement[] {
  return templates
    .flatMap((t) => parseDocRequirements(t.documentRequirements))
    .filter((r) => templateConditionHolds(r.condition, header));
}

// The requirements a supplier fails: it needs a valid document of at least one
// of the requirement's types. `validTypeIds` are the types it has valid today.
export function unmetRequirements(requirements: DocRequirement[], validTypeIds: Set<string>): DocRequirement[] {
  return requirements.filter((r) => !r.typeIds.some((id) => validTypeIds.has(id)));
}
