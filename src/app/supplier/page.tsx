import Link from "next/link";
import { requireSupplierUser } from "@/lib/supplierAuth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime, formatRfpNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default async function SupplierHomePage() {
  const supplierUser = await requireSupplierUser();

  const invitations = await prisma.invitation.findMany({
    where: { supplier: { supplierDirectoryId: supplierUser.supplierDirectoryId } },
    include: {
      rfp: { include: { client: true } },
      response: true,
    },
    orderBy: { invitedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        RFP recibidas &middot; {supplierUser.supplierDirectory.companyName}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Solicitudes de cotización que te enviaron, con su estado y si ya
        participaste.
      </p>

      {invitations.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Todavía no recibiste ninguna RFP.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">RFP</th>
                <th className="px-5 py-3">Descripción</th>
                <th className="px-5 py-3">Recibida</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Participación</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 text-slate-700">
                    {inv.rfp.client.icon ? `${inv.rfp.client.icon} ` : ""}
                    {inv.rfp.client.description}
                  </td>
                  <td className="px-5 py-4">
                    <span className="mr-2 inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                      {formatRfpNumber(inv.rfp.number)}
                    </span>
                    <span className="font-medium text-slate-900">
                      {inv.rfp.title}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-5 py-4 text-slate-600">
                    {inv.rfp.description}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(inv.invitedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={inv.rfp.status} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {inv.response ? (
                      <span className="text-emerald-700">
                        Respondida &middot;{" "}
                        {formatDateTime(inv.response.submittedAt)}
                      </span>
                    ) : (
                      <span className="text-amber-600">Pendiente</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/respond/${inv.token}`}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      {inv.response ? "Ver →" : "Participar →"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
