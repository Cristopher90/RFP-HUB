import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { loadCustomFields, readCustomValues } from "@/lib/customFields";
import { displayValue, labelFor } from "@/lib/customFieldsShared";
import { zonedTimeToUtc } from "@/lib/timezone";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { canGenerateRfp, requireRequestsScope, visibilityWhere } from "@/lib/requestAccess";
import { deriveRequestStatus, isRequestStatus, statusWhere } from "@/lib/requestStatus";
import { BUYER_ROLES, type HeaderMapping, type ImportMode, type LinesMapping } from "@/lib/requestFields";
import { RequestFilters } from "./RequestFilters";
import { RequestsTable, type RequestRow } from "./RequestsTable";
import { ImportRequestsDialog } from "./ImportRequestsDialog";
import { usesBento } from "@/lib/themes";
import { BentoGrid, Metric, Tile } from "@/components/bento/Bento";

const PAGE_SIZE = 25;

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const sp = await searchParams;
  const { user, clients, effectiveClientId, groupIds, canImport, canAssign, scope } =
    await requireRequestsScope(sp);
  const dictionary = getDictionary(user.language);
  const d = dictionary.requestsPage;
  const locale = localeForLanguage(user.language);

  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const q = param("q").trim();
  const type = param("type");
  const creator = param("creator");
  const commodity = param("commodity");
  const assigned = param("assigned");
  const status = param("status");
  const importedFrom = param("importedFrom");
  const importedTo = param("importedTo");
  const requestFrom = param("requestFrom");
  const requestTo = param("requestTo");
  const page = Math.max(1, Number(param("page")) || 1);

  const header = (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
    </>
  );

  if (!effectiveClientId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        {header}
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      </div>
    );
  }

  const and: Record<string, unknown>[] = [visibilityWhere(user, groupIds)];
  if (q) and.push({ documentNumber: { contains: q, mode: "insensitive" } });
  if (type) and.push({ documentType: type });
  if (creator) and.push({ creator });
  if (commodity) and.push({ commodity });
  if (assigned === "none") and.push({ assignedUserId: null, assignedGroupId: null });
  else if (assigned.startsWith("u:")) and.push({ assignedUserId: assigned.slice(2) });
  else if (assigned.startsWith("g:")) and.push({ assignedGroupId: assigned.slice(2) });
  if (isRequestStatus(status)) and.push(statusWhere(status));
  const importedRange: Record<string, Date> = {};
  if (importedFrom) importedRange.gte = zonedTimeToUtc(`${importedFrom}T00:00`, user.timezone);
  if (importedTo) importedRange.lte = zonedTimeToUtc(`${importedTo}T23:59:59`, user.timezone);
  if (Object.keys(importedRange).length) and.push({ importedAt: importedRange });
  const requestRange: Record<string, Date> = {};
  if (requestFrom) requestRange.gte = new Date(`${requestFrom}T00:00:00.000Z`);
  if (requestTo) requestRange.lte = new Date(`${requestTo}T00:00:00.000Z`);
  if (Object.keys(requestRange).length) and.push({ requestDate: requestRange });

  const where = { clientId: effectiveClientId, AND: and } as Prisma.PurchaseRequestWhereInput;
  const visibleScope = {
    clientId: effectiveClientId,
    ...visibilityWhere(user, groupIds),
  } as Prisma.PurchaseRequestWhereInput;

  const [total, requests, types, creators, commodities, buyers, groups, templates, clientRow] =
    await Promise.all([
      prisma.purchaseRequest.count({ where }),
      prisma.purchaseRequest.findMany({
        where,
        orderBy: [{ importedAt: "desc" }, { documentNumber: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          rfp: { select: { id: true, status: true, awardedInvitationId: true } },
          assignedUser: { select: { name: true, lastName: true } },
          assignedGroup: { select: { name: true } },
          lines: { orderBy: { order: "asc" } },
        },
      }),
      prisma.purchaseRequest.findMany({
        where: visibleScope,
        distinct: ["documentType"],
        select: { documentType: true },
        orderBy: { documentType: "asc" },
      }),
      prisma.purchaseRequest.findMany({
        where: { ...visibleScope, creator: { not: null } },
        distinct: ["creator"],
        select: { creator: true },
        orderBy: { creator: "asc" },
      }),
      prisma.purchaseRequest.findMany({
        where: { ...visibleScope, commodity: { not: null } },
        distinct: ["commodity"],
        select: { commodity: true },
        orderBy: { commodity: "asc" },
      }),
      prisma.user.findMany({
        where: { clientId: effectiveClientId, role: { in: [...BUYER_ROLES] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, lastName: true },
      }),
      prisma.buyerGroup.findMany({
        where: { clientId: effectiveClientId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      canImport
        ? prisma.requestImportTemplate.findMany({
            where: { clientId: effectiveClientId },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      prisma.client.findUnique({
        where: { id: effectiveClientId },
        select: { currency: true },
      }),
    ]);

  // Request custom fields (header / lines) and the values stored for this page.
  const requestCustomFields = (await loadCustomFields(effectiveClientId, undefined, false)).filter(
    (f) => f.visible && (f.scope === "REQUEST_HEAD" || f.scope === "REQUEST_LINE"),
  );
  const headCustomFields = requestCustomFields.filter((f) => f.scope === "REQUEST_HEAD");
  const lineCustomFields = requestCustomFields.filter((f) => f.scope === "REQUEST_LINE");
  const [headerValues, lineValues] =
    requestCustomFields.length > 0
      ? await Promise.all([
          readCustomValues(effectiveClientId, "REQUEST", requests.map((r) => r.id)),
          readCustomValues(
            effectiveClientId,
            "REQUEST_LINE",
            requests.flatMap((r) => r.lines.map((l) => l.id)),
          ),
        ])
      : [new Map<string, Record<string, string>>(), new Map<string, Record<string, string>>()];
  const currency = clientRow?.currency ?? "USD";
  const show = (field: (typeof requestCustomFields)[number], raw: string | undefined) =>
    raw === undefined
      ? ""
      : displayValue(
          field,
          raw,
          user.language,
          (n) => formatCurrency(n, { locale, currency }),
          dictionary.customFields.yes,
          dictionary.customFields.no,
        );

  // Bento: counts per status of the requests this user can see.
  const bentoCounts = usesBento(user)
    ? await Promise.all(
        (["NEW", "PROCESSED", "IN_NEGOTIATION", "NEGOTIATED"] as const).map((st) =>
          prisma.purchaseRequest.count({
            where: { ...visibleScope, ...(statusWhere(st) as Prisma.PurchaseRequestWhereInput) },
          }),
        ),
      )
    : null;

  const dateTime = { locale, timeZone: user.timezone };
  const rows: RequestRow[] = requests.map((r) => {
    const rowStatus = deriveRequestStatus(r);
    return {
      id: r.id,
      documentNumber: r.documentNumber,
      documentType: r.documentType,
      creator: r.creator ?? "",
      buyerKey: r.assignedUserId ? `u:${r.assignedUserId}` : r.assignedGroupId ? `g:${r.assignedGroupId}` : "",
      buyerLabel: r.assignedUser
        ? `${r.assignedUser.name} ${r.assignedUser.lastName ?? ""}`.trim()
        : (r.assignedGroup?.name ?? ""),
      status: rowStatus,
      importedAt: formatDateTime(r.importedAt, dateTime),
      // Date-only values are stored at UTC midnight: format in UTC so the day never shifts.
      requestDate: r.requestDate ? formatDate(r.requestDate, { locale, timeZone: "UTC" }) : "",
      commodity: r.commodity ?? "",
      rfpId: r.rfp && r.rfp.status !== "DELETED" ? r.rfp.id : null,
      canGenerate: rowStatus === "NEW" && canGenerateRfp(r, user.id, groupIds),
      customHeader: headCustomFields
        .map((f) => ({
          key: f.key,
          label: labelFor(f.labels, user.language, f.key),
          value: show(f, headerValues.get(r.id)?.[f.key]),
        }))
        .filter((x) => x.value !== ""),
      lines: r.lines.map((l) => ({
        id: l.id,
        position: l.position,
        itemCode: l.itemCode ?? "",
        description: l.description,
        historicalPrice: l.historicalPrice,
        quantity: l.quantity,
        unit: l.unit ?? "",
        commodity: l.commodity ?? "",
        custom: Object.fromEntries(
          lineCustomFields.map((f) => [f.key, show(f, lineValues.get(l.id)?.[f.key])]),
        ),
      })),
    };
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string" && key !== "page") params.set(key, value);
    }
    params.set("page", String(target));
    return `/requests?${params.toString()}`;
  };
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const linkClass =
    "rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50";
  const disabledClass = "rounded-md border border-slate-200 px-2 py-1 text-slate-300";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {header}
      {bentoCounts && (
        <BentoGrid className="mt-6">
          <Tile tone="dark">
            <Metric
              label={dictionary.bento.requestsNew}
              value={bentoCounts[0]}
              size="lg"
              sub={`${bentoCounts.reduce((a, b) => a + b, 0)} ${dictionary.bento.requestsTotal.toLowerCase()}`}
            />
          </Tile>
          <Tile tone="lime">
            <Metric label={dictionary.bento.requestsOpen} value={bentoCounts[1] + bentoCounts[2]} size="lg" />
          </Tile>
          <Tile tone="lilac">
            <Metric label={dictionary.bento.requestsDone} value={bentoCounts[3]} size="lg" />
          </Tile>
        </BentoGrid>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ImportRequestsDialog
          canImport={canImport}
          targetClientId={effectiveClientId}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            importMode: t.importMode as ImportMode,
            headerSheet: t.headerSheet,
            linesSheet: t.linesSheet,
            headerMapping: t.headerMapping as HeaderMapping,
            linesMapping: t.linesMapping as LinesMapping,
          }))}
        />
      </div>

      <div className="mt-4">
        <RequestFilters
          types={types.map((x) => x.documentType)}
          creators={creators.map((x) => x.creator as string)}
          commodities={commodities.map((x) => x.commodity as string)}
          buyers={buyers.map((u) => ({ id: u.id, name: `${u.name} ${u.lastName ?? ""}`.trim() }))}
          groups={groups}
        />
      </div>

      <RequestsTable
        rows={rows}
        currency={currency}
        lineCustomColumns={lineCustomFields.map((f) => ({
          key: f.key,
          label: labelFor(f.labels, user.language, f.key),
        }))}
        canAssign={canAssign}
        buyers={buyers.map((u) => ({ id: u.id, name: `${u.name} ${u.lastName ?? ""}`.trim() }))}
        groups={groups}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {d.showing
            .replace("{from}", String(from))
            .replace("{to}", String(to))
            .replace("{total}", String(total))}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={linkClass}>
              {d.previous}
            </Link>
          ) : (
            <span className={disabledClass}>{d.previous}</span>
          )}
          <span className="px-1">
            {d.page.replace("{page}", String(page)).replace("{pages}", String(pages))}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={linkClass}>
              {d.next}
            </Link>
          ) : (
            <span className={disabledClass}>{d.next}</span>
          )}
        </div>
      </div>
    </div>
  );
}
