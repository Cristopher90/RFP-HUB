"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

export type TemplateItemInput = {
  section: string | null;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  weight: number;
  decimals: number;
  customFields: { label: string; value: string }[];
  lockMinRole: UserRole;
};

export type TemplateQuestionType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MONEY"
  | "ATTACHMENT"
  | "YES_NO";

export type TemplateQuestionVisibility =
  | "INTERNAL"
  | "SUPPLIER_ONLY"
  | "EXTERNAL";

export type TemplateQuestionResponder = "SUPPLIER" | "BUYER";

export type TemplateQuestionInput = {
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
  dependsOnQuestionKey: string | null;
  dependsOnHeaderField: "commodity" | "region" | null;
  dependsOnValue: string;
  lockMinRole: UserRole;
};

export type SaveTemplateInput = {
  name: string;
  description: string;
  matchCommodity: string;
  matchRegion: string;
  active: boolean;
  hideResponsesUntilClosed: boolean;
  items: TemplateItemInput[];
  questions: TemplateQuestionInput[];
};

export async function saveTemplate(
  templateId: string | null,
  input: SaveTemplateInput,
): Promise<{ error: string } | never> {
  await requireRole("ADMIN");

  const name = input.name.trim();
  if (!name) return { error: "El nombre de la plantilla es obligatorio." };

  const items = input.items
    .map((item) => ({
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
      lockMinRole: item.lockMinRole,
    }))
    .filter((item) => item.name.length > 0);

  const questions = input.questions
    .map((q) => ({
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
      dependsOnQuestionKey: q.dependsOnQuestionKey,
      dependsOnHeaderField: q.dependsOnHeaderField,
      dependsOnValue: q.dependsOnValue.trim(),
      lockMinRole: q.lockMinRole,
      options:
        q.type === "SELECT"
          ? JSON.stringify(
              q.options.map((o) => o.trim()).filter((o) => o.length > 0),
            )
          : null,
    }))
    .filter((q) => q.text.length > 0);

  const data = {
    name,
    description: input.description.trim() || null,
    matchCommodity: input.matchCommodity.trim() || null,
    matchRegion: input.matchRegion.trim() || null,
    active: input.active,
    hideResponsesUntilClosed: input.hideResponsesUntilClosed,
  };

  const template = templateId
    ? await prisma.rfpTemplate.update({ where: { id: templateId }, data })
    : await prisma.rfpTemplate.create({ data });

  // Replace items/questions wholesale — simplest consistent model for a
  // form-based full-save editor.
  await prisma.templateItem.deleteMany({ where: { templateId: template.id } });
  await prisma.templateQuestion.deleteMany({
    where: { templateId: template.id },
  });

  await prisma.templateItem.createMany({
    data: items.map((item, order) => ({
      ...item,
      templateId: template.id,
      order,
    })),
  });

  const realIdByClientKey = new Map<string, string>();
  for (const [order, q] of questions.entries()) {
    const created = await prisma.templateQuestion.create({
      data: {
        templateId: template.id,
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
        dependsOnHeaderField: q.dependsOnHeaderField,
        dependsOnValue: q.dependsOnValue || null,
        options: q.options,
        lockMinRole: q.lockMinRole,
        order,
      },
    });
    realIdByClientKey.set(q.clientKey, created.id);
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
  await requireRole("ADMIN");
  await prisma.rfpTemplate.delete({ where: { id: templateId } });
  revalidatePath("/admin");
  redirect("/admin");
}
