"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { ensureCustomValuesPartition, loadCustomFields } from "@/lib/customFields";
import { upsertLookupValues } from "@/lib/lookups";
import { validViewGroupIds } from "@/lib/viewGroupsServer";
import {
  CF_SCOPES,
  CF_TYPES,
  CUSTOM_TARGET_PREFIX,
  entityTypeOfScope,
  isRequestScope,
  HEADER_STD_FIELDS,
  LINE_STD_FIELDS,
  USER_MAPPABLE_RFP_FIELDS,
  hasOptions,
  parseConditionText,
  sanitizeKey,
  type CfCondition,
  type CfConditionKind,
  type CfOption,
  type CfScope,
  type CfType,
  type ImportedField,
} from "@/lib/customFieldsShared";

export type CustomFieldInput = {
  id?: string;
  key: string;
  scope: CfScope;
  type: CfType;
  mandatory: boolean;
  visible: boolean;
  editable: boolean;
  labels: Record<string, string>;
  lookupId: string | null; // DROPDOWN/TREE: lista de valores (Lookup) del cliente
  viewGroupIds: string[];
  condition: CfCondition | null;
  mappable: boolean;
  importable: boolean;
  templateFilter: boolean;
  listFilter: boolean;
  mapToRfpKey: string | null;
  active: boolean;
};

const KEY_RE = /^[a-z0-9_]{1,40}$/;

async function requireSuperAdmin() {
  const scope = await requireClientScope();
  const d = getDictionary(scope.user.language).customFields;
  if (!scope.isSuperAdmin) return { ok: false, error: d.errOnlySuperAdmin } as const;
  return { ok: true, d } as const;
}

type Dict = ReturnType<typeof getDictionary>["customFields"];

function cleanLabels(labels: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lang of ["es", "en"]) {
    const v = (labels?.[lang] ?? "").trim().slice(0, 120);
    if (v) out[lang] = v;
  }
  return out;
}

function validCondition(
  condition: CfCondition | null,
  scope: CfScope,
  ownKey: string,
  others: { key: string; scope: CfScope }[],
  d: Dict,
): { error: string } | { condition: CfCondition | null } {
  if (!condition) return { condition: null };
  const field = (condition.field ?? "").trim();
  const op = (["eq", "neq", "filled", "empty"] as const).includes(condition.op) ? condition.op : "eq";
  const value = op === "filled" || op === "empty" ? "" : (condition.value ?? "").trim();
  if (!field || (value === "" && op !== "filled" && op !== "empty")) {
    return { error: d.errConditionInvalid };
  }
  const kind = condition.kind as CfConditionKind;
  let ok = false;
  if (isRequestScope(scope)) return { condition: null };
  if (kind === "HEADER_STD") ok = scope !== "USER" && (HEADER_STD_FIELDS as readonly string[]).includes(field);
  else if (kind === "LINE_STD") ok = scope === "RFP_LINE" && (LINE_STD_FIELDS as readonly string[]).includes(field);
  else if (kind === "HEADER_CUSTOM") {
    if (scope === "USER") return { error: d.errConditionInvalid };
    if (field === ownKey) return { error: d.errConditionSelf };
    ok = others.some((o) => o.key === field && o.scope === "RFP_HEAD");
  } else if (kind === "LINE_CUSTOM") {
    if (scope !== "RFP_LINE") return { error: d.errConditionInvalid };
    if (field === ownKey) return { error: d.errConditionSelf };
    ok = others.some((o) => o.key === field && o.scope === "RFP_LINE");
  } else if (kind === "USER_CUSTOM") {
    if (scope !== "USER") return { error: d.errConditionInvalid };
    if (field === ownKey) return { error: d.errConditionSelf };
    ok = others.some((o) => o.key === field && o.scope === "USER");
  }
  if (!ok) return { error: d.errConditionInvalid };
  return { condition: { kind, field, op, value } };
}

