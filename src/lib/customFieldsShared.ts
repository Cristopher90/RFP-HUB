import { canSeeByGroups, filterTreeByGroups, type ViewGroupUser } from "@/lib/viewGroups";
// Client-safe pieces of the custom-fields feature (types, label/option helpers,
// condition evaluation, Excel-import parsing). Nothing here touches the DB.

export type CfType =
  | "TREE"
  | "TEXT"
  | "TEXT_SHORT"
  | "NUMBER"
  | "DROPDOWN"
  | "AMOUNT"
  | "CHECKBOX";
export type CfScope = "RFP_HEAD" | "RFP_LINE" | "USER" | "REQUEST_HEAD" | "REQUEST_LINE";

export const CF_TYPES: CfType[] = [
  "TREE",
  "TEXT",
  "TEXT_SHORT",
  "NUMBER",
  "DROPDOWN",
  "AMOUNT",
  "CHECKBOX",
];
export const CF_SCOPES: CfScope[] = ["RFP_HEAD", "RFP_LINE", "USER", "REQUEST_HEAD", "REQUEST_LINE"];

export function isRequestScope(scope: CfScope) {
  return scope === "REQUEST_HEAD" || scope === "REQUEST_LINE";
}

// Which "entityType" a scope's values are stored under in CustomFieldValue.
export function entityTypeOfScope(scope: CfScope): "RFP" | "RFP_LINE" | "USER" | "REQUEST" | "REQUEST_LINE" {
  switch (scope) {
    case "RFP_HEAD":
      return "RFP";
    case "RFP_LINE":
      return "RFP_LINE";
    case "USER":
      return "USER";
    case "REQUEST_HEAD":
      return "REQUEST";
    case "REQUEST_LINE":
      return "REQUEST_LINE";
  }
}
export const CF_TEXT_MAX = 50;
export const CF_TEXT_SHORT_MAX = 10;

export type CfOption = {
  value: string;
  parent: string | null;
  labels: Record<string, string>;
  // From the lookup value: the view groups that can see it.
  viewGroupIds?: string[];
  // Set for a given viewer when view groups hide this value from them: it is
  // not offered, but a value already stored with it stays valid.
  hidden?: boolean;
};

export type CfConditionKind =
  | "HEADER_STD"
  | "HEADER_CUSTOM"
  | "LINE_STD"
  | "LINE_CUSTOM"
  | "USER_CUSTOM";

export type CfCondition = {
  kind: CfConditionKind;
  field: string;
  // filled / empty: the source field has (or lacks) any value.
  op: "eq" | "neq" | "filled" | "empty";
  value: string;
};

export type CustomFieldDef = {
  id: string;
  key: string;
  scope: CfScope;
  type: CfType;
  mandatory: boolean;
  // visible=false: the value exists (conditions, mappings) but isn't shown.
  // editable=false: shown, but can't be changed by hand.
  visible: boolean;
  editable: boolean;
  labels: Record<string, string>;
  options: CfOption[];
  lookupId: string | null; // DROPDOWN/TREE: the lookup the values come from
  viewGroupIds: string[]; // view groups that can see the field (empty = everyone)
  condition: CfCondition | null;
  mappable: boolean;
  importable: boolean;
  templateFilter: boolean;
  listFilter: boolean;
  mapToRfpKey: string | null;
  active: boolean;
  order: number;
};

// A user field's "copy to RFP" target: a standard header field ("buyerName")
// or a custom RFP header field ("custom:<key>").
export const CUSTOM_TARGET_PREFIX = "custom:";
// A request custom field used as a source in the request → RFP mapping.
export const REQUEST_SOURCE_PREFIX = "rc:";

// Standard fields a condition (or a user-field → RFP mapping) can point at.
export const HEADER_STD_FIELDS = [
  "commodity",
  "region",
  "origin",
  "buyerName",
  "estimatedPrice",
] as const;
export const LINE_STD_FIELDS = ["section", "code", "name", "unit", "commodity"] as const;
// Header text fields a USER field can be copied into when starting an RFP.
export const USER_MAPPABLE_RFP_FIELDS = ["buyerName", "commodity", "region", "origin"] as const;

export function hasOptions(type: CfType) {
  return type === "TREE" || type === "DROPDOWN";
}

// Translated label of a field: the viewer's language, then Spanish, then any.
export function labelFor(
  labels: Record<string, string> | null | undefined,
  language: string,
  fallback = "",
): string {
  if (!labels) return fallback;
  return (
    labels[language]?.trim() ||
    labels.es?.trim() ||
    Object.values(labels).find((v) => v?.trim()) ||
    fallback
  );
}

export function optionLabel(opt: CfOption, language: string): string {
  return labelFor(opt.labels, language, opt.value);
}

