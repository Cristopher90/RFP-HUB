import "server-only";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import {
  applyViewGroupsToFields,
  headerStdSnapshot,
  labelFor,
  lineStdSnapshot,
  normalizeValue,
  visibleFields,
  type CfCondition,
  type CfContext,
  type CfOption,
  type CfScope,
  type CustomFieldDef,
} from "@/lib/customFieldsShared";
import type { CustomField } from "@/generated/prisma/client";

// Values live in one physical table per client: "CustomFieldValue" is a
// Postgres table partitioned by LIST on "clientId", and each client's rows sit
// in their own partition custom_values_<clientId>. Prisma only knows the parent.
export function partitionName(clientId: string) {
  return `custom_values_${clientId.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
}

export async function ensureCustomValuesPartition(clientId: string) {
  const name = partitionName(clientId);
  const exists = await prisma.$queryRawUnsafe<{ reg: string | null }[]>(
    `SELECT to_regclass('public."${name}"')::text AS reg`,
  );
  if (exists[0]?.reg) return;
  const safeId = clientId.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF "CustomFieldValue" FOR VALUES IN ('${safeId}')`,
  );
}

export async function dropCustomValuesPartition(clientId: string) {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${partitionName(clientId)}"`);
}

export function toDef(row: CustomField, lookupOptions?: CfOption[]): CustomFieldDef {
  return {
    id: row.id,
    key: row.key,
    scope: row.scope,
    type: row.type,
    mandatory: row.mandatory,
    visible: row.visible,
    editable: row.editable,
    labels: (row.labels ?? {}) as Record<string, string>,
    // Values come from the field's lookup; fields saved before lookups existed
    // still carry their options inline.
    options:
      lookupOptions ??
      (Array.isArray(row.options) ? (row.options as unknown as CfOption[]) : []),
    lookupId: row.lookupId,
    viewGroupIds: row.viewGroupIds ?? [],
    condition: (row.condition ?? null) as CfCondition | null,
    mappable: row.mappable,
    importable: row.importable,
    templateFilter: row.templateFilter,
    listFilter: row.listFilter,
    mapToRfpKey: row.mapToRfpKey,
    active: row.active,
    order: row.order,
  };
}

// The values of a lookup as field options (code stored, Spanish/English text,
// parent code for trees, view groups per value).
export async function loadLookupOptions(lookupIds: string[]): Promise<Map<string, CfOption[]>> {
  const map = new Map<string, CfOption[]>();
  if (lookupIds.length === 0) return map;
  const values = await prisma.lookupValue.findMany({
    where: { lookupId: { in: lookupIds } },
    orderBy: [{ order: "asc" }, { code: "asc" }],
  });
  const codeById = new Map(values.map((v) => [v.id, v.code]));
  for (const v of values) {
    const list = map.get(v.lookupId) ?? [];
    list.push({
      value: v.code,
      parent: v.parentId ? (codeById.get(v.parentId) ?? null) : null,
      labels: v.descriptionEn ? { es: v.description, en: v.descriptionEn } : { es: v.description },
      viewGroupIds: v.viewGroupIds,
    });
    map.set(v.lookupId, list);
  }
  return map;
}