export async function saveCustomField(
  clientId: string,
  input: CustomFieldInput,
): Promise<{ error: string } | { success: true }> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };
  const { d } = gate;
  if (!clientId) return { error: d.errNoClient };
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: d.errNoClient };

  const key = input.key.trim();
  if (!key) return { error: d.errKeyRequired };
  if (!KEY_RE.test(key)) return { error: d.errKeyInvalid };
  if (!CF_SCOPES.includes(input.scope) || !CF_TYPES.includes(input.type)) {
    return { error: d.errConditionInvalid };
  }
  const labels = cleanLabels(input.labels);
  if (!labels.es) return { error: d.errLabelRequired };
  let lookupId: string | null = null;
  if (hasOptions(input.type)) {
    const lookup = input.lookupId
      ? await prisma.lookup.findFirst({ where: { id: input.lookupId, clientId } })
      : null;
    if (!lookup) return { error: d.errLookupRequired };
    lookupId = lookup.id;
  }
  const viewGroupIds = await validViewGroupIds(clientId, input.viewGroupIds);

  const existingFields = await prisma.customField.findMany({
    where: { clientId },
    select: { id: true, key: true, scope: true },
  });
  const current = input.id ? existingFields.find((f) => f.id === input.id) : undefined;
  if (input.id && !current) return { error: d.errNotFound };
  if (!current && existingFields.some((f) => f.key === key)) {
    return { error: d.errKeyDuplicate.replace("{key}", key) };
  }
  const ownKey = current?.key ?? key;

  const cond = validCondition(
    isRequestScope(input.scope) ? null : input.condition,
    input.scope,
    ownKey,
    existingFields.filter((f) => f.id !== current?.id),
    d,
  );
  if ("error" in cond) return cond;

  let mapToRfpKey: string | null = null;
  if (input.scope === "USER" && input.mapToRfpKey) {
    const target = input.mapToRfpKey;
    const stdOk = (USER_MAPPABLE_RFP_FIELDS as readonly string[]).includes(target);
    const customOk =
      target.startsWith(CUSTOM_TARGET_PREFIX) &&
      existingFields.some(
        (f) => f.key === target.slice(CUSTOM_TARGET_PREFIX.length) && f.scope === "RFP_HEAD",
      );
    if (!stdOk && !customOk) return { error: d.errMapInvalid };
    mapToRfpKey = target;
  }

  const data = {
    scope: input.scope,
    type: input.type,
    mandatory: !isRequestScope(input.scope) && input.mandatory,
    visible: input.visible !== false,
    editable: isRequestScope(input.scope) || input.editable !== false,
    labels,
    lookupId,
    viewGroupIds,
    condition: cond.condition ? (cond.condition as object) : undefined,
    mappable: input.scope !== "USER" && input.mappable,
    importable: isRequestScope(input.scope) && input.importable,
    templateFilter: input.scope === "RFP_HEAD" && input.templateFilter,
    listFilter: input.scope === "RFP_HEAD" && input.listFilter,
    mapToRfpKey,
    active: input.active,
  };

  if (current) {
    await prisma.customField.update({
      where: { id: current.id },
      data: {
        ...data,
        options: Prisma.DbNull, // the legacy inline options are superseded by the lookup
        condition: cond.condition ? (cond.condition as object) : Prisma.DbNull,
      },
    });
  } else {
    await ensureCustomValuesPartition(clientId);
    await prisma.customField.create({
      data: { ...data, clientId, key, order: existingFields.length },
    });
  }
  revalidatePath("/admin/custom-fields");
  return { success: true };
}

export async function deleteCustomField(
  clientId: string,
  id: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };
  const { d } = gate;
  const field = await prisma.customField.findFirst({ where: { id, clientId } });
  if (!field) return { error: d.errNotFound };
  const dependents = await prisma.customField.findMany({ where: { clientId } });
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany({
      where: { clientId, fieldKey: field.key, entityType: entityTypeOfScope(field.scope) },
    }),
    // Fields that were conditioned on the deleted one lose their condition.
    ...dependents
      .filter((f) => (f.condition as CfCondition | null)?.field === field.key)
      .map((f) =>
        prisma.customField.update({ where: { id: f.id }, data: { condition: Prisma.DbNull } }),
      ),
    prisma.customField.delete({ where: { id: field.id } }),
  ]);
  revalidatePath("/admin/custom-fields");
  return { success: true };
}

