import type { NewItemInput } from "@/app/rfps/new/actions";
import { normalizeRfpMapping, type RfpItemSource } from "@/lib/requestFields";

type RequestForRfp = {
  documentNumber: string;
  documentType: string;
  creator: string | null;
  requestDate: Date | null;
  commodity: string | null;
  lines: {
    position: string;
    itemCode: string | null;
    description: string;
    historicalPrice: number | null;
    quantity: number;
    unit: string | null;
    commodity: string | null;
  }[];
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match).trim();
}

// A request's commodity only carries over if it matches one of the client's
// commodities (by code or description) — the RFP form works with those.
function matchCommodity(
  value: string | null,
  commodities: { code: string; description: string }[],
): string | null {
  const needle = (value ?? "").trim().toLowerCase();
  if (!needle) return null;
  const found = commodities.find(
    (c) => c.code.toLowerCase() === needle || c.description.toLowerCase() === needle,
  );
  return found?.description ?? null;
}

// Fills the RFP form's header and items from a request using the import
// template's "map to RFP" settings. The buyer can still edit everything.
export function buildRfpFromRequest(
  request: RequestForRfp,
  rawMapping: unknown,
  commodities: { code: string; description: string }[],
) {
  const mapping = normalizeRfpMapping(rawMapping);
  const vars = {
    documentNumber: request.documentNumber,
    documentType: request.documentType,
    creator: request.creator ?? "",
    requestDate: request.requestDate ? request.requestDate.toISOString().slice(0, 10) : "",
    commodity: request.commodity ?? "",
  };

  const pick = (line: RequestForRfp["lines"][number], source: RfpItemSource | "") =>
    source ? line[source] : null;

  const items: NewItemInput[] = request.lines.map((line) => {
    const quantity = Number(pick(line, mapping.item.quantity));
    const price = pick(line, mapping.item.historicalPrice);
    return {
      section: null,
      code: String(pick(line, mapping.item.code) ?? "").trim() || null,
      name: String(pick(line, mapping.item.name) ?? "").trim() || line.description,
      description: String(pick(line, mapping.item.description) ?? "").trim(),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit: String(pick(line, mapping.item.unit) ?? "").trim() || "unidad",
      weight: 1,
      decimals: 2,
      historicalPrice: price === null || Number.isNaN(Number(price)) ? null : Number(price),
      commodity: matchCommodity(String(pick(line, mapping.item.commodity) ?? ""), commodities),
      customFields: [],
    };
  });

  const estimated = mapping.estimatedFromLines
    ? items.reduce((sum, i) => sum + i.quantity * (i.historicalPrice ?? 0), 0)
    : 0;

  return {
    title:
      fillTemplate(mapping.titleTemplate, vars) ||
      `${request.documentType} ${request.documentNumber}`,
    description: fillTemplate(mapping.descriptionTemplate, vars),
    predecessorDocument: fillTemplate(mapping.predecessorTemplate, vars),
    commodity: matchCommodity(request.commodity, commodities) ?? "",
    estimatedPrice: estimated > 0 ? String(Math.round(estimated * 100) / 100) : "",
    items,
  };
}
