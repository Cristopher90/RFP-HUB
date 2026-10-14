// Conditions on template content (items, ad-hoc item fields, questions): the
// piece only applies when a header value of the RFP matches. The header value
// is a standard field ("commodity", "region") or one of the client's custom
// header fields ("custom:<key>"). Configured only in the template screen.
// Client-safe.

export type TemplateCondition = { field: string; value: string };

export const CUSTOM_COND_PREFIX = "custom:";
export const STD_COND_FIELDS = ["commodity", "region"] as const;

export type ConditionHeader = {
  commodity: string | null | undefined;
  region: string | null | undefined;
  custom: Record<string, string>;
};

export function parseTemplateCondition(raw: unknown): TemplateCondition | null {
  if (!raw || typeof raw !== "object") return null;
  const { field, value } = raw as Record<string, unknown>;
  if (typeof field !== "string" || typeof value !== "string" || !field || value === "") return null;
  return { field, value };
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// A piece with no condition always applies.
export function templateConditionHolds(
  condition: TemplateCondition | null | undefined,
  header: ConditionHeader,
): boolean {
  if (!condition) return true;
  const current = condition.field.startsWith(CUSTOM_COND_PREFIX)
    ? header.custom[condition.field.slice(CUSTOM_COND_PREFIX.length)]
    : condition.field === "commodity"
      ? header.commodity
      : condition.field === "region"
        ? header.region
        : "";
  return norm(current) === norm(condition.value);
}