export async function loadCustomFields(
  clientId: string,
  scope?: CfScope,
  onlyActive = true,
): Promise<CustomFieldDef[]> {
  const rows = await prisma.customField.findMany({
    where: { clientId, ...(scope ? { scope } : {}), ...(onlyActive ? { active: true } : {}) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const lookups = await loadLookupOptions([
    ...new Set(rows.map((r) => r.lookupId).filter((id): id is string => Boolean(id))),
  ]);
  return rows.map((r) => toDef(r, r.lookupId ? (lookups.get(r.lookupId) ?? []) : undefined));
}

export type CustomEntityType = "RFP" | "RFP_LINE" | "USER" | "REQUEST" | "REQUEST_LINE" | "SUPPLIER";

export async function readCustomValues(
  clientId: string,
  entityType: CustomEntityType,
  entityIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  if (entityIds.length === 0) return map;
  const rows = await prisma.customFieldValue.findMany({
    where: { clientId, entityType, entityId: { in: entityIds } },
  });
  for (const r of rows) {
    if (r.value === null) continue;
    const bucket = map.get(r.entityId) ?? {};
    bucket[r.fieldKey] = r.value;
    map.set(r.entityId, bucket);
  }
  return map;
}

// Replaces every stored value of one entity with `values` (empty ones dropped).
export async function saveCustomValues(
  clientId: string,
  entityType: CustomEntityType,
  entityId: string,
  values: Record<string, string>,
) {
  await ensureCustomValuesPartition(clientId);
  const entries = Object.entries(values).filter(([, v]) => v !== "");
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany({ where: { clientId, entityType, entityId } }),
    prisma.customFieldValue.createMany({
      data: entries.map(([fieldKey, value]) => ({
        clientId,
        entityType,
        entityId,
        fieldKey,
        value,
      })),
    }),
  ]);
}

export async function deleteCustomValues(
  clientId: string,
  entityType: CustomEntityType,
  entityIds: string[],
) {
  if (entityIds.length === 0) return;
  await prisma.customFieldValue.deleteMany({
    where: { clientId, entityType, entityId: { in: entityIds } },
  });
}

export type CustomValueError = {
  code: "mandatory" | "invalid" | "tooLong";
  field: CustomFieldDef;
};

// Keeps only visible fields, normalises each value and (when `enforce`)
// requires the mandatory visible ones. Values of hidden fields are dropped.
export function prepareCustomValues(
  fields: CustomFieldDef[],
  raw: Record<string, string> | undefined,
  ctx: CfContext,
  slot: "headerCustom" | "lineCustom" | "userCustom",
  enforce: boolean,
): { values: Record<string, string> } | { error: CustomValueError } {
  const input = raw ?? {};
  const visible = visibleFields(fields, input, ctx, slot);
  const values: Record<string, string> = {};
  for (const field of visible) {
    const normalized = normalizeValue(field, input[field.key] ?? "");
    if ("error" in normalized) return { error: { code: normalized.error, field } };
    // An unchecked checkbox is still an answer; only blanks count as missing.
    const filled = normalized.value !== "" && (field.type !== "CHECKBOX" || normalized.value === "true");
    // A hidden field can't be filled by hand, so it is never demanded.
    if (enforce && field.mandatory && field.visible && !filled && field.type !== "CHECKBOX") {
      return { error: { code: "mandatory", field } };
    }
    if (normalized.value !== "") values[field.key] = normalized.value;
  }
  return { values };
}

// RFP ids (of one client) whose header custom values satisfy every filter.
export async function rfpIdsMatchingCustom(
  clientId: string,
  filters: { key: string; value: string }[],
): Promise<string[] | null> {
  if (filters.length === 0) return null;
  let result: string[] | null = null;
  for (const f of filters) {
    const rows: { entityId: string }[] = await prisma.customFieldValue.findMany({
      where: { clientId, entityType: "RFP", fieldKey: f.key, value: f.value },
      select: { entityId: true },
    });
    const found = new Set(rows.map((r) => r.entityId));
    result = result ? result.filter((id) => found.has(id)) : [...found];
  }
  return result ?? [];
}

export type HeaderStd = {
  commodity?: string | null;
  region?: string | null;
  origin?: string | null;
  buyerName?: string | null;
  estimatedPrice?: number | string | null;
};
export type LineStd = {
  section?: string | null;
  code?: string | null;
  name?: string | null;
  unit?: string | null;
  commodity?: string | null;
};

export const headerStdContext = headerStdSnapshot;
export const lineStdContext = lineStdSnapshot;

function errorText(language: string, e: CustomValueError, linePrefix: string) {
  const d = getDictionary(language).customFields;
  const label = labelFor(e.field.labels, language, e.field.key);
  const template =
    e.code === "mandatory" ? d.errMandatory : e.code === "tooLong" ? d.errTooLong : d.errInvalid;
  return linePrefix + template.replace("{field}", label);
}

// Validates and normalises the custom values of a whole RFP (header + lines)
// against the client's field definitions. Hidden fields are dropped;
// mandatory visible ones are required when `enforce` (i.e. not a draft).
export async function validateRfpCustom(args: {
  clientId: string;
  headerStd: HeaderStd;
  headerRaw: Record<string, string> | undefined;
  lines: { std: LineStd; raw: Record<string, string> | undefined }[];
  enforce: boolean;
  language: string;
  fields?: CustomFieldDef[];
}): Promise<
  | { error: string }
  | { header: Record<string, string>; lines: Record<string, string>[] }
> {
  const fields = args.fields ?? (await loadCustomFields(args.clientId));
  const headFields = fields.filter((f) => f.scope === "RFP_HEAD");
  const lineFields = fields.filter((f) => f.scope === "RFP_LINE");
  const headerStd = headerStdContext(args.headerStd);
  const base: CfContext = {
    headerStd,
    headerCustom: {},
    lineStd: {},
    lineCustom: {},
    userCustom: {},
  };
  const header = prepareCustomValues(headFields, args.headerRaw, base, "headerCustom", args.enforce);
  if ("error" in header) return { error: errorText(args.language, header.error, "") };
  const lines: Record<string, string>[] = [];
  for (const [i, line] of args.lines.entries()) {
    const ctx: CfContext = {
      ...base,
      headerCustom: header.values,
      lineStd: lineStdContext(line.std),
    };
    const r = prepareCustomValues(lineFields, line.raw, ctx, "lineCustom", args.enforce);
    if ("error" in r) {
      const prefix = getDictionary(args.language).customFields.linePrefix.replace("{n}", String(i + 1));
      return { error: errorText(args.language, r.error, prefix) };
    }
    lines.push(r.values);
  }
  return { header: header.values, lines };
}

// Publishing a saved draft: checks the stored values still satisfy the
// mandatory fields (drafts are allowed to be incomplete).
export async function validateStoredRfpCustom(
  rfpId: string,
  language: string,
  viewer?: { role: string; viewGroupIds: string[] },
): Promise<string | null> {
  const rfp = await prisma.rfp.findUnique({
    where: { id: rfpId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!rfp) return null;
  const loaded = await loadCustomFields(rfp.clientId);
  // A field the publisher can't see through view groups is never demanded of them.
  const fields = viewer ? applyViewGroupsToFields(loaded, viewer) : loaded;
  if (fields.length === 0) return null;
  const [headerMap, lineMap] = await Promise.all([
    readCustomValues(rfp.clientId, "RFP", [rfp.id]),
    readCustomValues(rfp.clientId, "RFP_LINE", rfp.items.map((i) => i.id)),
  ]);
  const result = await validateRfpCustom({
    clientId: rfp.clientId,
    headerStd: rfp,
    headerRaw: headerMap.get(rfp.id),
    lines: rfp.items.map((i) => ({ std: i, raw: lineMap.get(i.id) })),
    enforce: true,
    language,
    fields,
  });
  return "error" in result ? result.error : null;
}
