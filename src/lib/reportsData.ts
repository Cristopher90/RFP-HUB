import "server-only";
import { prisma } from "@/lib/prisma";
import { findDecidedRfpIdsForUser, findPendingApprovalsForUser } from "@/lib/approvalEngine";
import type { Prisma } from "@/generated/prisma/client";

// Everything the Reports screen shows, computed on the server from exactly the
// RFPs the viewer is allowed to see (same rule as the RFP list):
//   ADMIN / CLIENT_ADMIN -> every RFP of the selected client
//   APPROVER             -> the RFPs assigned to them for approval
//   everyone else        -> only the RFPs they created
// Blind RFPs (offers hidden until close) that are still open never contribute
// response data, so a report can't reveal what the RFP itself hides.

export type ReportScope = "all" | "mine" | "assigned";

export type ReportData = {
  currency: string;
  scope: ReportScope;
  rfpCount: number;
  suppliers: { name: string; invited: number; responded: number; awarded: number }[];
  approvals: {
    stage: "PUBLISH" | "AWARD";
    approver: string;
    month: string; // YYYY-MM of the decision
    hours: number;
    rfp: number;
  }[];
  // One row per RFP in scope: the base for every breakdown by region, area
  // (commodity), buyer, month and cycle time.
  rfps: {
    id: string;
    number: number;
    status: string;
    region: string;
    commodity: string;
    buyer: string;
    month: string; // YYYY-MM of creation
    invited: number;
    responded: number;
    awarded: boolean;
    daysToClose: number | null; // published -> closed
    daysToAward: number | null; // published -> awarded
  }[];
  noResponse: {
    id: string;
    number: number;
    title: string;
    status: string;
    region: string;
    commodity: string;
    buyer: string;
    invited: number;
    deadlineAt: string;
  }[];
  items: {
    key: string;
    label: string;
    unit: string;
    points: { date: string; price: number; supplier: string; rfp: number; awarded: boolean }[];
  }[];
  buyers: {
    name: string;
    rfps: number;
    awarded: number;
    invited: number;
    responded: number;
    awardedValue: number;
    savingsHistorical: number;
    savingsAverage: number;
  }[];
  savings: {
    id: string;
    number: number;
    title: string;
    buyer: string;
    commodity: string;
    region: string;
    supplier: string;
    month: string;
    awardedTotal: number;
    savingsHistorical: number | null;
    historicalTotal: number | null;
    savingsAverage: number | null;
    averageTotal: number | null;
  }[];
};

const monthOf = (date: Date) => date.toISOString().slice(0, 7);
const personName = (u: { name: string; lastName: string | null } | null | undefined) =>
  u ? `${u.name} ${u.lastName ?? ""}`.trim() : "—";