// Display text for a stored value.
export function displayValue(
  field: CustomFieldDef,
  raw: string | null | undefined,
  language: string,
  formatAmount: (n: number) => string,
  yes = "Sí",
  no = "No",
): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (field.type === "CHECKBOX") return raw === "true" ? yes : no;
  if (hasOptions(field.type)) {
    const opt = field.options.find((o) => o.value === raw);
    return opt ? optionLabel(opt, language) : raw;
  }
  if (field.type === "AMOUNT") {
    const n = Number(raw);
    return Number.isFinite(n) ? formatAmount(n) : raw;
  }
  return raw;
}

// What each condition source currently holds. Missing keys read as "".
export type CfContext = {
  headerStd: Record<string, string>;
  headerCustom: Record<string, string>;
  lineStd: Record<string, string>;
  lineCustom: Record<string, string>;
  userCustom: Record<string, string>;
};

export function emptyContext(): CfContext {
  return { headerStd: {}, headerCustom: {}, lineStd: {}, lineCustom: {}, userCustom: {} };
}

function norm(v: string | undefined | null) {
  return (v ?? "").trim().toLowerCase();
}

export function conditionHolds(cond: CfCondition | null, ctx: CfContext): boolean {
  if (!cond) return true;
  const source =
    cond.kind === "HEADER_STD"
      ? ctx.headerStd
      : cond.kind === "HEADER_CUSTOM"
        ? ctx.headerCustom
        : cond.kind === "LINE_STD"
          ? ctx.lineStd
          : cond.kind === "LINE_CUSTOM"
            ? ctx.lineCustom
            : ctx.userCustom;
  const current = norm(source[cond.field]);
  if (cond.op === "filled") return current !== "";
  if (cond.op === "empty") return current === "";
  // A checkbox that was never touched is "false".
  const effective = current === "" && norm(cond.value) === "false" ? "false" : current;
  const equal = effective === norm(cond.value);
  return cond.op === "neq" ? !equal : equal;
}

// A field is shown when it's active and its condition (if any) holds.
export function isFieldVisible(field: CustomFieldDef, ctx: CfContext): boolean {
  return field.active && conditionHolds(field.condition, ctx);
}

// Children of a tree option, and all of its descendants' values.
export function treeNodes(options: CfOption[], language: string, keep?: string) {
  return options
    .filter((o) => !o.hidden || o.value === keep)
    .map((o) => ({
      id: o.value,
      parentId: o.parent,
      label: optionLabel(o, language),
      code: "",
    }));
}

// Normalises a raw input to its stored string, or an error code.
export function normalizeValue(
  field: Pick<CustomFieldDef, "type" | "options">,
  raw: string,
): { value: string } | { error: "invalid" | "tooLong" } {
  const v = (raw ?? "").trim();
  if (v === "") return { value: "" };
  switch (field.type) {
    case "TEXT":
      return v.length > CF_TEXT_MAX ? { error: "tooLong" } : { value: v };
    case "TEXT_SHORT":
      return v.length > CF_TEXT_SHORT_MAX ? { error: "tooLong" } : { value: v };
    case "NUMBER": {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? { value: String(n) } : { error: "invalid" };
    }
    case "AMOUNT": {
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? { value: n.toFixed(2) } : { error: "invalid" };
    }
    case "CHECKBOX":
      return { value: v === "true" ? "true" : "false" };
    case "DROPDOWN":
    case "TREE":
      return field.options.some((o) => o.value === v) ? { value: v } : { error: "invalid" };
  }
}

// ---------- Excel import (sheet "cus_Cliente") ----------

export type ImportedField = {
  clientCode: string;
  key: string;
  scope: CfScope;
  type: CfType;
  mandatory: boolean;
  visible: boolean;
  editable: boolean;
  labels: Record<string, string>;
  options: CfOption[];
  conditionText: string;
  lookupName: string; // optional "lookup" column: an existing/new lookup to use
  mappable: boolean;
  importable: boolean;
  templateFilter: boolean;
  listFilter: boolean;
};

export function parseScope(raw: string): CfScope | null {
  const v = norm(raw).replace(/[\s-]/g, "_");
  if (v === "rfp_head" || v === "rfp_header" || v === "head" || v === "cabecera") return "RFP_HEAD";
  if (v === "rfp_line" || v === "line" || v === "linea" || v === "línea" || v === "posicion" || v === "posición")
    return "RFP_LINE";
  if (v === "user" || v === "usuario") return "USER";
  if (v === "request_head" || v === "request_header" || v === "solicitud" || v === "solicitud_cabecera")
    return "REQUEST_HEAD";
  if (v === "request_line" || v === "solicitud_linea" || v === "solicitud_línea" || v === "solicitud_posicion")
    return "REQUEST_LINE";
  return null;
}

