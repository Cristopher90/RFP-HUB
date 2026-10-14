import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime } from "@/lib/format";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { canSeeByGroups, viewGroupWhere } from "@/lib/viewGroups";
import { docStatus, todayUtc } from "@/lib/supplierDocs";
import { formatDate } from "@/lib/format";
import { loadRatingSummaries } from "@/lib/suppliers";
import { canBlockSuppliers, canManageSupplierDocs, canRateSuppliers, canReviewRatings } from "@/lib/supplierAccess";
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

  const [rows, ratings, groups, allDocTypes, docIndex] = await Promise.all([
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
  ]);
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
    const [links, allRatings, rfps, rawDocs] = await Promise.all([
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
          ...(reviewer ? {} : { createdByUserId: user.id }),
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
    ]);
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
        canCreate={true}
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
