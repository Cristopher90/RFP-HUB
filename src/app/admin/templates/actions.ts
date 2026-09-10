"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { serializeScoringConfig } from "@/lib/questionScoring";
import { getDictionary } from "@/i18n/getDictionary";
import type { UserRole } from "@/generated/prisma/enums";

export type TemplateItemInput = {
  id?: string; // presente al editar un artículo existente: id real en DB
  section: string | null;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  weight: number;
  decimals: number;
  customFields: { label: string; value: string }[];
  lockRoles: UserRole[];
};

export type TemplateQuestionType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MONEY"
  | "ATTACHMENT"
  | "YES_NO"
  | "INFO";

export type TemplateQuestionVisibility =
  | "INTERNAL"
  | "SUPPLIER_ONLY"
  | "EXTERNAL";

export type TemplateQuestionResponder = "SUPPLIER" | "BUYER";

export type TemplateQuestionInput = {
  id?: string; // presente al editar una pregunta existente: id real en DB
  clientKey: string;
  section: string | null;
  text: string;
  type: TemplateQuestionType;
  options: string[];
  required: boolean;
  weight: number;
  isPrerequisite: boolean;
  visibility: TemplateQuestionVisibility;
  respondedBy: TemplateQuestionResponder;
  numberMin: number | null;
  numberMax: number | null;
  scoringConfig: Record<string, number> | null;
  dependsOnQuestionKey: string | null;
  dependsOnHeaderField: "commodity" | "region" | null;
  dependsOnValue: string;
  lockRoles: UserRole[];
};

export type TemplatePriceCondition = "GREATER_THAN" | "LESS_THAN" | "BETWEEN";

export type SaveTemplateInput = {
  name: string;
  description: string;
  matchCommodity: string;
  matchCommodityIncludeDescendants: boolean;
  matchRegion: string;
  matchRegionIncludeDescendants: boolean;
  matchPriceCondition: TemplatePriceCondition | null;
  matchPriceMin: string;
  matchPriceMax: string;
  active: boolean;
  hideResponsesUntilClosed: boolean;
  items: TemplateItemInput[];
  questions: TemplateQuestionInput[];
};

