import "server-only";
import { prisma } from "@/lib/prisma";

// Every #tag used on the given RFPs (already scoped to a client), most used first.
export async function loadRfpTags(where: Record<string, unknown>): Promise<string[]> {
  const rows = await prisma.rfp.findMany({
    where: { ...where, status: { not: "DELETED" }, tags: { isEmpty: false } },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) for (const tag of r.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}
