import "server-only";
import { prisma } from "@/lib/prisma";

export type RatingSummary = { avg: number; count: number };

// Average stars (and number of ratings) per supplier-directory entry of a
// client: the score of a supplier is the mean of what every buyer gave it.
export async function loadRatingSummaries(clientId: string): Promise<Map<string, RatingSummary>> {
  const groups = await prisma.supplierRating.groupBy({
    by: ["supplierDirectoryId"],
    where: { clientId },
    _avg: { stars: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((g) => [
      g.supplierDirectoryId,
      { avg: Math.round((g._avg.stars ?? 0) * 10) / 10, count: g._count._all },
    ]),
  );
}

type DirectoryRow = {
  id: string;
  blocked: boolean;
  userLinks: { supplierUser: { id: string; name: string; lastName: string; email: string } }[];
};

// Shape the RFP supplier picker expects. A blocked supplier is offered with no
// contacts, which is exactly how a supplier without contacts is already
// disabled (it can't be invited).
export function toPickerEntries<T extends DirectoryRow>(
  rows: T[],
  ratings: Map<string, RatingSummary>,
) {
  return rows.map((s) => ({
    ...s,
    blocked: s.blocked,
    rating: ratings.get(s.id) ?? null,
    contacts: s.blocked
      ? []
      : s.userLinks.map((l) => ({
          id: l.supplierUser.id,
          name: `${l.supplierUser.name} ${l.supplierUser.lastName}`.trim(),
          email: l.supplierUser.email,
        })),
  }));
}
