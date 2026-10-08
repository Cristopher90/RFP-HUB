"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import {
  HEADER_FIELDS,
  LINE_FIELDS,
  REQUIRED_HEADER_FIELDS,
  isImportMode,
  lineFieldsFor,
  requiredLineFields,
  type HeaderMapping,
  type ImportMode,
  type LinesMapping,
} from "@/lib/requestFields";

export type RequestTemplateInput = {
  id?: string;
  name: string;
  importMode: ImportMode;
  headerSheet: string;
  linesSheet: string;
  headerMapping: HeaderMapping;
  linesMapping: LinesMapping;
};

async function requireTemplatesScope(targetClientId?: string) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") redirect("/");
  const clientId = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
  return { scope, clientId, d: getDictionary(scope.user.language).requestsActions };
}

function str(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function saveRequestImportTemplate(
  input: RequestTemplateInput,
  targetClientId?: string,
): Promise<{ error: string } | { success: true; id: string }> {
  const { clientId, d, scope } = await requireTemplatesScope(targetClientId);
  if (!clientId) return { error: d.selectClient };

  const name = str(input.name);
  const headerSheet = str(input.headerSheet);
  const linesSheet = str(input.linesSheet);
  if (!name) return { error: d.templateNameRequired };
  if (!headerSheet || !linesSheet) return { error: d.sheetsRequired };
  const importMode: ImportMode = isImportMode(input.importMode) ? input.importMode : "MASS";

  const dictionary = getDictionary(scope.user.language);
  const headerMapping: HeaderMapping = {};
  for (const field of HEADER_FIELDS) headerMapping[field] = str(input.headerMapping?.[field]);
  headerMapping.documentTypeFixed = str(input.headerMapping?.documentTypeFixed, 50);
  // In single-request mode the lines have no document number/type column.
  const linesMapping: LinesMapping = {};
  const lineFields = lineFieldsFor(importMode);
  for (const field of LINE_FIELDS) {
    linesMapping[field] = lineFields.includes(field) ? str(input.linesMapping?.[field]) : "";
  }

  for (const field of REQUIRED_HEADER_FIELDS) {
    if (!headerMapping[field]) {
      return { error: d.missingMapping.replace("{field}", dictionary.requestHeaderFields[field]) };
    }
  }
  for (const field of requiredLineFields(importMode)) {
    if (!linesMapping[field]) {
      return { error: d.missingMapping.replace("{field}", dictionary.requestLineFields[field]) };
    }
  }

  const duplicate = await prisma.requestImportTemplate.findFirst({
    where: { clientId, name, ...(input.id ? { NOT: { id: input.id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { error: d.duplicateTemplateName };

  const data = {
    name,
    importMode,
    headerSheet,
    linesSheet,
    headerMapping: headerMapping as object,
    linesMapping: linesMapping as object,
  };

  if (input.id) {
    const existing = await prisma.requestImportTemplate.findFirst({
      where: { id: input.id, clientId },
      select: { id: true },
    });
    if (!existing) return { error: d.templateNotFound };
    await prisma.requestImportTemplate.update({ where: { id: existing.id }, data });
    revalidatePath("/admin/request-templates");
    return { success: true, id: existing.id };
  }
  const created = await prisma.requestImportTemplate.create({ data: { ...data, clientId } });
  revalidatePath("/admin/request-templates");
  return { success: true, id: created.id };
}

export async function deleteRequestImportTemplate(
  id: string,
  targetClientId?: string,
): Promise<{ error: string } | never> {
  const { clientId, d } = await requireTemplatesScope(targetClientId);
  if (!clientId) return { error: d.selectClient };
  await prisma.requestImportTemplate.deleteMany({ where: { id, clientId } });
  revalidatePath("/admin/request-templates");
  redirect(`/admin/request-templates?clientId=${clientId}`);
}
