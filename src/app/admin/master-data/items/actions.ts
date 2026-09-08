"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type ItemCatalogItemInput = {
  clientKey: string;
  catalogName: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  commodity: string;
  lastPrice: string;
};

export async function saveItemCatalog(
  items: ItemCatalogItemInput[],
): Promise<{ error: string } | { success: true }> {
  await requireRole("ADMIN");

  const cleaned = items
    .map((i) => ({
      catalogName: i.catalogName.trim(),
      code: i.code.trim(),
      name: i.name.trim(),
      description: i.description.trim() || null,
      unit: i.unit.trim() || "unidad",
      commodity: i.commodity.trim() || null,
      lastPrice: i.lastPrice.trim() ? Number(i.lastPrice) : null,
    }))
    .filter((i) => i.catalogName.length > 0 && i.code.length > 0 && i.name.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    const key = `${i.catalogName.toLowerCase()}::${i.code.toLowerCase()}`;
    if (seen.has(key)) {
      return {
        error: `El código "${i.code}" está repetido en el catálogo "${i.catalogName}".`,
      };
    }
    seen.add(key);
  }

  // Reemplazo total de entradas — mismo patrón que el resto de datos
  // maestros. Los catálogos (nombres) se conservan/crean por upsert, así
  // que uno que se quede sin entradas simplemente queda vacío.
  await prisma.itemCatalogEntry.deleteMany({});

  const catalogNames = [...new Set(cleaned.map((i) => i.catalogName))];
  const idByName = new Map<string, string>();
  for (const name of catalogNames) {
    const list = await prisma.itemCatalogList.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    idByName.set(name, list.id);
  }

  if (cleaned.length > 0) {
    await prisma.itemCatalogEntry.createMany({
      data: cleaned.map((i) => ({
        catalogListId: idByName.get(i.catalogName)!,
        code: i.code,
        name: i.name,
        description: i.description,
        unit: i.unit,
        commodity: i.commodity,
        lastPrice: i.lastPrice,
      })),
    });
  }

  revalidatePath("/admin/master-data/items");
  revalidatePath("/rfps/new");
  return { success: true };
}
