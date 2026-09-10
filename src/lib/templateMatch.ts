export type TemplatePriceCondition = "GREATER_THAN" | "LESS_THAN" | "BETWEEN";

export type MatchableTemplate = {
  matchCommodity: string | null;
  matchCommodityIncludeDescendants: boolean;
  matchRegion: string | null;
  matchRegionIncludeDescendants: boolean;
  matchPriceCondition: TemplatePriceCondition | null;
  matchPriceMin: number | null;
  matchPriceMax: number | null;
};

export type HierarchyNode = { id: string; parentId: string | null; description: string };

// [selected value, its parent's, its grandparent's, ...] up to the root —
// what "aplica también a los niveles de abajo" checks against: a template
// condition set to "España" with the flag on matches an RFP whose región is
// "Madrid" because "España" shows up in Madrid's own chain.
export function ancestorChain(nodes: HierarchyNode[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const node = nodes.find(
    (n) => n.description.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (!node) return [trimmed];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: HierarchyNode | undefined = node;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current.description);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

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

function chainIncludes(chain: string[], value: string): boolean {
  const target = value.trim().toLowerCase();
  return chain.some((c) => c.trim().toLowerCase() === target);
}

// commodityChain/regionChain are the RFP's own value plus its ancestors
// (see ancestorChain) — a caller with no tree data on hand can just pass a
// one-element chain (`[commodity]`), which behaves like a plain exact match.
export function matchesTemplate(
  template: MatchableTemplate,
  commodityChain: string[],
  regionChain: string[],
  estimatedPrice: number | null = null,
) {
  const commodityOk =
    !template.matchCommodity ||
    (template.matchCommodityIncludeDescendants
      ? chainIncludes(commodityChain, template.matchCommodity)
      : commodityChain[0] !== undefined &&
        commodityChain[0].trim().toLowerCase() ===
          template.matchCommodity.trim().toLowerCase());
  const regionOk =
    !template.matchRegion ||
    (template.matchRegionIncludeDescendants
      ? chainIncludes(regionChain, template.matchRegion)
      : regionChain[0] !== undefined &&
        regionChain[0].trim().toLowerCase() === template.matchRegion.trim().toLowerCase());
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
