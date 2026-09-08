"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, ROLE_LEVEL } from "@/lib/auth";
import { matchesTemplate } from "@/lib/templateMatch";
import { nextRfpNumber } from "@/lib/rfpNumber";
import { pickApprovalWorkflow, levelsForStage, startStage } from "@/lib/approvalEngine";

export type NewCustomField = { label: string; value: string };

export type NewItemInput = {
  id?: string; // presente al editar un borrador existente: id real en DB
  section: string | null;
  code: string | null;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  weight: number;
  decimals: number;
  historicalPrice: number | null;
  commodity: string | null;
  customFields: NewCustomField[];
  sourceTemplateItemId?: string | null;
  sourceTemplateId?: string | null;
  locked?: boolean;
  sourceItemCatalogEntryId?: string | null;
};

export type QuestionType =
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MONEY"
  | "ATTACHMENT"
  | "YES_NO";

export type QuestionVisibility = "INTERNAL" | "SUPPLIER_ONLY" | "EXTERNAL";

export type QuestionResponder = "SUPPLIER" | "BUYER";

export type NewQuestionInput = {
  id?: string; // presente al editar un borrador existente: id real en DB
  clientKey: string;
  section: string | null;
  text: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  weight: number;
  isPrerequisite: boolean;
  visibility: QuestionVisibility;
  respondedBy: QuestionResponder;
  numberMin: number | null;
  numberMax: number | null;
  dependsOnQuestionKey: string | null;
  dependsOnHeaderField: "commodity" | "region" | null;
  dependsOnValue: string;
  buyerAnswerValue: string;
  sourceTemplateQuestionId?: string | null;
  sourceTemplateId?: string | null;
  locked?: boolean;
};

export type NewSupplierInput = {
  invitationId?: string; // presente al editar un borrador existente
  name: string;
  email: string;
  company: string;
};

export type CreateRfpInput = {
  title: string;
  description: string;
  buyerName: string;
  deadlineAt: string;
  commodity: string;
  region: string;
  startDate: string;
  estimatedPrice: string;
  origin: string;
  predecessorDocument: string;
  basedOnRfpId: string | null;
  isNextRound?: boolean;
  scoringEnabled: boolean;
  saveAsDraft: boolean;
  items: NewItemInput[];
  questions: NewQuestionInput[];
  suppliers: NewSupplierInput[];
};

export type ShapedRfpInput = {
  items: ReturnType<typeof shapeItems>;
  questions: ReturnType<typeof shapeQuestions>;
  suppliers: ReturnType<typeof shapeSuppliers>;
  matchingTemplates: Awaited<ReturnType<typeof findMatchingTemplates>>;
  estimatedPrice: number | null;
};

async function findMatchingTemplates(commodity: string, region: string) {
  return (
    await prisma.rfpTemplate.findMany({
      where: { active: true },
      include: {
        items: true,
        questions: true,
        approvalWorkflow: { include: { levels: true } },
      },
    })
  ).filter((t) => matchesTemplate(t, commodity, region));
}

function shapeItems(items: NewItemInput[]) {
  return items
    .map((item) => ({
      id: item.id,
      section: item.section?.trim() || null,
      code: item.code?.trim() || null,
      name: item.name.trim(),
      description: item.description.trim() || null,
      quantity: Number(item.quantity) || 0,
      unit: item.unit.trim() || "unidad",
      weight: Math.min(10, Math.max(1, Number(item.weight) || 1)),
      decimals: Math.min(4, Math.max(0, Number(item.decimals) ?? 2)),
      historicalPrice:
        item.historicalPrice !== null && !Number.isNaN(Number(item.historicalPrice))
          ? Number(item.historicalPrice)
          : null,
      commodity: item.commodity?.trim() || null,
      customFields: JSON.stringify(
        item.customFields
          .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
          .filter((f) => f.label.length > 0),
      ),
      sourceTemplateItemId: item.sourceTemplateItemId || null,
      locked: Boolean(item.locked),
      sourceItemCatalogEntryId: item.sourceItemCatalogEntryId || null,
    }))
    .filter((item) => item.name.length > 0);
}

