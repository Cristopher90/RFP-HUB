"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatRfpNumber } from "@/lib/rfpNumber";
import type { NewItemInput } from "./new/actions";

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

// Builds a fresh items list from a source RFP for "Copiar"/"basar en una
// RFP anterior". mode "based_on" pulls each item's historicalPrice from
// the winning (awarded) unit price of that same item in the source RFP;
// mode "blank" copies structure only, no historical pricing.
export async function buildItemsFromSourceRfp(
  sourceRfpId: string,
  mode: "blank" | "based_on",
): Promise<{ items: NewItemInput[]; sourceTitle: string; sourceNumber: number } | { error: string }> {
  await requireUser();

  const source = await prisma.rfp.findUnique({
    where: { id: sourceRfpId },
    include: {
      items: { orderBy: { order: "asc" } },
      invitations: {
        include: { response: { include: { itemPrices: true } } },
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

  return { items, sourceTitle: source.title, sourceNumber: source.number };
}
