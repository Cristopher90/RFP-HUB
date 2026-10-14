// Supplier documentation: validity of a document and the template rules that
// require valid documents from the suppliers invited to an RFP. Client-safe.

import {
  parseTemplateCondition,
  templateConditionHolds,
  type ConditionHeader,
  type TemplateCondition,
} from "@/lib/templateConditions";

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
    // parseTemplateCondition keeps the amount operator (greater / less than).
    const c = parseTemplateCondition(condition);
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

// What a supplier has for one document type: the best status among its documents
// (a type it has no document of is simply absent from the map).
export type DocTypeState = DocStatus;
const STATE_RANK: Record<DocStatus, number> = { active: 3, upcoming: 2, expired: 1 };
export function betterState(a: DocStatus | undefined, b: DocStatus): DocStatus {
  return !a || STATE_RANK[b] > STATE_RANK[a] ? b : a;
}

// "CIF (falta) o ISO (vencido)": for each unmet requirement, the types that would
// satisfy it and why the supplier doesn't (no document / expired / not valid yet).
export function describeUnmet(
  requirements: DocRequirement[],
  states: Record<string, DocTypeState> | undefined,
  typeName: (id: string) => string,
  labels: { missing: string; expired: string; upcoming: string; or: string },
): string {
  const valid = new Set(Object.entries(states ?? {}).filter(([, st]) => st === "active").map(([id]) => id));
  return unmetRequirements(requirements, valid)
    .map((r) =>
      r.typeIds
        .map((id) => {
          const st = states?.[id];
          const why = st === "expired" ? labels.expired : st === "upcoming" ? labels.upcoming : labels.missing;
          return `${typeName(id)} (${why})`;
        })
        .join(` ${labels.or} `),
    )
    .join("; ");
}
