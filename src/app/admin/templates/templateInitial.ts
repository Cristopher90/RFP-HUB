import { makeClientKey } from "@/lib/clientKey";
import { parseMatchCustom } from "@/lib/templateMatch";
import { parseTemplateCondition } from "@/lib/templateConditions";
import { parseDocRequirements } from "@/lib/supplierDocs";
import type { Prisma } from "@/generated/prisma/client";

type TemplateWithContent = Prisma.RfpTemplateGetPayload<{ include: { items: true; questions: true } }>;

// Form values for a saved template (used to edit it, or as the starting point of a copy).
export function templateInitial(template: TemplateWithContent) {
  const questionClientKeyById = new Map(
    template.questions.map((q) => [q.id, makeClientKey()]),
  );

  return {
    name: template.name,
    description: template.description ?? "",
    matchCommodity: template.matchCommodity ?? "",
    matchCommodityIncludeDescendants: template.matchCommodityIncludeDescendants,
    matchRegion: template.matchRegion ?? "",
    matchRegionIncludeDescendants: template.matchRegionIncludeDescendants,
    matchPriceCondition: template.matchPriceCondition,
    matchPriceMin: template.matchPriceMin,
    matchPriceMax: template.matchPriceMax,
    matchCustom: parseMatchCustom(template.matchCustom),
    viewGroupIds: template.viewGroupIds,
    documentRequirements: parseDocRequirements(template.documentRequirements),
    active: template.active,
    hideResponsesUntilClosed: template.hideResponsesUntilClosed,
    minSuppliers: template.minSuppliers,
    defaultDeadlineDays: template.defaultDeadlineDays,
    priority: template.priority,
    priorityAbsolute: template.priorityAbsolute,
    items: template.items.map((i) => ({
      id: i.id,
      section: i.section,
      name: i.name,
      description: i.description ?? "",
      quantity: i.quantity,
      unit: i.unit,
      weight: i.weight,
      decimals: i.decimals,
      customFields: i.customFields
        ? (JSON.parse(i.customFields) as { label: string; value: string }[])
        : [],
      lockRoles: i.lockRoles,
      condition: parseTemplateCondition(i.condition),
      sectionCondition: parseTemplateCondition(i.sectionCondition),
    })),
    questions: template.questions.map((q) => ({
      id: q.id,
      clientKey: questionClientKeyById.get(q.id)!,
      section: q.section,
      text: q.text,
      type: q.type,
      options: q.options ? (JSON.parse(q.options) as string[]) : [],
      required: q.required,
      weight: q.weight,
      isPrerequisite: q.isPrerequisite,
      visibility: q.visibility,
      respondedBy: q.respondedBy,
      numberMin: q.numberMin,
      numberMax: q.numberMax,
      scoringConfig: q.scoringConfig
        ? (JSON.parse(q.scoringConfig) as Record<string, number>)
        : null,
      dependsOnQuestionKey: q.dependsOnQuestionId
        ? (questionClientKeyById.get(q.dependsOnQuestionId) ?? null)
        : null,
      dependsOnHeaderField: q.dependsOnHeaderField,
      dependsOnValue: q.dependsOnValue ?? "",
      lockRoles: q.lockRoles,
      sectionCondition: parseTemplateCondition(q.sectionCondition),
    })),
  };
}
