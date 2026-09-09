import Link from "next/link";
import packageJson from "../../package.json";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatRfpNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { RfpFilters } from "@/components/RfpFilters";
import { findPendingApprovalsForUser } from "@/lib/approvalEngine";
import { PendingApprovalsBox } from "./PendingApprovalsBox";
import type { RfpStatus } from "@/generated/prisma/enums";

export default async function Home({
  searchParams,
}: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;

  const isAdmin = user.role === "ADMIN";
  const requestedTab = sp.tab === "all" ? "all" : "mine";
  const tab = requestedTab === "all" && isAdmin ? "all" : "mine";

  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const commodityFilter = typeof sp.commodity === "string" ? sp.commodity : "";
  const regionFilter = typeof sp.region === "string" ? sp.region : "";
  const creatorFilter = typeof sp.creator === "string" ? sp.creator : "";

  const where = {
    // Soft-deleted RFPs stay in the DB but never show up in normal
    // listings unless the status filter explicitly asks for them.
    status: statusFilter
      ? (statusFilter as RfpStatus)
      : { not: "DELETED" as RfpStatus },
    ...(tab === "mine" ? { createdByUserId: user.id } : {}),
    ...(commodityFilter ? { commodity: commodityFilter } : {}),
    ...(regionFilter ? { region: regionFilter } : {}),
    ...(tab === "all" && creatorFilter
      ? { createdByUserId: creatorFilter }
      : {}),
  };

  const [rfps, commodities, regions, creators, pendingApprovals] =
    await Promise.all([
      prisma.rfp.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          invitations: { include: { response: true } },
          createdBy: true,
        },
      }),
      prisma.commodity.findMany({ orderBy: { description: "asc" } }),
      prisma.region.findMany({ orderBy: { description: "asc" } }),
      isAdmin ? prisma.user.findMany({ orderBy: { name: "asc" } }) : null,
      findPendingApprovalsForUser(user.id),
    ]);

  function tabHref(target: "mine" | "all") {
    const params = new URLSearchParams();
    if (commodityFilter) params.set("commodity", commodityFilter);
    if (regionFilter) params.set("region", regionFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (target === "all" && creatorFilter)
      params.set("creator", creatorFilter);
    params.set("tab", target);
    return `/?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Solicitudes de cotización (RFP)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Crea una RFP, invita proveedores y compara sus respuestas en un
            solo lugar.
          </p>
        </div>
        <Link
          href="/rfps/new"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          + Nueva RFP
        </Link>
      </div>

      {pendingApprovals.length > 0 && (
        <PendingApprovalsBox
          items={pendingApprovals.map((p) => ({
            rfpId: p.rfpId,
            rfpNumber: p.rfpNumber,
            rfpTitle: p.rfpTitle,
            stage: p.stage,
            approvalId: p.approvalId,
            createdAt: p.createdAt.toISOString(),
          }))}
        />
      )}

      <div className="mb-4 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          <Link
            href={tabHref("mine")}
            className={`border-b-2 px-1 pb-3 text-sm font-medium ${
              tab === "mine"
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Mis RFPs
          </Link>
          {isAdmin && (
            <Link
              href={tabHref("all")}
              className={`border-b-2 px-1 pb-3 text-sm font-medium ${
                tab === "all"
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Todas las RFPs
            </Link>
          )}
        </nav>
      </div>

      <div className="mb-6">
        <RfpFilters
          commodities={commodities.map((c) => c.description)}
          regions={regions.map((r) => r.description)}
          creators={
            tab === "all" && creators
              ? creators.map((u) => ({ id: u.id, name: u.name }))
              : undefined
          }
        />
      </div>

      {rfps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            No hay RFPs que coincidan con estos filtros.
          </p>
          <Link
            href="/rfps/new"
            className="mt-4 inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Crear la primera RFP
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">RFP</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Commodity</th>
                <th className="px-5 py-3">Región</th>
                <th className="px-5 py-3">Creador</th>
                <th className="px-5 py-3">Art&iacute;culos</th>
                <th className="px-5 py-3">Proveedores</th>
                <th className="px-5 py-3">Respuestas</th>
                <th className="px-5 py-3">Cierre</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rfps.map((rfp) => {
                const responded = rfp.invitations.filter(
                  (inv) => inv.response,
                ).length;
                return (
                  <tr key={rfp.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={`/rfps/${rfp.id}`} className="group flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                          {formatRfpNumber(rfp.number)}
                        </span>
                        <span className="font-medium text-slate-900 group-hover:text-violet-600">
                          {rfp.title}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={rfp.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {rfp.commodity ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {rfp.region ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {`${rfp.createdBy?.name ?? ""} ${rfp.createdBy?.lastName ?? ""}`.trim() ||
                        "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {rfp.items.length}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {rfp.invitations.length}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {responded} / {rfp.invitations.length}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(rfp.deadlineAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/rfps/${rfp.id}`}
                        className="text-sm font-medium text-violet-600 hover:text-violet-700"
                      >
                        Ver &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-slate-300">
        RFP.HUB v{packageJson.version}
      </p>
    </div>
  );
}
