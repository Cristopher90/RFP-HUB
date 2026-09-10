import { requireSupplierUser } from "@/lib/supplierAuth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatRfpNumber } from "@/lib/format";
import { sweepAwaitingStart } from "@/lib/rfpStatus";
import { getViewerPreferences } from "@/lib/preferences";
import { localeForLanguage } from "@/i18n/locale";
import { SupplierRfpTable } from "./SupplierRfpTable";

export default async function SupplierHomePage() {
  const supplierUser = await requireSupplierUser();
  const preferences = await getViewerPreferences();
  const dateOptions = { locale: localeForLanguage(preferences.language), timeZone: preferences.timeZone };

  await sweepAwaitingStart({
    invitations: {
      some: { supplier: { supplierDirectoryId: supplierUser.supplierDirectoryId } },
    },
  });

  const invitations = await prisma.invitation.findMany({
    where: {
      supplier: { supplierDirectoryId: supplierUser.supplierDirectoryId },
      rfp: {
        status: { notIn: ["AWAITING_START", "PENDING_PUBLISH_APPROVAL"] },
      },
    },
    include: {
      rfp: { include: { client: true } },
      response: true,
    },
    orderBy: { invitedAt: "desc" },
  });

  const rows = invitations.map((inv) => ({
    id: inv.id,
    token: inv.token,
    clientLabel: inv.rfp.client.icon
      ? `${inv.rfp.client.icon} ${inv.rfp.client.description}`
      : inv.rfp.client.description,
    rfpNumberLabel: formatRfpNumber(inv.rfp.number),
    rfpTitle: inv.rfp.title,
    rfpDescription: inv.rfp.description,
    status: inv.rfp.status,
    invitedAtLabel: formatDate(inv.invitedAt, dateOptions),
    responded: Boolean(inv.response),
    responseLabel: inv.response
      ? formatDateTime(inv.response.submittedAt, dateOptions)
      : null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        RFP recibidas &middot; {supplierUser.supplierDirectory.companyName}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Solicitudes de cotización que te enviaron, con su estado y si ya
        participaste.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Todavía no recibiste ninguna RFP.
        </div>
      ) : (
        <SupplierRfpTable invitations={rows} />
      )}
    </div>
  );
}