// Import in the "cus_Cliente" Excel format, for the selected client only.
export async function importCustomFields(
  clientId: string,
  rows: ImportedField[],
): Promise<{ error: string } | { success: true; created: number; updated: number }> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { error: gate.error };
  const { d } = gate;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: d.errNoClient };

  const mine = rows.filter((r) => r.clientCode.trim().toLowerCase() === client.code.toLowerCase());
  const existing = await prisma.customField.findMany({ where: { clientId } });
  const existingDefs = await loadCustomFields(clientId, undefined, false);
  type Info = { key: string; scope: CfScope; type: CfType; options: CfOption[] };
  const known = new Map<string, Info>();
  const byLabel = new Map<string, string>();
  const register = (info: Info, labels: Record<string, string>) => {
    known.set(info.key, info);
    for (const l of Object.values(labels)) if (l) byLabel.set(l.trim().toLowerCase(), info.key);
  };
  for (const f of existingDefs) {
    register({ key: f.key, scope: f.scope, type: f.type, options: f.options }, f.labels);
  }
  for (const r of mine) register({ key: sanitizeKey(r.key), scope: r.scope, type: r.type, options: r.options }, r.labels);

  await ensureCustomValuesPartition(clientId);
  let created = 0;
  let updated = 0;
  for (const [index, r] of mine.entries()) {
    const key = sanitizeKey(r.key);
    if (!KEY_RE.test(key)) return { error: d.errKeyInvalid + ` (${r.key})` };
    let condition: CfCondition | null = null;
    if (r.conditionText && !isRequestScope(r.scope)) {
      const parsed = parseConditionText(r.conditionText);
      if (!parsed) {
        return { error: d.importBadCondition.replace("{key}", r.key).replace("{text}", r.conditionText) };
      }
      // The Excel may name the other field by its id or by its label.
      const targetKey = known.has(sanitizeKey(parsed.field))
        ? sanitizeKey(parsed.field)
        : (byLabel.get(parsed.field.trim().toLowerCase()) ?? sanitizeKey(parsed.field));
      const target = known.get(targetKey);
      let kind: CfConditionKind | null = null;
      let field = targetKey;
      if (target?.scope === "RFP_HEAD") kind = "HEADER_CUSTOM";
      else if (target?.scope === "RFP_LINE") kind = "LINE_CUSTOM";
      else if (target?.scope === "USER") kind = "USER_CUSTOM";
      else if ((HEADER_STD_FIELDS as readonly string[]).includes(parsed.field.trim())) {
        kind = "HEADER_STD";
        field = parsed.field.trim();
      } else if (r.scope === "RFP_LINE" && (LINE_STD_FIELDS as readonly string[]).includes(parsed.field.trim())) {
        kind = "LINE_STD";
        field = parsed.field.trim();
      }
      let op: CfCondition["op"] = parsed.op;
      let value = parsed.value;
      // "(prioridad = true)" on a field that isn't a checkbox means "has a value".
      const boolWord = /^(true|false|si|sí|no)$/i.test(value);
      if (
        target &&
        target.type !== "CHECKBOX" &&
        boolWord &&
        !target.options.some((o) => o.value.toLowerCase() === value.toLowerCase())
      ) {
        const positive = /^(true|si|sí)$/i.test(value);
        op = positive === (parsed.op === "eq") ? "filled" : "empty";
        value = "";
      } else if (target?.type === "CHECKBOX") {
        value = /^(true|si|sí)$/i.test(value) ? "true" : "false";
      }
      if (!kind) {
        return { error: d.importBadCondition.replace("{key}", r.key).replace("{text}", r.conditionText) };
      }
      condition = { kind, field, op, value };
    }
    // Dropdown / tree fields point at a lookup (by the "lookup" column, else
    // one named after the field); the Excel's values are loaded into it.
    let lookupId: string | null = null;
    if (hasOptions(r.type)) {
      const lookupName = (r.lookupName || key).trim();
      let lookup = await prisma.lookup.findUnique({
        where: { clientId_name: { clientId, name: lookupName } },
      });
      if (!lookup) lookup = await prisma.lookup.create({ data: { clientId, name: lookupName } });
      if (r.options.length > 0) await upsertLookupValues(lookup.id, r.options);
      lookupId = lookup.id;
    }
    const base = {
      lookupId,
      scope: r.scope,
      type: r.type,
      mandatory: r.mandatory,
      visible: r.visible,
      editable: isRequestScope(r.scope) || r.editable,
      labels: r.labels,
      condition: condition ? (condition as object) : undefined,
      mappable: r.scope !== "USER" && r.mappable,
      importable: isRequestScope(r.scope) && r.importable,
      templateFilter: r.scope === "RFP_HEAD" && r.templateFilter,
      listFilter: r.scope === "RFP_HEAD" && r.listFilter,
    };
    const found = existing.find((f) => f.key === key);
    if (found) {
      await prisma.customField.update({
        where: { id: found.id },
        data: {
          ...base,
          options: Prisma.DbNull,
          condition: condition ? (condition as object) : Prisma.DbNull,
        },
      });
      updated++;
    } else {
      await prisma.customField.create({
        data: { ...base, clientId, key, order: existing.length + index },
      });
      created++;
    }
  }
  revalidatePath("/admin/custom-fields");
  return { success: true, created, updated };
}
