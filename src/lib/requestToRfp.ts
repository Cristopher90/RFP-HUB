import type { NewItemInput } from "@/app/rfps/new/actions";
import { normalizeRfpMapping, type RfpItemSource } from "@/lib/requestFields";
import {
  REQUEST_SOURCE_PREFIX,
  coerceValue,
  displayValue,
  type CustomFieldDef,
} from "@/lib/customFieldsShared";

// Custom (REQUEST_HEAD / REQUEST_LINE) values of a request, to use as sources.
export type RequestCustomData = {
  fields: CustomFieldDef[];
  header: Record<string, string>;
  lines: Record<string, string>[]; // aligned with request.lines
};

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
  customFields: CustomFieldDef[] = [],
  requestCustom?: RequestCustomData,
) {
  const mapping = normalizeRfpMapping(rawMapping);
  const vars: Record<string, string> = {
    documentNumber: request.documentNumber,
    documentType: request.documentType,
    creator: request.creator ?? "",
    requestDate: request.requestDate ? request.requestDate.toISOString().slice(0, 10) : "",
    commodity: request.commodity ?? "",
  };

  // Request custom fields as sources ("rc:<key>"), shown the way a person reads them.
  const requestFields = requestCustom?.fields ?? [];
  const show = (field: CustomFieldDef, raw: string | undefined) =>
    raw === undefined ? "" : displayValue(field, raw, "es", (n) => n.toFixed(2));
  for (const field of requestFields.filter((f) => f.scope === "REQUEST_HEAD")) {
    vars[field.key] = show(field, requestCustom?.header[field.key]);
  }
  const headerSource = (source: string): string => {
    if (source.startsWith(REQUEST_SOURCE_PREFIX)) return vars[source.slice(REQUEST_SOURCE_PREFIX.length)] ?? "";
    return vars[source] ?? "";
  };
  const lineCustomOf = (index: number, source: string): string => {
    const key = source.slice(REQUEST_SOURCE_PREFIX.length);
    const field = requestFields.find((f) => f.scope === "REQUEST_LINE" && f.key === key);
    return field ? show(field, requestCustom?.lines[index]?.[key]) : "";
  };

  const pick = (
    line: RequestForRfp["lines"][number],
    index: number,
    source: string,
  ): string | number | null => {
    if (!source) return null;
    if (source.startsWith(REQUEST_SOURCE_PREFIX)) return lineCustomOf(index, source);
    return line[source as RfpItemSource];
  };

  // Mappable custom fields filled from the request (header and lines).
  const customValues: Record<string, string> = {};
  for (const field of customFields.filter((f) => f.scope === "RFP_HEAD")) {
    const source = mapping.customHead[field.key];
    if (!source) continue;
    const value = coerceValue(field, headerSource(source));
    if (value !== "") customValues[field.key] = value;
  }
  const lineFields = customFields.filter((f) => f.scope === "RFP_LINE");

  const items: NewItemInput[] = request.lines.map((line, index) => {
    const lineCustom: Record<string, string> = {};
    for (const field of lineFields) {
      const source = mapping.customLine[field.key];
      if (!source) continue;
      const value = coerceValue(field, pick(line, index, source));
      if (value !== "") lineCustom[field.key] = value;
    }
    const quantity = Number(pick(line, index, mapping.item.quantity));
    const price = pick(line, index, mapping.item.historicalPrice);
    return {
      section: null,
      code: String(pick(line, index, mapping.item.code) ?? "").trim() || null,
      name: String(pick(line, index, mapping.item.name) ?? "").trim() || line.description,
      description: String(pick(line, index, mapping.item.description) ?? "").trim(),
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit: String(pick(line, index, mapping.item.unit) ?? "").trim() || "unidad",
      weight: 1,
      decimals: 2,
      historicalPrice: price === null || Number.isNaN(Number(price)) ? null : Number(price),
      commodity: matchCommodity(String(pick(line, index, mapping.item.commodity) ?? ""), commodities),
      customFields: [],
      customValues: lineCustom,
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
    customValues,
    items,
  };
}
