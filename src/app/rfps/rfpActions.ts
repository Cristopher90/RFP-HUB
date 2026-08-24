"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatRfpNumber } from "@/lib/format";
import type {
  NewItemInput,
  NewQuestionInput,
  NewSupplierInput,
} from "./new/actions";

export type PreviousRfpResult = {
  id: string;
  number: number;
  label: string; // "RFP-3 — Compra de laptops Q1"
  title: string;
  commodity: string | null;
  region: string | null;
  creatorName: string;
  status: string;
  awarded: boolean;
};

// Searchable-picker backend for "basar en una RFP anterior" / "Copiar":
// title text + creator/commodity/región filters, same dimensions as the
// RFP list's own RfpFilters.
export async function searchPreviousRfps(filters: {
  title?: string;
  commodity?: string;
  region?: string;
  creatorId?: string;
  excludeRfpId?: string;
}): Promise<PreviousRfpResult[]> {
  await requireUser();

  const rfps = await prisma.rfp.findMany({
    where: {
      status: { not: "DELETED" },
      ...(filters.excludeRfpId ? { id: { not: filters.excludeRfpId } } : {}),
      ...(filters.title
        ? { title: { contains: filters.title } }
        : {}),
      ...(filters.commodity ? { commodity: filters.commodity } : {}),
      ...(filters.region ? { region: filters.region } : {}),
      ...(filters.creatorId ? { createdByUserId: filters.creatorId } : {}),
    },
    orderBy: { number: "desc" },
    take: 50,
    include: { createdBy: true },
  });

  return rfps.map((r) => ({
    id: r.id,
    number: r.number,
    label: `${formatRfpNumber(r.number)} — ${r.title}`,
    title: r.title,
    commodity: r.commodity,
    region: r.region,
    creatorName: r.createdBy?.name ?? "—",
    status: r.status,
    awarded: Boolean(r.awardedInvitationId),
  }));
}

// Builds a fresh items/questions/suppliers set from a source RFP for
// "Copiar"/"basar en una RFP anterior". mode "based_on" pulls each item's
// historicalPrice from the winning (awarded) unit price of that same item
// in the source RFP; mode "blank" copies structure only, no historical
// pricing. Neither mode carries over template-lock metadata (id,
// sourceTemplate*Id, locked) — the new RFP re-derives its own template
// matches from its own (initially blank) commodity/region.
export async function buildItemsFromSourceRfp(
  sourceRfpId: string,
  mode: "blank" | "based_on",
): Promise<
  | {
      items: NewItemInput[];
      questions: NewQuestionInput[];
      internalQuestions: NewQuestionInput[];
      suppliers: NewSupplierInput[];
      sourceTitle: string;
      sourceNumber: number;
    }
  | { error: string }
> {
  await requireUser();

  const source = await prisma.rfp.findUnique({
    where: { id: sourceRfpId },
    include: {
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
      invitations: {
        include: {
          supplier: true,
          response: { include: { itemPrices: true } },
        },
      },
    },
  });
  if (!source) return { error: "No se encontró la RFP de referencia." };

  const awardedInvitation = source.invitations.find(
    (inv) => inv.id === source.awardedInvitationId,
  );
  const awardedPriceByItemId = new Map<string, number>();
  if (mode === "based_on" && awardedInvitation?.response) {
    for (const p of awardedInvitation.response.itemPrices) {
      awardedPriceByItemId.set(p.itemId, p.unitPrice);
    }
  }

  const items: NewItemInput[] = source.items.map((item) => ({
    section: item.section,
    code: item.code,
    name: item.name,
    description: item.description ?? "",
    quantity: item.quantity,
    unit: item.unit,
    weight: item.weight,
    decimals: item.decimals,
    historicalPrice: awardedPriceByItemId.get(item.id) ?? null,
    commodity: item.commodity,
    customFields: item.customFields
      ? (JSON.parse(item.customFields) as { label: string; value: string }[])
      : [],
  }));

  function mapQuestions(respondedBy: "SUPPLIER" | "BUYER"): NewQuestionInput[] {
    return source!.questions
      .filter((q) => q.respondedBy === respondedBy)
      .map((q) => ({
        // El id real de la pregunta origen sirve como clientKey estable
        // para resolver dependsOnQuestionKey dentro del set copiado; se
        // descarta al crear (createRfp nunca reutiliza un id existente).
        clientKey: q.id,
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
        dependsOnQuestionKey: q.dependsOnQuestionId,
        dependsOnHeaderField: q.dependsOnHeaderField as
          | "commodity"
          | "region"
          | null,
        dependsOnValue: q.dependsOnValue ?? "",
        buyerAnswerValue: q.buyerAnswerValue ?? "",
      }));
  }

  const suppliers: NewSupplierInput[] = source.invitations.map((inv) => ({
    name: inv.supplier.name,
    email: inv.supplier.email,
    company: inv.supplier.company,
  }));

  return {
    items,
    questions: mapQuestions("SUPPLIER"),
    internalQuestions: mapQuestions("BUYER"),
    suppliers,
    sourceTitle: source.title,
    sourceNumber: source.number,
  };
}
