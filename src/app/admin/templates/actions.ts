"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { serializeScoringConfig } from "@/lib/questionScoring";
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
  targetClientId?: string,
): Promise<{ error: string } | never> {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const name = input.name.trim();
  if (!name) return { error: "El nombre de la plantilla es obligatorio." };

  let clientId: string;
  if (templateId) {
    const existing = await prisma.rfpTemplate.findUnique({
      where: { id: templateId },
    });
    if (!existing) return { error: "Plantilla no encontrada." };
    if (!scope.isSuperAdmin && existing.clientId !== scope.user.clientId) {
      return { error: "No podés editar una plantilla de otro cliente." };
    }
    clientId = existing.clientId;
  } else {
    const resolved = scope.isSuperAdmin ? targetClientId : scope.user.clientId;
    if (!resolved) return { error: "Selecciona el cliente de esta plantilla." };
    clientId = resolved;
  }

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
      lockRoles: item.lockRoles,
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
    : await prisma.rfpTemplate.create({ data: { ...data, clientId } });

  // Replace items/questions wholesale — simplest consistent model for a
  // form-based full-save editor.
  await prisma.templateItem.deleteMany({ where: { templateId: template.id } });
  await prisma.templateQuestion.deleteMany({
    where: { templateId: template.id },
  });

  await prisma.templateItem.createMany({
    data: items.map((item, order) => ({
      ...item,
      clientId,
      templateId: template.id,
      order,
    })),
  });

  const realIdByClientKey = new Map<string, string>();
  for (const [order, q] of questions.entries()) {
    const created = await prisma.templateQuestion.create({
      data: {
        clientId,
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
        scoringConfig: q.scoringConfig,
        dependsOnHeaderField: q.dependsOnHeaderField,
        dependsOnValue: q.dependsOnValue || null,
        options: q.options,
        lockRoles: q.lockRoles,
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
