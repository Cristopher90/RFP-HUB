import Link from "next/link";
import packageJson from "../../package.json";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { RfpFilters } from "@/components/RfpFilters";
import { RfpTable, type RfpRow } from "@/components/RfpTable";
import { findPendingApprovalsForUser, findDecidedRfpIdsForUser } from "@/lib/approvalEngine";
import { PendingApprovalsBox } from "./PendingApprovalsBox";
import type { RfpStatus } from "@/generated/prisma/enums";

export default async function Home({
  searchParams,
}: PageProps<"/">) {
  const scope = await requireClientScope();
  const { user } = scope;
  const sp = await searchParams;

  // ADMIN sees every client's RFPs on "Todas"; CLIENT_ADMIN sees every RFP
  // within their own client; everyone else only ever sees "Mis RFPs".
  const canSeeAll = user.role === "ADMIN" || user.role === "CLIENT_ADMIN";
  const isApprover = user.role === "APPROVER";
  const requestedTab = sp.tab === "all" ? "all" : "mine";
  const tab = requestedTab === "all" && canSeeAll ? "all" : "mine";

  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const commodityFilter = typeof sp.commodity === "string" ? sp.commodity : "";
  const regionFilter = typeof sp.region === "string" ? sp.region : "";
  const creatorFilter = typeof sp.creator === "string" ? sp.creator : "";
  const clientFilter = typeof sp.client === "string" ? sp.client : "";

  // An APPROVER never creates RFPs, so "Mis RFPs" (createdByUserId) makes
  // no sense for them — their whole list is the RFPs they still need to
  // decide on, plus the ones they already decided on (so an approval
  // doesn't make the RFP disappear — they can still consult it).
  const pendingApprovals = await findPendingApprovalsForUser(user.id);
  const decidedRfpIds = isApprover ? await findDecidedRfpIdsForUser(user.id) : [];
  const assignedRfpIds = [
    ...new Set([...pendingApprovals.map((p) => p.rfpId), ...decidedRfpIds]),
  ];

  const where = {
    // Soft-deleted RFPs stay in the DB but never show up in normal
    // listings unless the status filter explicitly asks for them.
    status: statusFilter
      ? (statusFilter as RfpStatus)
      : { not: "DELETED" as RfpStatus },
    ...(isApprover
      ? { id: { in: assignedRfpIds } }
      : tab === "mine"
        ? { createdByUserId: user.id }
        : scope.where),
    ...(commodityFilter ? { commodity: commodityFilter } : {}),
    ...(regionFilter ? { region: regionFilter } : {}),
    ...(tab === "all" && creatorFilter
      ? { createdByUserId: creatorFilter }
      : {}),
    ...(tab === "all" && scope.isSuperAdmin && clientFilter
      ? { clientId: clientFilter }
      : {}),
  };

  const [rfps, commodities, regions, creators, clients] = await Promise.all([
    prisma.rfp.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        invitations: { include: { response: true } },
        createdBy: true,
        client: true,
      },
    }),
    prisma.commodity.findMany({ where: scope.where, orderBy: { description: "asc" } }),
    prisma.region.findMany({ where: scope.where, orderBy: { description: "asc" } }),
    canSeeAll
      ? prisma.user.findMany({ where: scope.where, orderBy: { name: "asc" } })
      : null,
    tab === "all" && scope.isSuperAdmin
      ? prisma.client.findMany({ orderBy: { description: "asc" } })
      : null,
  ]);

  const showClientColumn = scope.isSuperAdmin && tab === "all";

  const rfpRows: RfpRow[] = rfps.map((rfp) => ({
    id: rfp.id,
    number: rfp.number,
    title: rfp.title,
    status: rfp.status,
    commodity: rfp.commodity,
    region: rfp.region,
    creatorName:
      `${rfp.createdBy?.name ?? ""} ${rfp.createdBy?.lastName ?? ""}`.trim() || "—",
    itemCount: rfp.items.length,
    invitationCount: rfp.invitations.length,
    respondedCount: rfp.invitations.filter((inv) => inv.response).length,
    deadlineAt: rfp.deadlineAt.toISOString(),
    clientLabel: showClientColumn
      ? `${rfp.client.icon ? `${rfp.client.icon} ` : ""}${rfp.client.description}`
      : null,
  }));

  function tabHref(target: "mine" | "all") {
    const params = new URLSearchParams();
    if (commodityFilter) params.set("commodity", commodityFilter);
    if (regionFilter) params.set("region", regionFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (target === "all" && creatorFilter)
      params.set("creator", creatorFilter);
    if (target === "all" && clientFilter) params.set("client", clientFilter);
    params.set("tab", target);
    return `/?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isApprover ? "RFPs asignadas para tu aprobación" : "Solicitudes de cotización (RFP)"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isApprover
              ? "Solo ves las RFPs en las que participás como aprobador."
              : "Crea una RFP, invita proveedores y compara sus respuestas en un solo lugar."}
          </p>
        </div>
        {!isApprover && (
          <Link
            href="/rfps/new"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            + Nueva RFP
          </Link>
        )}
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

      {!isApprover && (
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
            {canSeeAll && (
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
      )}

      <div className="mb-6">
        <RfpFilters
          commodities={commodities}
          regions={regions}
          creators={
            tab === "all" && creators
              ? creators.map((u) => ({ id: u.id, name: u.name }))
              : undefined
          }
          clients={
            tab === "all" && clients
              ? clients.map((c) => ({ id: c.id, description: c.description }))
              : undefined
          }
        />
      </div>

      {rfps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {isApprover
              ? "No tenés RFPs asignadas por el momento."
              : "No hay RFPs que coincidan con estos filtros."}
          </p>
          {!isApprover && (
            <Link
              href="/rfps/new"
              className="mt-4 inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Crear la primera RFP
            </Link>
          )}
        </div>
      ) : (
        <RfpTable rfps={rfpRows} showClientColumn={showClientColumn} />
      )}

      <p className="mt-8 text-center text-xs text-slate-300">
        RFP.HUB v{packageJson.version}
      </p>
    </div>
  );
}
