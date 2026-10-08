"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import {
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
  const item = { ...normalized.item };
  for (const target of RFP_ITEM_TARGETS) {
    const source = item[target];
    if (source !== "" && !(RFP_ITEM_SOURCES as readonly string[]).includes(source)) item[target] = "";
  }
  const mapping: RfpMapping = {
    titleTemplate: str(normalized.titleTemplate, 300),
    descriptionTemplate: str(normalized.descriptionTemplate, 1000),
    predecessorTemplate: str(normalized.predecessorTemplate, 300),
    estimatedFromLines: Boolean(normalized.estimatedFromLines),
    item,
  };

  await prisma.requestRfpMapping.upsert({
    where: { clientId },
    create: { clientId, mapping: mapping as object },
    update: { mapping: mapping as object },
  });
  revalidatePath("/admin/request-rfp-mapping");
  return { success: true };
}