function shapeQuestions(questions: NewQuestionInput[]) {
  return questions
    .map((q) => {
      const respondedBy = q.respondedBy;
      // A buyer-answered question is never sent to the supplier — force
      // internal visibility and drop supplier-only affordances regardless
      // of what the client sent.
      const visibility = respondedBy === "BUYER" ? "INTERNAL" : q.visibility;
      const isPrerequisite = respondedBy === "BUYER" ? false : q.isPrerequisite;
      return {
        id: q.id,
        clientKey: q.clientKey,
        section: q.section?.trim() || null,
        text: q.text.trim(),
        type: q.type,
        required: isPrerequisite ? true : q.required,
        weight: Math.min(10, Math.max(1, Number(q.weight) || 1)),
        isPrerequisite,
        visibility,
        respondedBy,
        numberMin: q.type === "NUMBER" ? q.numberMin : null,
        numberMax: q.type === "NUMBER" ? q.numberMax : null,
        dependsOnQuestionKey: q.dependsOnQuestionKey,
        dependsOnHeaderField: q.dependsOnHeaderField,
        dependsOnValue: q.dependsOnValue.trim(),
        buyerAnswerValue:
          respondedBy === "BUYER" ? q.buyerAnswerValue.trim() || null : null,
        sourceTemplateQuestionId: q.sourceTemplateQuestionId || null,
        locked: Boolean(q.locked),
        options:
          q.type === "SELECT"
            ? JSON.stringify(
                q.options.map((o) => o.trim()).filter((o) => o.length > 0),
              )
            : null,
      };
    })
    .filter((q) => q.text.length > 0);
}

function shapeSuppliers(suppliers: NewSupplierInput[]) {
  return suppliers
    .map((s) => ({
      invitationId: s.invitationId,
      name: s.name.trim(),
      email: s.email.trim(),
      company: s.company.trim(),
    }))
    .filter((s) => s.name.length > 0 && s.email.length > 0);
}

// Shared by createRfp and updateRfp: re-validates locked template content
// server-side (a tampered client payload must not be able to drop content
// the user's role can't remove) and shapes items/questions/suppliers for
// persistence.
export async function validateAndShapeRfp(
  input: CreateRfpInput,
  user: { role: import("@/generated/prisma/enums").UserRole },
): Promise<{ error: string } | ShapedRfpInput> {
  const matchingTemplates = await findMatchingTemplates(
    input.commodity,
    input.region,
  );

  const submittedItemSourceIds = new Set(
    input.items.map((i) => i.sourceTemplateItemId).filter(Boolean),
  );
  const submittedQuestionSourceIds = new Set(
    input.questions.map((q) => q.sourceTemplateQuestionId).filter(Boolean),
  );

  for (const template of matchingTemplates) {
    for (const templateItem of template.items) {
      const locked = ROLE_LEVEL[user.role] < ROLE_LEVEL[templateItem.lockMinRole];
      if (locked && !submittedItemSourceIds.has(templateItem.id)) {
        return {
          error: `No puedes quitar el artículo obligatorio "${templateItem.name}" (plantilla: ${template.name}).`,
        };
      }
    }
    for (const templateQuestion of template.questions) {
      const locked =
        ROLE_LEVEL[user.role] < ROLE_LEVEL[templateQuestion.lockMinRole];
      if (locked && !submittedQuestionSourceIds.has(templateQuestion.id)) {
        return {
          error: `No puedes quitar la pregunta obligatoria "${templateQuestion.text}" (plantilla: ${template.name}).`,
        };
      }
    }
  }

  const items = shapeItems(input.items);
  if (items.length === 0) {
    return { error: "Agrega al menos un artículo a la RFP." };
  }
  const questions = shapeQuestions(input.questions);
  const suppliers = shapeSuppliers(input.suppliers);

  const estimatedPrice = input.estimatedPrice.trim()
    ? Number(input.estimatedPrice)
    : null;

  return { items, questions, suppliers, matchingTemplates, estimatedPrice };
}