export function parseType(raw: string): CfType | null {
  const v = norm(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
  if (/^(text|texto)\(10\)$/.test(v) || v === "textocorto" || v === "text_short" || v === "shorttext")
    return "TEXT_SHORT";
  if (v === "text" || v === "texto" || /^(text|texto)\(50\)$/.test(v)) return "TEXT";
  if (v === "desplegable" || v === "dropdown" || v === "select" || v === "lista") return "DROPDOWN";
  if (v === "arbol" || v === "tree" || /rbol$/.test(v)) return "TREE";
  if (v === "numero" || v === "number") return "NUMBER";
  if (v === "valor" || v === "importe" || v === "amount" || v === "monto") return "AMOUNT";
  if (v === "checkbox" || v === "check" || v === "casilla") return "CHECKBOX";
  return null;
}

export function parseBool(raw: unknown): boolean {
  const v = norm(String(raw ?? ""));
  return v === "true" || v === "si" || v === "sí" || v === "x" || v === "1" || v === "yes" || v === "y";
}

// "alta, media, baja" → options. For trees a value may be a path "Europa>España"
// (parents are created implicitly). `enValues` aligns by position with the
// Spanish list and provides the English label of each leaf.
export function parseOptionList(
  raw: string,
  type: CfType,
  enValues?: string,
): CfOption[] {
  const entries = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const en = (enValues ?? "").split(",").map((s) => s.trim());
  const out = new Map<string, CfOption>();
  entries.forEach((entry, idx) => {
    const path = (type === "TREE" ? entry.split(">") : [entry]).map((s) => s.trim()).filter(Boolean);
    path.forEach((segment, depth) => {
      const parent = depth > 0 ? path[depth - 1] : null;
      if (!out.has(segment)) {
        out.set(segment, { value: segment, parent, labels: { es: segment } });
      }
      if (depth === path.length - 1 && en[idx]) {
        out.get(segment)!.labels.en = type === "TREE" ? en[idx].split(">").pop()!.trim() : en[idx];
      }
    });
  });
  return [...out.values()];
}

// "Si (prioridad = true)" / "If (priority <> high)" → pieces.
export function parseConditionText(
  text: string,
): { field: string; op: "eq" | "neq"; value: string } | null {
  const m = (text ?? "")
    .trim()
    .match(/^(?:si|if)?\s*\(?\s*([^=<>!()]+?)\s*(=|==|<>|!=)\s*([^)]*?)\s*\)?\s*$/i);
  if (!m) return null;
  return {
    field: m[1].trim(),
    op: m[2] === "<>" || m[2] === "!=" ? "neq" : "eq",
    value: m[3].trim(),
  };
}

// Reads the rows of the "cus_Cliente" sheet (header row first).
export function parseImportRows(rows: unknown[][]): {
  fields: ImportedField[];
  errors: string[];
} {
  const errors: string[] = [];
  if (rows.length === 0) return { fields: [], errors: ["empty"] };
  const header = rows[0].map((h) => norm(String(h ?? "")));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const cClient = col("cliente", "client");
  const cScope = col("document_type", "documenttype", "tipo_documento");
  const cKey = col("id_campo", "id", "campo");
  const cName = col("name", "nombre");
  const cNameEn = col("name_en", "nombre_en");
  const cMand = col("mandatory", "obligatorio");
  const cCond = col("condition", "condicion", "condición");
  const cType = col("type", "tipo");
  const cValues = col("values", "valores");
  const cValuesEn = col("values_en", "valores_en");
  const cMap = col("mappable", "mapeable");
  const cImp = col("importable", "importar");
  const cLookup = col("lookup", "lista");
  const cVis = col("visible", "visibles");
  const cEdit = col("editable", "editables");
  const cTpl = col("templatefilter", "filtro_plantilla");
  const cList = col("listfilter", "filtro_lista");
  if (cClient < 0 || cScope < 0 || cKey < 0 || cType < 0) {
    return { fields: [], errors: ["columns"] };
  }
  const cell = (row: unknown[], idx: number) => (idx < 0 ? "" : String(row[idx] ?? "").trim());
  const fields: ImportedField[] = [];
  rows.slice(1).forEach((row, i) => {
    if (!row || row.every((c) => String(c ?? "").trim() === "")) return;
    const line = i + 2;
    const scope = parseScope(cell(row, cScope));
    const type = parseType(cell(row, cType));
    const key = cell(row, cKey);
    if (!key || !scope || !type) {
      errors.push(`${line}`);
      return;
    }
    const name = cell(row, cName) || key;
    const nameEn = cell(row, cNameEn);
    fields.push({
      clientCode: cell(row, cClient),
      key,
      scope,
      type,
      mandatory: parseBool(row[cMand]),
      visible: cVis >= 0 && String(row[cVis] ?? "").trim() !== "" ? parseBool(row[cVis]) : true,
      editable: cEdit >= 0 && String(row[cEdit] ?? "").trim() !== "" ? parseBool(row[cEdit]) : true,
      labels: nameEn ? { es: name, en: nameEn } : { es: name },
      options: hasOptions(type) ? parseOptionList(cell(row, cValues), type, cell(row, cValuesEn)) : [],
      conditionText: cell(row, cCond),
      lookupName: cell(row, cLookup),
      mappable: parseBool(row[cMap]),
      importable: cImp >= 0 ? parseBool(row[cImp]) : isRequestScope(scope),
      templateFilter: parseBool(row[cTpl]),
      listFilter: parseBool(row[cList]),
    });
  });
  return { fields, errors };
}

