import { participantWhere } from "@/lib/rfpAccess";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime } from "@/lib/format";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { canSeeByGroups, filterTreeByGroups, viewGroupWhere } from "@/lib/viewGroups";
import { loadCustomFields, readCustomValues } from "@/lib/customFields";
import { applyViewGroupsToFields, displayValue, labelFor } from "@/lib/customFieldsShared";
import { docStatus, todayUtc } from "@/lib/supplierDocs";
import { formatCurrency, formatDate } from "@/lib/format";
import { loadRatingSummaries } from "@/lib/suppliers";
import {
  canAddSupplierContacts,
  canBlockSuppliers,
  canCreateSuppliers,
  canEditSuppliers,
  canManageSupplierDocs,
  canRateSuppliers,
  canReviewRatings,
} from "@/lib/supplierAccess";
import { clientAi } from "@/lib/supplierResearch";
import { SuppliersView, type SupplierDetail, type SupplierListItem } from "./SuppliersView";

export default async function SuppliersPage({ searchParams }: PageProps<"/suppliers">) {
  const sp = await searchParams;
  const scope = await requireClientScope();
  const { user } = scope;
  if (user.role === "APPROVER") redirect("/");
  const dictionary = getDictionary(user.language);
  const d = dictionary.suppliersScreen;
  const locale = localeForLanguage(user.language);

  const clients = scope.isSuperAdmin
    ? await prisma.client.findMany({ orderBy: { description: "asc" } })
    : [];
  const clientId = scope.isSuperAdmin
    ? typeof sp.clientId === "string" && sp.clientId
      ? sp.clientId
      : undefined
    : (user.clientId ?? undefined);

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
  if (!clientId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        {header}
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      </div>
    );
  }

  const [rows, ratings, groups, allDocTypes, docIndex, ai, allCommodities, allRegions, rawCustomFields, clientRow] = await Promise.all([
    prisma.supplierDirectory.findMany({
      where: { clientId, ...viewGroupWhere(user) },
      include: {
        userLinks: { select: { status: true, blocked: true } },
      },
      orderBy: { companyName: "asc" },
    }),
    loadRatingSummaries(clientId),
    prisma.viewGroup.findMany({ where: { clientId } }),
    prisma.supplierDocumentType.findMany({ where: { clientId }, orderBy: { name: "asc" } }),
    prisma.supplierDocument.findMany({
      where: { clientId },
      select: { supplierDirectoryId: true, typeId: true, startDate: true, endDate: true },
    }),
    clientAi(clientId),
    prisma.commodity.findMany({ where: { clientId }, orderBy: { description: "asc" } }),
    prisma.region.findMany({ where: { clientId }, orderBy: { description: "asc" } }),
    loadCustomFields(clientId, "SUPPLIER"),
    prisma.client.findUnique({ where: { id: clientId }, select: { currency: true } }),
  ]);
  const commodities = filterTreeByGroups(allCommodities, user);
  const regions = filterTreeByGroups(allRegions, user);
  // Supplier custom fields as this user may see them (view groups).
  const customFields = applyViewGroupsToFields(rawCustomFields, user);
  const currency = clientRow?.currency ?? "USD";
  // Document types this user may see (view groups) and each supplier's documents by status.
  const visibleTypes = allDocTypes.filter((t) => canSeeByGroups(user, t.viewGroupIds));
  const typeById = new Map(visibleTypes.map((t) => [t.id, t]));
  const today = todayUtc();
  const docsBySupplier = new Map<string, { typeId: string; status: "active" | "expired" | "upcoming" }[]>();
  for (const dd of docIndex) {
    const type = typeById.get(dd.typeId);
    if (!type) continue;
    const list = docsBySupplier.get(dd.supplierDirectoryId) ?? [];
    list.push({ typeId: dd.typeId, status: docStatus(dd, type.hasDates, today) });
    docsBySupplier.set(dd.supplierDirectoryId, list);
  }
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const list: SupplierListItem[] = rows.map((s) => {
    const rating = ratings.get(s.id);
    return {
      id: s.id,
      code: s.code,
      companyName: s.companyName,
      taxId: s.taxId,
      blocked: s.blocked,
      initialBlock: s.blocked && s.initialBlock,
      inactive: s.status === "INACTIVE",
      contactCount: s.userLinks.filter((l) => l.status === "ACCEPTED").length,
      ratingAvg: rating?.avg ?? null,
      ratingCount: rating?.count ?? 0,
      docs: docsBySupplier.get(s.id) ?? [],
      searchText: `${s.code} ${s.taxId} ${s.companyName} ${s.contactFirstName} ${s.contactLastName} ${s.email}`.toLowerCase(),
    };
  });

  const selectedId = typeof sp.id === "string" ? sp.id : "";
  let detail: SupplierDetail | null = null;
  const selected = rows.find((s) => s.id === selectedId);
  if (selected) {
    const reviewer = canReviewRatings(user);
    const [links, allRatings, rfps, rawDocs, customValueMap, supplierEvents] = await Promise.all([
      prisma.supplierUserLink.findMany({
        where: { supplierDirectoryId: selected.id },
        include: { supplierUser: true },
        orderBy: { invitedAt: "asc" },
      }),
      prisma.supplierRating.findMany({
        where: { supplierDirectoryId: selected.id },
        include: { user: { select: { id: true, name: true, lastName: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.rfp.findMany({
        where: {
          clientId,
          status: { not: "DELETED" },
          // "My processes": the ones I created; administrators see the client's all.
          ...(reviewer ? {} : participantWhere(user.id)),
          invitations: { some: { supplier: { supplierDirectoryId: selected.id } } },
        },
        include: {
          invitations: {
            where: { supplier: { supplierDirectoryId: selected.id } },
            include: { response: { select: { id: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Never select the file bytes here: they are only served by the download route.
      prisma.supplierDocument.findMany({
        where: { supplierDirectoryId: selected.id },
        select: {
          id: true,
          typeId: true,
          startDate: true,
          endDate: true,
          note: true,
          fileName: true,
          size: true,
          uploadedAt: true,
          uploadedBy: { select: { name: true, lastName: true } },
        },
        orderBy: { uploadedAt: "desc" },
      }),
      readCustomValues(clientId, "SUPPLIER", [selected.id]),
      prisma.supplierEvent.findMany({
        where: { supplierDirectoryId: selected.id },
        include: { user: { select: { name: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const customValues = customValueMap.get(selected.id) ?? {};
    const sh = dictionary.supplierHistory;
    const fullName = (u: { name: string; lastName: string | null } | null | undefined) =>
      u ? `${u.name} ${u.lastName ?? ""}`.trim() : undefined;
    // Milestones derived from other tables plus the changes recorded as they happened.
    const historyItems: { date: Date; label: string; detail?: string }[] = [
      { date: selected.createdAt, label: sh.creation },
    ];
    for (const doc of rawDocs) {
      const type = typeById.get(doc.typeId);
      if (!type) continue;
      historyItems.push({
        date: doc.uploadedAt,
        label: sh.documentUploaded.replace("{type}", type.name).replace("{file}", doc.fileName),
        detail: fullName(doc.uploadedBy),
      });
    }
    for (const l of links) {
      historyItems.push({
        date: l.invitedAt,
        label: sh.contactAdded.replace("{name}", `${l.supplierUser.name} ${l.supplierUser.lastName}`.trim() || l.supplierUser.email),
      });
    }
    for (const e of supplierEvents) {
      const dd = (e.detail ?? {}) as Record<string, unknown>;
      let label: string;
      switch (e.kind) {
        case "INITIAL_BLOCK":
          label = sh.initialBlock;
          break;
        case "BLOCKED":
          label = sh.blocked;
          break;
        case "UNBLOCKED":
          label = dd.wasInitial ? sh.unblockedInitial : sh.unblocked;
          break;
        case "DOCUMENT_DELETED":
          label = sh.documentDeleted.replace("{type}", String(dd.type ?? "")).replace("{file}", String(dd.fileName ?? ""));
          break;
        case "CONTACT_BLOCKED":
          label = sh.contactBlocked.replace("{name}", String(dd.name ?? ""));
          break;
        case "CONTACT_UNBLOCKED":
          label = sh.contactUnblocked.replace("{name}", String(dd.name ?? ""));
          break;
        case "EDITED": {
          const fields = ((Array.isArray(dd.fields) ? dd.fields : []) as string[]).map(
            (f) => (sh.fields as Record<string, string>)[f] ?? f,
          );
          const custom = (Array.isArray(dd.custom) ? dd.custom : []) as string[];
          label = sh.edited.replace("{changes}", [...fields, ...custom].join(", "));
          break;
        }
        default:
          continue;
      }
      historyItems.push({ date: e.createdAt, label, detail: fullName(e.user) });
    }
    historyItems.sort((a, b) => a.date.getTime() - b.date.getTime());
    const mine = allRatings.find((r) => r.userId === user.id);
    const summary = ratings.get(selected.id);
    detail = {
      id: selected.id,
      code: selected.code,
      companyName: selected.companyName,
      taxId: selected.taxId,
      phone: selected.phone,
      email: selected.email,
      contactName: `${selected.contactFirstName} ${selected.contactLastName}`.trim(),
      initialBlock: selected.blocked && selected.initialBlock,
      commodity: selected.commodity ?? "",
      region: selected.region ?? "",
      customValues,
      customDisplay: customFields
        .filter((f) => f.visible)
        .map((f) => ({
          label: labelFor(f.labels, user.language, f.key),
          value: displayValue(
            f,
            customValues[f.key],
            user.language,
            (n) => formatCurrency(n, { locale, currency }),
            dictionary.customFields.yes,
            dictionary.customFields.no,
          ),
        })),
      history: historyItems.map((h) => ({
        date: formatDateTime(h.date, { locale, timeZone: user.timezone }),
        label: h.label,
        detail: h.detail,
      })),
      contactFirstName: selected.contactFirstName,
      contactLastName: selected.contactLastName,
      groupIds: selected.viewGroupIds,
      status: selected.status,
      ai: selected.aiSummary
        ? {
            summary: selected.aiSummary,
            at: selected.aiSummaryAt ? formatDateTime(selected.aiSummaryAt, { locale, timeZone: user.timezone }) : "",
            model: selected.aiSummaryModel ?? "",
            stale: selected.aiSummaryKey !== `${selected.companyName}|${selected.taxId}`,
            sources: Array.isArray(selected.aiSummarySources)
              ? (selected.aiSummarySources as { title?: string; url?: string }[])
                  .filter((s) => typeof s?.url === "string")
                  .map((s) => ({ title: s.title || s.url!, url: s.url! }))
              : [],
          }
        : null,
      blocked: selected.blocked,
      inactive: selected.status === "INACTIVE",
      groups: selected.viewGroupIds.map((g) => groupName.get(g)).filter((n): n is string => Boolean(n)),
      rating: summary ?? null,
      myRating: mine ? { stars: mine.stars, comment: mine.comment ?? "" } : null,
      comments: reviewer
        ? allRatings.map((r) => ({
            id: r.id,
            author: `${r.user.name} ${r.user.lastName ?? ""}`.trim(),
            stars: r.stars,
            comment: r.comment ?? "",
            date: formatDateTime(r.updatedAt, { locale, timeZone: user.timezone }),
            mine: r.userId === user.id,
          }))
        : [],
      contacts: links.map((l) => ({
        linkId: l.id,
        name: `${l.supplierUser.name} ${l.supplierUser.lastName}`.trim(),
        email: l.supplierUser.email,
        status: l.status,
        isAdmin: l.isAdmin,
        blocked: l.blocked,
      })),
      documents: rawDocs
        .filter((doc) => typeById.has(doc.typeId))
        .map((doc) => {
          const type = typeById.get(doc.typeId)!;
          const range = { locale, timeZone: "UTC" };
          return {
            id: doc.id,
            typeName: type.name,
            hasDates: type.hasDates,
            status: docStatus(doc, type.hasDates, today),
            from: doc.startDate ? formatDate(doc.startDate, range) : "",
            to: doc.endDate ? formatDate(doc.endDate, range) : "",
            note: doc.note ?? "",
            fileName: doc.fileName,
            size: doc.size,
            uploadedBy: doc.uploadedBy ? `${doc.uploadedBy.name} ${doc.uploadedBy.lastName ?? ""}`.trim() : "",
            uploadedAt: formatDateTime(doc.uploadedAt, { locale, timeZone: user.timezone }),
          };
        }),
      processes: rfps.map((r) => ({
        rfpId: r.id,
        number: r.number,
        title: r.title,
        status: r.status,
        invited: r.invitations.length,
        responded: r.invitations.filter((i) => i.response).length,
      })),
    };
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {header}
      <SuppliersView
        list={list}
        detail={detail}
        selectedId={selected?.id ?? null}
        canRate={canRateSuppliers(user)}
        canBlock={canBlockSuppliers(user)}
        canManageDocs={canManageSupplierDocs(user)}
        commodities={commodities.map((c) => ({ id: c.id, parentId: c.parentId, code: c.code, description: c.description, selectable: c.selectable }))}
        regions={regions.map((r) => ({ id: r.id, parentId: r.parentId, code: r.code, description: r.description }))}
        customFields={customFields}
        currency={currency}
        canCreate={canCreateSuppliers(user)}
        canEdit={canEditSuppliers(user)}
        canAddContacts={canAddSupplierContacts(user)}
        aiAvailable={ai !== null}
        autoSummary={sp.summary === "1"}
        clientId={clientId}
        viewGroups={groups.map((g) => ({ id: g.id, name: g.name }))}
        docTypes={visibleTypes
          .filter((t) => t.active)
          .map((t) => ({ id: t.id, name: t.name, hasDates: t.hasDates }))}
        isReviewer={canReviewRatings(user)}
        language={user.language}
      />
    </div>
  );
}