export async function createRfp(
  input: CreateRfpInput,
): Promise<{ error: string } | never> {
  const user = await requireUser();

  const title = input.title.trim();
  const buyerName = input.buyerName.trim();
  if (!title) return { error: "El título de la RFP es obligatorio." };
  if (!buyerName) return { error: "El nombre del comprador es obligatorio." };
  if (!input.deadlineAt) return { error: "La fecha de cierre es obligatoria." };

  const shaped = await validateAndShapeRfp(input, user);
  if ("error" in shaped) return shaped;
  const { items, questions, suppliers, matchingTemplates, estimatedPrice } = shaped;

  // Drafts skip approval entirely — only publishing needs it resolved.
  const workflow = input.saveAsDraft ? null : pickApprovalWorkflow(matchingTemplates);
  const publishLevels = input.saveAsDraft ? [] : levelsForStage(workflow, "PUBLISH");
  const estimatedPriceValue =
    estimatedPrice !== null && !Number.isNaN(estimatedPrice) ? estimatedPrice : null;
  const status: "DRAFT" | "PENDING_PUBLISH_APPROVAL" | "OPEN" = input.saveAsDraft
    ? "DRAFT"
    : publishLevels.length === 0
      ? "OPEN"
      : "PENDING_PUBLISH_APPROVAL";

  let roundNumber = 1;
  let seriesRootId: string | null = null;
  if (input.isNextRound && input.basedOnRfpId) {
    const source = await prisma.rfp.findUnique({
      where: { id: input.basedOnRfpId },
      select: { id: true, roundNumber: true, seriesRootId: true },
    });
    if (source) {
      roundNumber = source.roundNumber + 1;
      seriesRootId = source.seriesRootId ?? source.id;
    }
  }

  const rfp = await prisma.rfp.create({
    data: {
      number: await nextRfpNumber(),
      title,
      description: input.description.trim(),
      buyerName,
      deadlineAt: new Date(input.deadlineAt),
      status,
      publishedAt: status === "OPEN" ? new Date() : null,
      commodity: input.commodity.trim() || null,
      region: input.region.trim() || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      estimatedPrice: estimatedPriceValue,
      origin: input.origin.trim() || null,
      predecessorDocument: input.predecessorDocument.trim() || null,
      basedOnRfpId: input.basedOnRfpId || null,
      roundNumber,
      seriesRootId,
      scoringEnabled: input.scoringEnabled,
      approvalWorkflowId: workflow?.id ?? null,
      hideResponsesUntilClosed: matchingTemplates.some((t) => t.hideResponsesUntilClosed),
      appliedTemplates:
        matchingTemplates.length > 0
          ? JSON.stringify(
              matchingTemplates.map((t) => ({ id: t.id, name: t.name })),
            )
          : null,
      createdByUserId: user.id,
      items: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        create: items.map(({ id: _id, ...item }, order) => ({
          ...item,
          order,
        })),
      },
    },
  });

  // Questions are created sequentially (not as a nested create) so each
  // gets a real id we can use to resolve question-to-question dependencies,
  // which the client can only express via a stable clientKey (not a DB id).
  const realIdByClientKey = new Map<string, string>();
  for (const [order, q] of questions.entries()) {
    const created = await prisma.rfpQuestion.create({
      data: {
        rfpId: rfp.id,
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
        buyerAnswerValue: q.buyerAnswerValue,
        options: q.options,
        sourceTemplateQuestionId: q.sourceTemplateQuestionId,
        locked: q.locked,
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
    await prisma.rfpQuestion.update({
      where: { id: ownId },
      data: { dependsOnQuestionId: targetId },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const { invitationId: _invitationId, ...supplier } of suppliers) {
    const createdSupplier = await prisma.supplier.create({ data: supplier });
    await prisma.invitation.create({
      data: {
        rfpId: rfp.id,
        supplierId: createdSupplier.id,
      },
    });
  }

  if (publishLevels.length > 0) {
    const { completed } = await startStage({
      rfpId: rfp.id,
      stage: "PUBLISH",
      levels: publishLevels,
      requiredValue: estimatedPriceValue ?? 0,
      requesterId: user.id,
    });
    if (completed) {
      await prisma.rfp.update({
        where: { id: rfp.id },
        data: { status: "OPEN", publishedAt: new Date() },
      });
    }
  }

  redirect(`/rfps/${rfp.id}`);
}
