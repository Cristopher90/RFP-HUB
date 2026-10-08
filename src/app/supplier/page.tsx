import Link from "next/link";
import { acceptedLinks, companyNames, isSupplierAdmin, requireSupplierUser } from "@/lib/supplierAuth";
import { PendingConnections } from "./PendingConnections";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatRfpNumber } from "@/lib/format";
import { sweepAwaitingStart } from "@/lib/rfpStatus";
import { getViewerPreferences } from "@/lib/preferences";
import { localeForLanguage } from "@/i18n/locale";
import { getDictionary } from "@/i18n/getDictionary";
import { SupplierRfpTable } from "./SupplierRfpTable";

export default async function SupplierHomePage() {
  const supplierUser = await requireSupplierUser();
  const preferences = await getViewerPreferences();
  const dateOptions = { locale: localeForLanguage(preferences.language), timeZone: preferences.timeZone };
  const dictionary = getDictionary(preferences.language);

  // One account sees the RFPs of every client it is connected to (accepted).
  const directoryIds = acceptedLinks(supplierUser).map((l) => l.supplierDirectoryId);

  await sweepAwaitingStart({
    invitations: {
      some: { supplier: { supplierDirectoryId: { in: directoryIds } } },
    },
  });

  // Connections other clients are offering (to accept) and, for an
  // administrator, contacts waiting for their approval.
  const offered = supplierUser.links.filter((l) => l.status === "SENT");
  const awaitingApproval = isSupplierAdmin(supplierUser)
    ? await prisma.supplierUserLink.count({
        where: {
          status: "PENDING_APPROVAL",
          supplierDirectoryId: {
            in: acceptedLinks(supplierUser)
              .filter((l) => l.isAdmin)
              .map((l) => l.supplierDirectoryId),
          },
        },
      })
    : 0;

  const invitations = await prisma.invitation.findMany({
    where: {
      supplier: { supplierDirectoryId: { in: directoryIds } },
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
        {dictionary.supplierPortal.titlePrefix} &middot; {companyNames(supplierUser)}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.supplierPortal.subtitle}
      </p>

      {offered.length > 0 && (
        <PendingConnections
          offers={offered.map((l) => ({
            id: l.id,
            clientLabel: l.client.description,
            company: l.supplierDirectory.companyName,
          }))}
        />
      )}
      {awaitingApproval > 0 && (
        <Link
          href="/supplier/contacts"
          className="mt-6 block rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          {(awaitingApproval === 1
            ? dictionary.supplierContactsPage.approvalBannerOne
            : dictionary.supplierContactsPage.approvalBannerMany
          ).replace("{count}", String(awaitingApproval))}
        </Link>
      )}

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {dictionary.supplierPortal.noRfpsYet}
        </div>
      ) : (
        <SupplierRfpTable invitations={rows} />
      )}
    </div>
  );
}
