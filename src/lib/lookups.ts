import "server-only";
import { prisma } from "@/lib/prisma";
import type { CfOption } from "@/lib/customFieldsShared";

// Adds/updates the given options as values of a lookup (matched by code; values
// not mentioned are left alone). Used by the Excel import of custom fields.
export async function upsertLookupValues(lookupId: string, options: CfOption[]) {
  const existing = await prisma.lookupValue.findMany({ where: { lookupId }, select: { id: true, code: true } });
  const idByCode = new Map(existing.map((v) => [v.code, v.id]));
  let order = existing.length;
  for (const o of options) {
    const data = { description: o.labels.es || o.value, descriptionEn: o.labels.en || null };
    const id = idByCode.get(o.value);
    if (id) {
      await prisma.lookupValue.update({ where: { id }, data });
    } else {
      const created = await prisma.lookupValue.create({ data: { lookupId, code: o.value, order: order++, ...data } });
      idByCode.set(o.value, created.id);
    }
  }
  for (const o of options) {
    if (!o.parent) continue;
    const parentId = idByCode.get(o.parent);
    const id = idByCode.get(o.value);
    if (parentId && id && parentId !== id) await prisma.lookupValue.update({ where: { id }, data: { parentId } });
  }
}
