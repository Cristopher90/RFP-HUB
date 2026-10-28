import { participantWhere } from "@/lib/rfpAccess";
import { loadRfpTags } from "@/lib/rfpTags";
import Link from "next/link";
import packageJson from "../../package.json";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { RfpFilters } from "@/components/RfpFilters";
import { RfpTable, type RfpRow } from "@/components/RfpTable";
import { findPendingApprovalsForUser, findDecidedRfpIdsForUser } from "@/lib/approvalEngine";
import { sweepAwaitingStart } from "@/lib/rfpStatus";
import { PendingApprovalsBox } from "./PendingApprovalsBox";
import { RfpCalendar } from "@/components/RfpCalendar";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { getDictionary } from "@/i18n/getDictionary";
import { unreadForBuyer } from "@/lib/rfpMessages";
import { formatDateTime, formatRfpNumber } from "@/lib/format";
import { localeForLanguage } from "@/i18n/locale";
import { zonedTimeToUtc } from "@/lib/timezone";
import { readUserPref } from "@/lib/userPrefs";
import { RFP_FILTERS_PREF_KEY, RFP_FILTER_PARAMS } from "@/lib/prefKeys";
import { redirect } from "next/navigation";
import type { RfpStatus } from "@/generated/prisma/enums";
import { loadCustomFields, rfpIdsMatchingCustom } from "@/lib/customFields";
import { applyViewGroupsToFields, normalizeValue } from "@/lib/customFieldsShared";
import { filterTreeByGroups } from "@/lib/viewGroups";

