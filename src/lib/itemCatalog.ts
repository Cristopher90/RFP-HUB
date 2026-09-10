import "server-only";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";

// Adds/updates the awarded items of one RFP into a named catalog — only
// called after the buyer explicitly confirms (see confirmAddToCatalog in
// rfps/[id]/compare/actions.ts). Items without a code are skipped — a
// catalog entry is keyed by (catalog, code).
export async function addAwardedItemsToCatalog(
  rfpId: string,
  invitationId: string,
  catalogName: string,
  language: string,
): Promise<{ error: string } | { success: true; count: number }> {
  const dictionary = getDictionary(language);
  const name = catalogName.trim();
  if (!name) return { error: dictionary.itemCatalogErrors.catalogNameRequired };

  const [rfp, invitation] = await Promise.all([
    prisma.rfp.findUnique({ where: { id: rfpId }, include: { items: true } }),
    prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { response: { include: { itemPrices: true } } },
    }),
  ]);
  if (!rfp || !invitation?.response) return { error: dictionary.itemCatalogErrors.rfpOrInvitationNotFound };

  const catalogList = await prisma.itemCatalogList.upsert({
    where: { clientId_name: { clientId: rfp.clientId, name } },
    create: { clientId: rfp.clientId, name },
    update: {},
  });

  let count = 0;
  for (const item of rfp.items) {
    const code = item.code?.trim();
    if (!code) continue;
    const price = invitation.response.itemPrices.find((p) => p.itemId === item.id);
    if (!price) continue;

    await prisma.itemCatalogEntry.upsert({
      where: {
        clientId_catalogListId_code: {
          clientId: rfp.clientId,
          catalogListId: catalogList.id,
          code,
        },
      },
      create: {
        clientId: rfp.clientId,
        catalogListId: catalogList.id,
        code,
        name: item.name,
        description: item.description,
        unit: item.unit,
        commodity: item.commodity,
        lastPrice: price.unitPrice,
      },
      update: {
        name: item.name,
        description: item.description,
        unit: item.unit,
        commodity: item.commodity,
        lastPrice: price.unitPrice,
      },
    });
    count++;
  }
  return { success: true, count };
}
