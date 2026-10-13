"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { loadCustomFields } from "@/lib/customFields";
import { REQUEST_SOURCE_PREFIX } from "@/lib/customFieldsShared";
import {
  HEADER_FIELDS,
  RFP_ITEM_SOURCES,
  RFP_ITEM_TARGETS,
  normalizeRfpMapping,
  type RfpMapping,
} from "@/lib/requestFields";

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function saveRequestRfpMapping(
  input: RfpMapping,
  targetClientId?: string,
): Promise<{ error: string } | { success: true }> {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") redirect("/");
  const d = getDictionary(scope.user.language).requestsActions;
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  if (!clientId) return { error: d.selectClient };

  const normalized = normalizeRfpMapping(input);
  // Sources: the request's own fields, or one of its mappable custom fields ("rc:<key>").
  const allFields = (await loadCustomFields(clientId)).filter((f) => f.mappable);
  const requestHeadKeys = new Set(
    allFields.filter((f) => f.scope === "REQUEST_HEAD").map((f) => `${REQUEST_SOURCE_PREFIX}${f.key}`),
  );
  const requestLineKeys = new Set(
    allFields.filter((f) => f.scope === "REQUEST_LINE").map((f) => `${REQUEST_SOURCE_PREFIX}${f.key}`),
  );
  const validLineSource = (source: string) =>
    (RFP_ITEM_SOURCES as readonly string[]).includes(source) || requestLineKeys.has(source);
  const validHeadSource = (source: string) =>
    (HEADER_FIELDS as readonly string[]).includes(source) || requestHeadKeys.has(source);

  const item = { ...normalized.item };
  for (const target of RFP_ITEM_TARGETS) {
    const source = item[target];
    if (source !== "" && !validLineSource(source)) item[target] = "";
  }
  // Only the client's mappable RFP custom fields can be mapped, to a valid source.
  const customHead: Record<string, string> = {};
  const customLine: Record<string, string> = {};
  for (const f of allFields) {
    if (f.scope === "RFP_HEAD") {
      const source = normalized.customHead[f.key];
      if (source && validHeadSource(source)) customHead[f.key] = source;
    } else if (f.scope === "RFP_LINE") {
      const source = normalized.customLine[f.key];
      if (source && validLineSource(source)) customLine[f.key] = source;
    }
  }
  const mapping: RfpMapping = {
    titleTemplate: str(normalized.titleTemplate, 300),
    descriptionTemplate: str(normalized.descriptionTemplate, 1000),
    predecessorTemplate: str(normalized.predecessorTemplate, 300),
    estimatedFromLines: Boolean(normalized.estimatedFromLines),
    item,
    customHead,
    customLine,
  };

  await prisma.requestRfpMapping.upsert({
    where: { clientId },
    create: { clientId, mapping: mapping as object },
    update: { mapping: mapping as object },
  });
  revalidatePath("/admin/request-rfp-mapping");
  return { success: true };
}
