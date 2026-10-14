import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { requireClientScope } from "@/lib/clientScope";
import { buyerGroupIdsOf, canViewRequests, visibilityWhere } from "@/lib/requestAccess";
import { viewGroupWhere } from "@/lib/viewGroups";
import { isRfpAdmin, participantWhere, rfpAccess } from "@/lib/rfpAccess";
import { formatRfpNumber } from "@/lib/format";
import { MENTIONABLE_ID, mentionKey, splitMentions, type Mention, type MentionKind } from "@/lib/mentionsShared";

type Scope = Awaited<ReturnType<typeof requireClientScope>>;

export type MentionSuggestion = { kind: MentionKind; token: string; label: string; hint: string };

// The Super Administrador works on one client at a time through ?clientId=.
const withClient = (scope: Scope, clientId: string) => (scope.isSuperAdmin ? `&clientId=${clientId}` : "");

// Turns the mentions found in the given note texts into links, only for what
// the viewer is allowed to open (same client, request permissions, view groups).
export async function resolveMentions(scope: Scope, bodies: string[]): Promise<Record<string, Mention>> {
  const wanted: Record<MentionKind, Set<string>> = { RFP: new Set(), DOC: new Set(), PRV: new Set() };
  for (const body of bodies) {
    for (const seg of splitMentions(body)) if (seg.type === "mention") wanted[seg.kind].add(seg.id);
  }
  const { user } = scope;
  const result: Record<string, Mention> = {};

  const numbers = [...wanted.RFP].map((id) => Number(id)).filter((n) => Number.isInteger(n) && n > 0 && n < 2_000_000_000);
  if (numbers.length > 0) {
    const rfps = await prisma.rfp.findMany({
      where: { ...scope.where, number: { in: numbers }, status: { not: "DELETED" } },
      select: { id: true, number: true, title: true, createdByUserId: true },
    });
    for (const r of rfps) {
      // Only link what the viewer can really open (creator, team, administrators, involved approvers).
      if (!(await rfpAccess(user, r))) continue;
      result[mentionKey("RFP", String(r.number))] = { href: `/rfps/${r.id}`, title: r.title };
    }
  }

  if (wanted.DOC.size > 0 && canViewRequests(user)) {
    const groupIds = await buyerGroupIdsOf(user.id);
    const docs = await prisma.purchaseRequest.findMany({
      where: {
        ...scope.where,
        documentNumber: { in: [...wanted.DOC] },
        ...visibilityWhere(user, groupIds),
      } as Prisma.PurchaseRequestWhereInput,
      select: { id: true, clientId: true, documentNumber: true, documentType: true },
      orderBy: { importedAt: "desc" },
    });
    for (const r of docs) {
      const key = mentionKey("DOC", r.documentNumber);
      if (result[key]) continue;
      result[key] = {
        href: `/requests?q=${encodeURIComponent(r.documentNumber)}&open=${r.id}${withClient(scope, r.clientId)}`,
        title: `${r.documentType} ${r.documentNumber}`,
      };
    }
  }

  if (wanted.PRV.size > 0 && user.role !== "APPROVER") {
    const suppliers = await prisma.supplierDirectory.findMany({
      where: { ...scope.where, code: { in: [...wanted.PRV] }, ...viewGroupWhere(user) },
      select: { id: true, clientId: true, code: true, companyName: true },
    });
    for (const s of suppliers) {
      const key = mentionKey("PRV", s.code);
      if (result[key]) continue;
      result[key] = { href: `/suppliers?id=${s.id}${withClient(scope, s.clientId)}`, title: s.companyName };
    }
  }
  return result;
}

// Suggestions for what the user is typing after "@": RFPs, requests and suppliers they can open.
export async function searchMentionTargets(scope: Scope, rawQuery: string): Promise<MentionSuggestion[]> {
  const q = rawQuery.trim().replace(/^(RFP|DOC|PRV)-?/i, "").slice(0, 40);
  if (!q) return [];
  const { user } = scope;
  const contains = { contains: q, mode: "insensitive" as const };
  const asNumber = /^\d{1,9}$/.test(q) ? Number(q) : null;

  const [rfps, docs, suppliers] = await Promise.all([
    prisma.rfp.findMany({
      where: {
        ...scope.where,
        status: { not: "DELETED" },
        // Only RFPs the user can open.
        ...(isRfpAdmin(user) ? {} : participantWhere(user.id)),
        AND: [{ OR: [{ title: contains }, ...(asNumber !== null ? [{ number: asNumber }] : [])] }],
      },
      select: { number: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    canViewRequests(user)
      ? prisma.purchaseRequest.findMany({
          where: {
            ...scope.where,
            documentNumber: contains,
            ...visibilityWhere(user, await buyerGroupIdsOf(user.id)),
          } as Prisma.PurchaseRequestWhereInput,
          select: { documentNumber: true, documentType: true, commodity: true },
          orderBy: { importedAt: "desc" },
          take: 4,
        })
      : Promise.resolve([]),
    user.role === "APPROVER"
      ? Promise.resolve([])
      : prisma.supplierDirectory.findMany({
          where: {
            ...scope.where,
            ...viewGroupWhere(user),
            OR: [{ code: contains }, { companyName: contains }, { taxId: contains }],
          },
          select: { code: true, companyName: true, taxId: true },
          orderBy: { companyName: "asc" },
          take: 4,
        }),
  ]);

  const out: MentionSuggestion[] = [];
  for (const r of rfps) {
    out.push({ kind: "RFP", token: `@RFP-${r.number}`, label: formatRfpNumber(r.number), hint: r.title });
  }
  for (const r of docs) {
    if (!MENTIONABLE_ID.test(r.documentNumber)) continue;
    out.push({
      kind: "DOC",
      token: `@DOC-${r.documentNumber}`,
      label: r.documentNumber,
      hint: [r.documentType, r.commodity].filter(Boolean).join(" · "),
    });
  }
  for (const s of suppliers) {
    if (!MENTIONABLE_ID.test(s.code)) continue;
    out.push({
      kind: "PRV",
      token: `@PRV-${s.code}`,
      label: s.code,
      hint: [s.companyName, s.taxId].filter(Boolean).join(" · "),
    });
  }
  return out.filter((s, i) => out.findIndex((o) => o.token === s.token) === i);
}
