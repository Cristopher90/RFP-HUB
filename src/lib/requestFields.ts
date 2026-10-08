// Fields of a purchase request (Solicitud) and how an import template maps
// Excel columns onto them. Client-safe: no server imports.

// Roles that can be assigned requests (and be buyer-group members).
export const BUYER_ROLES = ["BUYER", "SENIOR_BUYER", "CLIENT_ADMIN"] as const;

export const HEADER_FIELDS = [
  "documentNumber",
  "documentType",
  "creator",
  "requestDate",
  "commodity",
] as const;
export type HeaderField = (typeof HEADER_FIELDS)[number];

export const LINE_FIELDS = [
  "documentNumber",
  "documentType",
  "position",
  "itemCode",
  "description",
  "historicalPrice",
  "quantity",
  "unit",
  "commodity",
] as const;
export type LineField = (typeof LINE_FIELDS)[number];

// MASS: one file holds many requests and each line carries its document
// number to link back to its header. SINGLE: one file per request, so every
// line belongs to the header's request and needs no document number.
export const IMPORT_MODES = ["MASS", "SINGLE"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export function isImportMode(value: string): value is ImportMode {
  return (IMPORT_MODES as readonly string[]).includes(value);
}

// Must be mapped for a template to be usable. The document type can instead
// be a fixed value (documentTypeFixed) when the file has no such column.
export const REQUIRED_HEADER_FIELDS: HeaderField[] = ["documentNumber"];

export function lineFieldsFor(mode: ImportMode): LineField[] {
  return mode === "SINGLE"
    ? LINE_FIELDS.filter((f) => f !== "documentNumber" && f !== "documentType")
    : [...LINE_FIELDS];
}

export function requiredLineFields(mode: ImportMode): LineField[] {
  return mode === "SINGLE" ? ["description", "quantity"] : ["documentNumber", "description", "quantity"];
}

// Excel column header per field ("" = not mapped).
export type HeaderMapping = Partial<Record<HeaderField, string>> & { documentTypeFixed?: string };
export type LinesMapping = Partial<Record<LineField, string>>;

// Request line fields that can feed an RFP item.
export const RFP_ITEM_SOURCES = [
  "itemCode",
  "description",
  "position",
  "historicalPrice",
  "quantity",
  "unit",
  "commodity",
] as const;
export type RfpItemSource = (typeof RFP_ITEM_SOURCES)[number];

export const RFP_ITEM_TARGETS = [
  "code",
  "name",
  "description",
  "quantity",
  "unit",
  "historicalPrice",
  "commodity",
] as const;
export type RfpItemTarget = (typeof RFP_ITEM_TARGETS)[number];

// Placeholders usable in the RFP title/description/predecessor templates.
export const REQUEST_PLACEHOLDERS = [
  "documentNumber",
  "documentType",
  "creator",
  "requestDate",
  "commodity",
] as const;

export type RfpMapping = {
  titleTemplate: string;
  descriptionTemplate: string;
  predecessorTemplate: string;
  estimatedFromLines: boolean;
  item: Record<RfpItemTarget, RfpItemSource | "">;
};

export const DEFAULT_RFP_MAPPING: RfpMapping = {
  titleTemplate: "{documentType} {documentNumber}",
  descriptionTemplate: "",
  predecessorTemplate: "{documentNumber}",
  estimatedFromLines: false,
  item: {
    code: "itemCode",
    name: "description",
    description: "",
    quantity: "quantity",
    unit: "unit",
    historicalPrice: "historicalPrice",
    commodity: "commodity",
  },
};

export function normalizeRfpMapping(raw: unknown): RfpMapping {
  const value = (raw ?? {}) as Partial<RfpMapping>;
  const item = { ...DEFAULT_RFP_MAPPING.item, ...(value.item ?? {}) };
  return {
    titleTemplate: value.titleTemplate ?? DEFAULT_RFP_MAPPING.titleTemplate,
    descriptionTemplate: value.descriptionTemplate ?? DEFAULT_RFP_MAPPING.descriptionTemplate,
    predecessorTemplate: value.predecessorTemplate ?? DEFAULT_RFP_MAPPING.predecessorTemplate,
    estimatedFromLines: value.estimatedFromLines ?? DEFAULT_RFP_MAPPING.estimatedFromLines,
    item,
  };
}