export default async function Home({
  searchParams,
}: PageProps<"/">) {
  const scope = await requireClientScope();
  const { user } = scope;
  const sp = await searchParams;
  const dictionary = getDictionary(user.language);

  // Opening the list with no filters at all (e.g. from the sidebar) restores
  // the filters this user last used.
  if (Object.keys(sp).length === 0) {
    const saved = await readUserPref(user.id, RFP_FILTERS_PREF_KEY);
    if (saved) {
      const restored = new URLSearchParams();
      for (const [key, value] of new URLSearchParams(saved)) {
        if ((RFP_FILTER_PARAMS.includes(key) || key.startsWith("cf_")) && value) restored.set(key, value);
      }
      if (restored.size > 0) redirect(`/?${restored.toString()}`);
    }
  }

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
  const tagFilter = typeof sp.tag === "string" ? sp.tag.trim().toLowerCase().slice(0, 40) : "";
  const supplierFilter = typeof sp.supplier === "string" ? sp.supplier.trim() : "";
  const dateParam = (key: string) =>
    typeof sp[key] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp[key] as string)
      ? (sp[key] as string)
      : "";
  const createdFrom = dateParam("createdFrom");
  const createdTo = dateParam("createdTo");
  const startFrom = dateParam("startFrom");
  const startTo = dateParam("startTo");
  const closeFrom = dateParam("closeFrom");
  const closeTo = dateParam("closeTo");

  // "Filtros de cliente": the custom header fields of one client flagged as
  // list filters. A client user always has theirs; a super admin gets them
  // once a single client is picked on "Todas".
  const customFilterClientId = scope.isSuperAdmin
    ? tab === "all" && clientFilter
      ? clientFilter
      : null
    : user.clientId;
  const customFilterFields = customFilterClientId
    ? applyViewGroupsToFields(await loadCustomFields(customFilterClientId, "RFP_HEAD"), user).filter(
        (f) => f.listFilter && f.visible,
      )
    : [];
  const customFilterValues: { key: string; value: string }[] = [];
  for (const f of customFilterFields) {
    const raw = sp[`cf_${f.key}`];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalized = normalizeValue(f, raw);
    if ("value" in normalized && normalized.value !== "") {
      customFilterValues.push({ key: f.key, value: normalized.value });
    }
  }
  const customMatchedIds =
    customFilterClientId && customFilterValues.length > 0
      ? await rfpIdsMatchingCustom(customFilterClientId, customFilterValues)
      : null;

  // Date filters are calendar days in the viewer's own timezone: [from 00:00,
  // to 23:59:59.999] expressed as UTC instants.
  function dayRange(from: string, to: string) {
    return {
      ...(from ? { gte: zonedTimeToUtc(`${from}T00:00`, user.timezone) } : {}),
      ...(to
        ? { lte: new Date(zonedTimeToUtc(`${to}T23:59`, user.timezone).getTime() + 59_999) }
        : {}),
    };
  }
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
  const advancedWhere = [
    ...(tagFilter ? [{ tags: { has: tagFilter } }] : []),
    ...(createdFrom || createdTo ? [{ createdAt: dayRange(createdFrom, createdTo) }] : []),
    // An RFP with no explicit start date starts the day it was published.
    ...(startFrom || startTo
      ? [
          {
            OR: [
              { startDate: dayRange(startFrom, startTo) },
              { startDate: null, publishedAt: dayRange(startFrom, startTo) },
            ],
          },
        ]
      : []),
    ...(closeFrom || closeTo ? [{ deadlineAt: dayRange(closeFrom, closeTo) }] : []),
    ...(customMatchedIds ? [{ id: { in: customMatchedIds } }] : []),
    // Invited supplier: by name, email or company as invited, or by the
    // directory entry's code, tax ID (CIF), company name or email.
    ...(supplierFilter
      ? [
          {
            invitations: {
              some: {
                supplier: {
                  OR: [
                    { name: contains(supplierFilter) },
                    { email: contains(supplierFilter) },
                    { company: contains(supplierFilter) },
                    {
                      supplierDirectory: {
                        OR: [
                          { code: contains(supplierFilter) },
                          { taxId: contains(supplierFilter) },
                          { companyName: contains(supplierFilter) },
                          { email: contains(supplierFilter) },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ]
      : []),
  ];

  // An APPROVER never creates RFPs, so "Mis RFPs" (createdByUserId) makes
  // no sense for them — their whole list is the RFPs they still need to
  // decide on, plus the ones they already decided on (so an approval
  // doesn't make the RFP disappear — they can still consult it).
  const pendingApprovals = await findPendingApprovalsForUser(user.id);
  const decidedRfpIds = isApprover ? await findDecidedRfpIdsForUser(user.id) : [];
  const assignedRfpIds = [
    ...new Set([...pendingApprovals.map((p) => p.rfpId), ...decidedRfpIds]),
  ];

  // Supplier messages waiting for an answer (for those who can answer them).
  const inbox = await unreadForBuyer(user);

  const where = {
    // Soft-deleted RFPs stay in the DB but never show up in normal
    // listings unless the status filter explicitly asks for them.
    status: statusFilter
      ? (statusFilter as RfpStatus)
      : { not: "DELETED" as RfpStatus },
    ...(isApprover
      ? { id: { in: assignedRfpIds } }
      : tab === "mine"
        ? participantWhere(user.id)
        : scope.where),
    ...(advancedWhere.length > 0 ? { AND: advancedWhere } : {}),
    ...(commodityFilter ? { commodity: commodityFilter } : {}),
    ...(regionFilter ? { region: regionFilter } : {}),
    ...(tab === "all" && creatorFilter
      ? { createdByUserId: creatorFilter }
      : {}),
    ...(tab === "all" && scope.isSuperAdmin && clientFilter
      ? { clientId: clientFilter }
      : {}),
  };

  await sweepAwaitingStart(scope.where);

  const [rfps, allCommodities, allRegions, creators, clients] = await Promise.all([
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

  // View groups limit which commodities / regions the filters offer.
  const commodities = filterTreeByGroups(allCommodities, user);
  const regions = filterTreeByGroups(allRegions, user);

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
    createdAt: rfp.createdAt.toISOString(),
    startsAt: (rfp.startDate ?? rfp.publishedAt)?.toISOString() ?? null,
    deadlineAt: rfp.deadlineAt.toISOString(),
    clientLabel: showClientColumn
      ? `${rfp.client.icon ? `${rfp.client.icon} ` : ""}${rfp.client.description}`
      : null,
  }));

  // Calendar of the RFPs in this list that close / start each day. Drafts are
  // left out (nothing is scheduled yet). An RFP with no start date starts the
  // day it was published.
  const calendarEvents = rfps
    .filter((rfp) => rfp.status !== "DRAFT")
    .map((rfp) => ({
      id: rfp.id,
      number: rfp.number,
      title: rfp.title,
      closesAt: rfp.deadlineAt.toISOString(),
      startsAt: (rfp.startDate ?? rfp.publishedAt)?.toISOString() ?? null,
    }));

  function tabHref(target: "mine" | "all") {
    const params = new URLSearchParams();
    if (commodityFilter) params.set("commodity", commodityFilter);
    if (regionFilter) params.set("region", regionFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (target === "all" && creatorFilter)
      params.set("creator", creatorFilter);
    if (target === "all" && clientFilter) params.set("client", clientFilter);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (tagFilter) params.set("tag", tagFilter);
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);
    if (startFrom) params.set("startFrom", startFrom);
    if (startTo) params.set("startTo", startTo);
    if (closeFrom) params.set("closeFrom", closeFrom);
    if (closeTo) params.set("closeTo", closeTo);
    for (const f of customFilterValues) params.set(`cf_${f.key}`, f.value);
    params.set("tab", target);
    return `/?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isApprover ? dictionary.home.titleApprover : dictionary.home.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isApprover
              ? dictionary.home.subtitleApprover
              : dictionary.home.subtitle}
          </p>
        </div>
        {!isApprover && (
          <Link
            href="/rfps/new"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            {dictionary.home.newRfp}
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
              {dictionary.home.myRfps}
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
                {dictionary.home.allRfps}
              </Link>
            )}
          </nav>
        </div>
      )}

      {inbox.length > 0 && (
        <CollapsibleSection
          title={
            <>
              {dictionary.rfpMessages.inboxTitle}
              <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                {inbox.reduce((sum, r) => sum + r.unread, 0)}
              </span>
            </>
          }
          subtitle={dictionary.rfpMessages.inboxHint}
          storageKey="rfp-list-messages"
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="py-2 pr-4">{dictionary.rfpMessages.colRfp}</th>
                  <th className="py-2 pr-4">{dictionary.rfpMessages.colTitle}</th>
                  <th className="py-2 pr-4">{dictionary.rfpMessages.colDate}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inbox.map((r) => (
                  <tr key={r.rfpId}>
                    <td className="whitespace-nowrap py-2.5 pr-4 font-medium text-slate-800">{formatRfpNumber(r.number)}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{r.title}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">
                      {formatDateTime(r.lastAt, { locale: localeForLanguage(user.language), timeZone: user.timezone })}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={`/rfps/${r.rfpId}#mensajes`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        {dictionary.rfpMessages.viewMessages}
                        <span className="rounded-full bg-white/25 px-1.5">{r.unread}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      <div className="mb-6">
        <RfpFilters
          tags={await loadRfpTags(scope.where)}
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
          customFields={customFilterFields}
        />
      </div>

      {calendarEvents.length > 0 && (
        <CollapsibleSection
          title={dictionary.rfpCalendar.title}
          storageKey="home-calendar"
          className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <RfpCalendar events={calendarEvents} />
        </CollapsibleSection>
      )}

      {rfps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">
            {isApprover
              ? dictionary.home.emptyApprover
              : dictionary.home.emptyDefault}
          </p>
          {!isApprover && (
            <Link
              href="/rfps/new"
              className="mt-4 inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              {dictionary.home.createFirst}
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