export async function loadReportData(options: {
  user: { id: string; role: string };
  clientId: string;
  from?: Date;
  to?: Date;
}): Promise<ReportData> {
  const { user, clientId, from, to } = options;
  const isApprover = user.role === "APPROVER";
  const seesAll = user.role === "ADMIN" || user.role === "CLIENT_ADMIN";
  const scope: ReportScope = isApprover ? "assigned" : seesAll ? "all" : "mine";

  let visibility: Prisma.RfpWhereInput = {};
  if (isApprover) {
    const pending = await findPendingApprovalsForUser(user.id);
    const decided = await findDecidedRfpIdsForUser(user.id);
    visibility = { id: { in: [...new Set([...pending.map((p) => p.rfpId), ...decided])] } };
  } else if (!seesAll) {
    visibility = { createdByUserId: user.id };
  }

  const [client, rfps] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { currency: true } }),
    prisma.rfp.findMany({
      where: {
        clientId,
        status: { notIn: ["DRAFT", "DELETED"] },
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...visibility,
      },
      include: {
        createdBy: { select: { name: true, lastName: true } },
        items: true,
        invitations: {
          include: {
            supplier: true,
            response: { include: { itemPrices: true } },
          },
        },
        approvals: {
          include: { decisions: { include: { user: { select: { name: true, lastName: true } } } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const suppliers = new Map<string, { name: string; invited: number; responded: number; awarded: number }>();
  const rfpRows: ReportData["rfps"] = [];
  const itemMap = new Map<string, ReportData["items"][number]>();
  const buyers = new Map<string, ReportData["buyers"][number]>();
  const approvals: ReportData["approvals"] = [];
  const noResponse: ReportData["noResponse"] = [];
  const savings: ReportData["savings"] = [];

  for (const rfp of rfps) {
    const blindOpen = rfp.hideResponsesUntilClosed && rfp.status === "OPEN";
    const buyerName = personName(rfp.createdBy);
    const awardedInv = rfp.invitations.find((i) => i.id === rfp.awardedInvitationId);
    const respondedInvs = blindOpen ? [] : rfp.invitations.filter((i) => i.response);

    const regionKey = rfp.region?.trim() || "";
    const daysBetween = (end: Date | null, start: Date | null) =>
      end && start ? Math.max(0, Math.round(((end.getTime() - start.getTime()) / 86_400_000) * 10) / 10) : null;
    rfpRows.push({
      id: rfp.id,
      number: rfp.number,
      status: rfp.status,
      region: regionKey,
      commodity: rfp.commodity?.trim() || "",
      buyer: buyerName,
      month: monthOf(rfp.createdAt),
      invited: rfp.invitations.length,
      responded: respondedInvs.length,
      awarded: Boolean(rfp.awardedInvitationId),
      daysToClose: daysBetween(rfp.closedAt, rfp.publishedAt),
      daysToAward: daysBetween(rfp.awardedAt, rfp.publishedAt),
    });

    // Suppliers
    for (const inv of rfp.invitations) {
      const key = inv.supplier.supplierDirectoryId ?? (inv.supplier.company.trim().toLowerCase() || inv.supplier.email.toLowerCase());
      const entry = suppliers.get(key) ?? {
        name: inv.supplier.company.trim() || inv.supplier.name,
        invited: 0,
        responded: 0,
        awarded: 0,
      };
      entry.invited += 1;
      if (!blindOpen && inv.response) entry.responded += 1;
      if (inv.id === rfp.awardedInvitationId) entry.awarded += 1;
      suppliers.set(key, entry);
    }

    // Approval times
    for (const approval of rfp.approvals) {
      if (approval.decisions.length === 0) continue;
      const last = approval.decisions.reduce((a, b) => (a.decidedAt > b.decidedAt ? a : b));
      const start = approval.activatedAt ?? approval.createdAt;
      const hours = Math.max(0, (last.decidedAt.getTime() - start.getTime()) / 3_600_000);
      approvals.push({
        stage: approval.stage,
        approver: personName(last.user),
        month: monthOf(last.decidedAt),
        hours: Math.round(hours * 10) / 10,
        rfp: rfp.number,
      });
    }

    // RFPs with no responses (only where the viewer may know that)
    if ((rfp.status === "OPEN" || rfp.status === "CLOSED") && !blindOpen && respondedInvs.length === 0) {
      noResponse.push({
        id: rfp.id,
        number: rfp.number,
        title: rfp.title,
        status: rfp.status,
        region: regionKey,
        commodity: rfp.commodity?.trim() || "",
        buyer: buyerName,
        invited: rfp.invitations.length,
        deadlineAt: rfp.deadlineAt.toISOString(),
      });
    }

    // Item prices over time
    const itemById = new Map(rfp.items.map((i) => [i.id, i]));
    for (const inv of respondedInvs) {
      for (const price of inv.response!.itemPrices) {
        const item = itemById.get(price.itemId);
        if (!item) continue;
        const key = item.code?.trim() || item.name.trim().toLowerCase();
        const entry = itemMap.get(key) ?? {
          key,
          label: item.code?.trim() ? `${item.code.trim()} — ${item.name}` : item.name,
          unit: item.unit,
          points: [],
        };
        entry.points.push({
          date: inv.response!.submittedAt.toISOString(),
          price: price.unitPrice,
          supplier: inv.supplier.company.trim() || inv.supplier.name,
          rfp: rfp.number,
          awarded: inv.id === rfp.awardedInvitationId,
        });
        itemMap.set(key, entry);
      }
    }

    // Buyers
    const buyer = buyers.get(buyerName) ?? {
      name: buyerName,
      rfps: 0,
      awarded: 0,
      invited: 0,
      responded: 0,
      awardedValue: 0,
      savingsHistorical: 0,
      savingsAverage: 0,
    };
    buyer.rfps += 1;
    buyer.invited += rfp.invitations.length;
    buyer.responded += respondedInvs.length;

    // Savings: awarded RFPs only. Reference = historical price, or the
    // average of all offers for the item; saving = (reference - awarded) x qty.
    if (awardedInv?.response && !blindOpen) {
      buyer.awarded += 1;
      const awardedPrices = new Map(awardedInv.response.itemPrices.map((p) => [p.itemId, p.unitPrice]));
      let awardedTotal = 0;
      let historicalTotal = 0;
      let savingsHistorical = 0;
      let hasHistorical = false;
      let averageTotal = 0;
      let savingsAverage = 0;
      let hasAverage = false;
      for (const item of rfp.items) {
        const awardedPrice = awardedPrices.get(item.id);
        if (awardedPrice === undefined) continue;
        awardedTotal += awardedPrice * item.quantity;
        if (item.historicalPrice !== null && item.historicalPrice !== undefined) {
          hasHistorical = true;
          historicalTotal += item.historicalPrice * item.quantity;
          savingsHistorical += (item.historicalPrice - awardedPrice) * item.quantity;
        }
        const offers = respondedInvs
          .map((i) => i.response!.itemPrices.find((p) => p.itemId === item.id)?.unitPrice)
          .filter((p): p is number => p !== undefined);
        if (offers.length > 1) {
          hasAverage = true;
          const avg = offers.reduce((a, b) => a + b, 0) / offers.length;
          averageTotal += avg * item.quantity;
          savingsAverage += (avg - awardedPrice) * item.quantity;
        }
      }
      buyer.awardedValue += awardedTotal;
      if (hasHistorical) buyer.savingsHistorical += savingsHistorical;
      if (hasAverage) buyer.savingsAverage += savingsAverage;
      savings.push({
        id: rfp.id,
        number: rfp.number,
        title: rfp.title,
        buyer: buyerName,
        commodity: rfp.commodity?.trim() || "",
        region: regionKey,
        supplier: awardedInv.supplier.company.trim() || awardedInv.supplier.name,
        month: monthOf(rfp.awardedAt ?? rfp.closedAt ?? rfp.createdAt),
        awardedTotal,
        savingsHistorical: hasHistorical ? savingsHistorical : null,
        historicalTotal: hasHistorical ? historicalTotal : null,
        savingsAverage: hasAverage ? savingsAverage : null,
        averageTotal: hasAverage ? averageTotal : null,
      });
    }
    buyers.set(buyerName, buyer);
  }

  // Keep the payload small: the 200 most-quoted articles.
  const items = [...itemMap.values()]
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 200);

  return {
    currency: client?.currency ?? "USD",
    scope,
    rfpCount: rfps.length,
    suppliers: [...suppliers.values()],
    approvals,
    rfps: rfpRows,
    noResponse,
    items,
    buyers: [...buyers.values()],
    savings,
  };
}
