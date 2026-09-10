export type TemplatePriceCondition = "GREATER_THAN" | "LESS_THAN" | "BETWEEN";

export type MatchableTemplate = {
  matchCommodity: string | null;
  matchRegion: string | null;
  matchPriceCondition: TemplatePriceCondition | null;
  matchPriceMin: number | null;
  matchPriceMax: number | null;
};

function matchesPriceCondition(
  template: MatchableTemplate,
  estimatedPrice: number | null,
): boolean {
  if (!template.matchPriceCondition) return true;
  // Has a price condition but nothing to check it against — doesn't match,
  // rather than silently ignoring the condition.
  if (estimatedPrice === null) return false;
  switch (template.matchPriceCondition) {
    case "GREATER_THAN":
      return template.matchPriceMin !== null && estimatedPrice > template.matchPriceMin;
    case "LESS_THAN":
      return template.matchPriceMax !== null && estimatedPrice < template.matchPriceMax;
    case "BETWEEN":
      return (
        template.matchPriceMin !== null &&
        template.matchPriceMax !== null &&
        estimatedPrice >= template.matchPriceMin &&
        estimatedPrice <= template.matchPriceMax
      );
  }
}

export function matchesTemplate(
  template: MatchableTemplate,
  commodity: string,
  region: string,
  estimatedPrice: number | null = null,
) {
  const commodityOk =
    !template.matchCommodity ||
    template.matchCommodity.trim().toLowerCase() ===
      commodity.trim().toLowerCase();
  const regionOk =
    !template.matchRegion ||
    template.matchRegion.trim().toLowerCase() === region.trim().toLowerCase();
  return commodityOk && regionOk && matchesPriceCondition(template, estimatedPrice);
}

// A template with no condition at all (commodity/región/precio) applies to
// every RFP unconditionally — it never competes for the "Plantilla" field,
// it just always applies alongside whichever conditional template is
// selected. Only templates with at least one condition are candidates.
export function isConditionalTemplate(template: MatchableTemplate): boolean {
  return Boolean(
    template.matchCommodity || template.matchRegion || template.matchPriceCondition,
  );
}

export function splitConditionalTemplates<T extends MatchableTemplate>(
  matching: T[],
): { always: T[]; conditional: T[] } {
  const always = matching.filter((t) => !isConditionalTemplate(t));
  const conditional = matching.filter((t) => isConditionalTemplate(t));
  return { always, conditional };
}

// The actual set of templates whose content applies to an RFP: every
// unconditional template, plus — among the conditional ones that currently
// match — either the explicitly selected one, or the sole match when there
// is exactly one (nothing to choose). An out-of-date selection (no longer
// among the current matches) is dropped rather than kept.
export function resolveAppliedTemplates<T extends MatchableTemplate & { id: string }>(
  matching: T[],
  selectedTemplateId: string | null,
): T[] {
  const { always, conditional } = splitConditionalTemplates(matching);
  const selected =
    conditional.length === 1
      ? conditional[0]
      : (conditional.find((t) => t.id === selectedTemplateId) ?? null);
  return selected ? [...always, selected] : always;
}
