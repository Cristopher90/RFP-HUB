import "server-only";
import { prisma } from "@/lib/prisma";
import type { RfpStatus } from "@/generated/prisma/enums";

// Whenever an RFP would become OPEN (a fresh publish, an approval that
// completes it, a reopen, ...), it actually lands in AWAITING_START
// instead if its fecha de inicio hasn't arrived yet — suppliers shouldn't
// see the invitation before then. There's no background job to flip it
// back once time passes; syncAwaitingStart below does that lazily, the
// first time anything reads the RFP after its start time.
export function resolveOpenStatus(startDate: Date | null): "OPEN" | "AWAITING_START" {
  if (startDate && startDate.getTime() > Date.now()) return "AWAITING_START";
  return "OPEN";
}

// Call this wherever an RFP is loaded for display or for a supplier to
// respond to: if it's still marked AWAITING_START but its start date/hora
// has since passed, flips it to OPEN in the DB and returns the corrected
// status so the caller doesn't have to reload to see it.
export async function syncAwaitingStart(rfp: {
  id: string;
  status: RfpStatus;
  startDate: Date | null;
}): Promise<RfpStatus> {
  if (rfp.status !== "AWAITING_START") return rfp.status;
  if (rfp.startDate && rfp.startDate.getTime() > Date.now()) return rfp.status;
  await prisma.rfp.update({ where: { id: rfp.id }, data: { status: "OPEN" } });
  return "OPEN";
}

// Same idea, but for a page listing several RFPs at once (the home list):
// one bulk update for every AWAITING_START row whose time has come, run
// right before the page's own query so it sees the corrected status
// without a second round trip per row. `where` narrows it the same way
// the caller would scope its own listing query (client, etc.).
export async function sweepAwaitingStart(
  where: Record<string, unknown> = {},
): Promise<void> {
  await prisma.rfp.updateMany({
    where: { ...where, status: "AWAITING_START", startDate: { lte: new Date() } },
    data: { status: "OPEN" },
  });
}