// Valid field ids: lowercase letters, digits and underscore.
export function sanitizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Which of `fields` are visible given the raw values entered so far. A field
// whose condition depends on another custom field that is itself hidden counts
// that hidden field as empty, so this settles by iterating until stable.
export function visibleFields(
  fields: CustomFieldDef[],
  raw: Record<string, string>,
  ctx: CfContext,
  slot: "headerCustom" | "lineCustom" | "userCustom",
): CustomFieldDef[] {
  let current = fields.filter((f) => f.active);
  for (let i = 0; i < 6; i++) {
    const keys = new Set(current.map((f) => f.key));
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) if (keys.has(k)) values[k] = v;
    const next = fields.filter((f) => isFieldVisible(f, { ...ctx, [slot]: values }));
    if (next.length === current.length && next.every((f, idx) => f === current[idx])) {
      return next;
    }
    current = next;
  }
  return current;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

// Snapshot of the standard header / line values a condition can look at.
export function headerStdSnapshot(h: {
  commodity?: string | null;
  region?: string | null;
  origin?: string | null;
  buyerName?: string | null;
  estimatedPrice?: number | string | null;
}): Record<string, string> {
  return {
    commodity: str(h.commodity),
    region: str(h.region),
    origin: str(h.origin),
    buyerName: str(h.buyerName),
    estimatedPrice: str(h.estimatedPrice),
  };
}

export function lineStdSnapshot(l: {
  section?: string | null;
  code?: string | null;
  name?: string | null;
  unit?: string | null;
  commodity?: string | null;
}): Record<string, string> {
  return {
    section: str(l.section),
    code: str(l.code),
    name: str(l.name),
    unit: str(l.unit),
    commodity: str(l.commodity),
  };
}

// Best-effort conversion of free text (e.g. a value from a purchase request)
// into the stored form of `field`; "" when it doesn't fit.
export function coerceValue(
  field: Pick<CustomFieldDef, "type" | "options">,
  raw: unknown,
): string {
  const text = str(raw);
  if (text === "") return "";
  if (hasOptions(field.type)) {
    const needle = text.toLowerCase();
    const opt = field.options.find(
      (o) =>
        o.value.toLowerCase() === needle ||
        Object.values(o.labels).some((l) => l.trim().toLowerCase() === needle),
    );
    return opt ? opt.value : "";
  }
  if (field.type === "CHECKBOX") return parseBool(text) ? "true" : "false";
  if (field.type === "TEXT") return text.slice(0, CF_TEXT_MAX);
  if (field.type === "TEXT_SHORT") return text.slice(0, CF_TEXT_SHORT_MAX);
  const normalized = normalizeValue(field, text);
  return "value" in normalized ? normalized.value : "";
}

// Adapts field definitions to who is looking (view groups): a field the viewer
// can't see becomes hidden and read-only (it stays for conditions and keeps its
// stored value), and lookup values they can't see are flagged `hidden`
// (children of a hidden value move up so the tree stays navigable).
export function applyViewGroupsToFields(fields: CustomFieldDef[], user: ViewGroupUser): CustomFieldDef[] {
  return fields.map((field) => {
    let next = field;
    if (!canSeeByGroups(user, field.viewGroupIds)) next = { ...next, visible: false, editable: false };
    if (next.options.length > 0) {
      const nodes = next.options.map((o) => ({ id: o.value, parentId: o.parent, viewGroupIds: o.viewGroupIds }));
      const visibleNodes = new Map(filterTreeByGroups(nodes, user).map((n) => [n.id, n]));
      next = {
        ...next,
        options: next.options.map((o) => {
          const node = visibleNodes.get(o.value);
          return node ? { ...o, parent: node.parentId } : { ...o, hidden: true };
        }),
      };
    }
    return next;
  });
}
