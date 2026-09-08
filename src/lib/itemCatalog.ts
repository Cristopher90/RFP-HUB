import "server-only";
import { prisma } from "@/lib/prisma";

// Keeps the item catalog's "último precio" in sync with real usage: called
// whenever an award actually completes. Items without a code are skipped —
// the catalog is keyed by code, same requirement the supplier directory
// places on its own code field.
export async function upsertCatalogFromAward(
  rfpId: string,
  invitationId: string,
) {
  const [rfp, invitation] = await Promise.all([
    prisma.rfp.findUnique({ where: { id: rfpId }, include: { items: true } }),
    prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { response: { include: { itemPrices: true } } },
    }),
  ]);
  if (!rfp || !invitation?.response) return;

  for (const item of rfp.items) {
    const code = item.code?.trim();
    if (!code) continue;
    const price = invitation.response.itemPrices.find((p) => p.itemId === item.id);
    if (!price) continue;

    await prisma.itemCatalog.upsert({
      where: { code },
      create: {
        code,
        name: item.name,
        description: item.description,
        unit: item.unit,
        lastPrice: price.unitPrice,
      },
      update: {
        name: item.name,
        description: item.description,
        unit: item.unit,
        lastPrice: price.unitPrice,
      },
    });
  }
}
