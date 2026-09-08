"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export type ItemCatalogItemInput = {
  clientKey: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  lastPrice: string;
};

export async function saveItemCatalog(
  items: ItemCatalogItemInput[],
): Promise<{ error: string } | { success: true }> {
  await requireRole("ADMIN");

  const cleaned = items
    .map((i) => ({
      code: i.code.trim(),
      name: i.name.trim(),
      description: i.description.trim() || null,
      unit: i.unit.trim() || "unidad",
      lastPrice: i.lastPrice.trim() ? Number(i.lastPrice) : null,
    }))
    .filter((i) => i.code.length > 0 && i.name.length > 0);

  const seen = new Set<string>();
  for (const i of cleaned) {
    const key = i.code.toLowerCase();
    if (seen.has(key)) {
      return { error: `El código "${i.code}" está repetido.` };
    }
    seen.add(key);
  }

  await prisma.itemCatalog.deleteMany({});
  if (cleaned.length > 0) {
    await prisma.itemCatalog.createMany({ data: cleaned });
  }

  revalidatePath("/admin/master-data/items");
  revalidatePath("/rfps/new");
  return { success: true };
}
