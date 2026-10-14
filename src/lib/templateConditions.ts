// Conditions on template content (items, ad-hoc item fields, questions): the
// piece only applies when a header value of the RFP matches. The header value
// is a standard field ("commodity", "region") or one of the client's custom
// header fields ("custom:<key>"). Configured only in the template screen.
// Client-safe.

// `op` only matters for the RFP amount ("estimatedPrice"): greater / less than
// the value. Every other field compares for equality.
export type ConditionOp = "gt" | "lt";
export type TemplateCondition = { field: string; value: string; op?: ConditionOp };

export const CUSTOM_COND_PREFIX = "custom:";
export const STD_COND_FIELDS = ["commodity", "region"] as const;
export const PRICE_COND_FIELD = "estimatedPrice";

export type ConditionHeader = {
  commodity: string | null | undefined;
  region: string | null | undefined;
  custom: Record<string, string>;
  estimatedPrice?: number | null; // the RFP amount, when known
};

export function parseTemplateCondition(raw: unknown): TemplateCondition | null {
  if (!raw || typeof raw !== "object") return null;
  const { field, value, op } = raw as Record<string, unknown>;
  if (typeof field !== "string" || typeof value !== "string" || !field || value === "") return null;
  return op === "gt" || op === "lt" ? { field, value, op } : { field, value };
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// A piece with no condition always applies.
export function templateConditionHolds(
  condition: TemplateCondition | null | undefined,
  header: ConditionHeader,
): boolean {
  if (!condition) return true;
  if (condition.field === PRICE_COND_FIELD) {
    // An amount condition needs a known amount: without one it does not hold.
    const limit = Number(condition.value);
    const price = header.estimatedPrice;
    if (price === null || price === undefined || !Number.isFinite(price) || !Number.isFinite(limit)) return false;
    return condition.op === "lt" ? price < limit : price > limit;
  }
  const current = condition.field.startsWith(CUSTOM_COND_PREFIX)
    ? header.custom[condition.field.slice(CUSTOM_COND_PREFIX.length)]
    : condition.field === "commodity"
      ? header.commodity
      : condition.field === "region"
        ? header.region
        : "";
  return norm(current) === norm(condition.value);
}
