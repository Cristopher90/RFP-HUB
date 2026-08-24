import "server-only";
import { prisma } from "@/lib/prisma";

// SQLite doesn't allow autoincrement() on a non-id column, so the visible
// "RFP-{number}" id is assigned in code: highest existing number + 1.
// Fine for this app's write volume; not race-safe under heavy concurrency.
export async function nextRfpNumber(): Promise<number> {
  const max = await prisma.rfp.aggregate({ _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}
