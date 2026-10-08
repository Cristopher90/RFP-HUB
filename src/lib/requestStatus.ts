// A request's status is derived from its linked RFP — only "cancelled" is
// stored. Client-safe.

export const REQUEST_STATUSES = [
  "NEW",
  "PROCESSED",
  "IN_NEGOTIATION",
  "NEGOTIATED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}

type RfpState = { status: string; awardedInvitationId: string | null } | null;

export function deriveRequestStatus(request: {
  cancelled: boolean;
  rfp: RfpState;
}): RequestStatus {
  if (request.cancelled) return "CANCELLED";
  const rfp = request.rfp;
  if (!rfp || rfp.status === "DELETED") return "NEW";
  if (rfp.awardedInvitationId) return "NEGOTIATED";
  if (rfp.status === "DRAFT" || rfp.status === "PENDING_PUBLISH_APPROVAL") return "PROCESSED";
  return "IN_NEGOTIATION";
}

// Prisma `where` fragment equivalent of deriveRequestStatus, for filtering.
export function statusWhere(status: RequestStatus): Record<string, unknown> {
  switch (status) {
    case "CANCELLED":
      return { cancelled: true };
    case "NEW":
      return { cancelled: false, OR: [{ rfpId: null }, { rfp: { status: "DELETED" } }] };
    case "PROCESSED":
      return {
        cancelled: false,
        rfp: { status: { in: ["DRAFT", "PENDING_PUBLISH_APPROVAL"] } },
      };
    case "IN_NEGOTIATION":
      return {
        cancelled: false,
        rfp: { status: { in: ["OPEN", "AWAITING_START", "CLOSED"] }, awardedInvitationId: null },
      };
    case "NEGOTIATED":
      return {
        cancelled: false,
        rfp: { status: { not: "DELETED" }, awardedInvitationId: { not: null } },
      };
  }
}