export async function saveTemplate(
  templateId: string | null,
  input: SaveTemplateInput,
  targetClientId?: string,
): Promise<{ error: string } | never> {
  const scope = await requireClientScope();
  const dictionary = getDictionary(scope.user.language);
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const name = input.name.trim();
  if (!name) return { error: dictionary.templatesActions.templateNameRequired };

  let clientId: string;
  if (templateId) {
    const existing = await prisma.rfpTemplate.findUnique({
      where: { id: templateId },
    });
    if (!existing) return { error: dictionary.templatesActions.templateNotFound };
    if (!scope.isSuperAdmin && existing.clientId !== scope.user.clientId) {
      return { error: dictionary.templatesActions.cannotEditOtherClientTemplate };
    }
    clientId = existing.clientId;
  } else {
    const resolved = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
    if (!resolved) return { error: dictionary.templatesActions.selectClientForTemplate };
    clientId = resolved;
  }

  const items = input.items
    .map((item) => ({
      id: item.id,
      section: item.section?.trim() || null,
      name: item.name.trim(),
      description: item.description.trim() || null,
      quantity: Number(item.quantity) || 1,
      unit: item.unit.trim() || "unidad",
      weight: Math.min(10, Math.max(1, Number(item.weight) || 1)),
      decimals: Math.min(4, Math.max(0, Number(item.decimals) ?? 2)),
      customFields: JSON.stringify(
        item.customFields
          .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
          .filter((f) => f.label.length > 0),
      ),
      lockRoles: item.lockRoles,
    }))
    .filter((item) => item.name.length > 0);

  const questions = input.questions
    .map((q) => ({
      id: q.id,
      clientKey: q.clientKey,
      section: q.section?.trim() || null,
      text: q.text.trim(),
      type: q.type,
      required: q.isPrerequisite ? true : q.required,
      weight: Math.min(10, Math.max(1, Number(q.weight) || 1)),
      isPrerequisite: q.isPrerequisite,
      visibility: q.visibility,
      respondedBy: q.respondedBy,
      numberMin: q.type === "NUMBER" ? q.numberMin : null,
      numberMax: q.type === "NUMBER" ? q.numberMax : null,
      scoringConfig:
        q.respondedBy === "SUPPLIER" &&
        (q.type === "SELECT" || q.type === "NUMBER" || q.type === "YES_NO")
          ? serializeScoringConfig(q.scoringConfig)
          : null,
      dependsOnQuestionKey: q.dependsOnQuestionKey,
      dependsOnHeaderField: q.dependsOnHeaderField,
      dependsOnValue: q.dependsOnValue.trim(),
      lockRoles: q.lockRoles,
      options:
        q.type === "SELECT"
          ? JSON.stringify(
              q.options.map((o) => o.trim()).filter((o) => o.length > 0),
            )
          : null,
    }))
    .filter((q) => q.text.length > 0);

  const matchPriceMin = input.matchPriceMin.trim() ? Number(input.matchPriceMin) : null;
  const matchPriceMax = input.matchPriceMax.trim() ? Number(input.matchPriceMax) : null;
  if (input.matchPriceCondition === "BETWEEN" && (matchPriceMin === null || matchPriceMax === null)) {
    return { error: dictionary.templatesActions.priceRangeRequired };
  }
  if (input.matchPriceCondition === "GREATER_THAN" && matchPriceMin === null) {
    return { error: dictionary.templatesActions.priceMinRequired };
  }
  if (input.matchPriceCondition === "LESS_THAN" && matchPriceMax === null) {
    return { error: dictionary.templatesActions.priceMaxRequired };
  }

  const data = {
    name,
    description: input.description.trim() || null,
    matchCommodity: input.matchCommodity.trim() || null,
    matchCommodityIncludeDescendants: input.matchCommodity.trim()
      ? input.matchCommodityIncludeDescendants
      : false,
    matchRegion: input.matchRegion.trim() || null,
    matchRegionIncludeDescendants: input.matchRegion.trim()
      ? input.matchRegionIncludeDescendants
      : false,
    matchPriceCondition: input.matchPriceCondition,
    matchPriceMin: input.matchPriceCondition ? matchPriceMin : null,
    matchPriceMax: input.matchPriceCondition ? matchPriceMax : null,
    active: input.active,
    hideResponsesUntilClosed: input.hideResponsesUntilClosed,
  };

  const template = templateId
    ? await prisma.rfpTemplate.update({ where: { id: templateId }, data })
    : await prisma.rfpTemplate.create({ data: { ...data, clientId } });

  // Items/questions: update existing (by id), create new, delete removed —
  // never wholesale delete+recreate. RFPs (and RFP copies) remember which
  // TemplateItem/TemplateQuestion row they came from via sourceTemplate*Id;
  // recreating rows with fresh ids on every save would sever that link and
  // make every RFP built from this template look like it's missing this
  // content, re-adding it as a duplicate the next time templates re-sync.
  const existingItems = await prisma.templateItem.findMany({
    where: { templateId: template.id },
    select: { id: true },
  });
  const existingItemIds = new Set(existingItems.map((i) => i.id));
  const submittedItemIds = new Set(items.map((i) => i.id).filter(Boolean));
  for (const id of existingItemIds) {
    if (!submittedItemIds.has(id)) {
      await prisma.templateItem.delete({ where: { id } });
    }
  }
  for (const [order, { id, ...item }] of items.entries()) {
    if (id && existingItemIds.has(id)) {
      await prisma.templateItem.update({ where: { id }, data: { ...item, order } });
    } else {
      await prisma.templateItem.create({
        data: { ...item, clientId, templateId: template.id, order },
      });
    }
  }

  const existingQuestions = await prisma.templateQuestion.findMany({
    where: { templateId: template.id },
    select: { id: true },
  });
  const existingQuestionIds = new Set(existingQuestions.map((q) => q.id));
  const submittedQuestionIds = new Set(questions.map((q) => q.id).filter(Boolean));
  for (const id of existingQuestionIds) {
    if (!submittedQuestionIds.has(id)) {
      await prisma.templateQuestion.delete({ where: { id } });
    }
  }
  const realIdByClientKey = new Map<string, string>();
  for (const [order, q] of questions.entries()) {
    const data = {
      section: q.section,
      text: q.text,
      type: q.type,
      required: q.required,
      weight: q.weight,
      isPrerequisite: q.isPrerequisite,
      visibility: q.visibility,
      respondedBy: q.respondedBy,
      numberMin: q.numberMin,
      numberMax: q.numberMax,
      scoringConfig: q.scoringConfig,
      dependsOnHeaderField: q.dependsOnHeaderField,
      dependsOnValue: q.dependsOnValue || null,
      options: q.options,
      lockRoles: q.lockRoles,
      order,
    };
    if (q.id && existingQuestionIds.has(q.id)) {
      await prisma.templateQuestion.update({ where: { id: q.id }, data });
      realIdByClientKey.set(q.clientKey, q.id);
    } else {
      const created = await prisma.templateQuestion.create({
        data: { ...data, clientId, templateId: template.id },
      });
      realIdByClientKey.set(q.clientKey, created.id);
    }
  }
  for (const q of questions) {
    if (!q.dependsOnQuestionKey) continue;
    const targetId = realIdByClientKey.get(q.dependsOnQuestionKey);
    const ownId = realIdByClientKey.get(q.clientKey);
    if (!targetId || !ownId) continue;
    await prisma.templateQuestion.update({
      where: { id: ownId },
      data: { dependsOnQuestionId: targetId },
    });
  }

  revalidatePath("/admin");
  redirect(`/admin/templates/${template.id}`);
}

export async function deleteTemplate(templateId: string) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const existing = await prisma.rfpTemplate.findUnique({
    where: { id: templateId },
  });
  if (existing && (scope.isSuperAdmin || existing.clientId === scope.user.clientId)) {
    await prisma.rfpTemplate.delete({ where: { id: templateId } });
  }
  revalidatePath("/admin");
  redirect("/admin");
}
