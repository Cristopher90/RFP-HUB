import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { localeForLanguage } from "@/i18n/locale";
import { formatDateTime } from "@/lib/format";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { viewGroupWhere } from "@/lib/viewGroups";
import { loadRatingSummaries } from "@/lib/suppliers";
import { canBlockSuppliers, canRateSuppliers, canReviewRatings } from "@/lib/supplierAccess";
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

  const [rows, ratings, groups] = await Promise.all([
    prisma.supplierDirectory.findMany({
      where: { clientId, ...viewGroupWhere(user) },
      include: {
        userLinks: { select: { status: true, blocked: true } },
      },
      orderBy: { companyName: "asc" },
    }),
    loadRatingSummaries(clientId),
    prisma.viewGroup.findMany({ where: { clientId } }),
  ]);
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
      searchText: `${s.code} ${s.taxId} ${s.companyName} ${s.contactFirstName} ${s.contactLastName} ${s.email}`.toLowerCase(),
    };
  });

  const selectedId = typeof sp.id === "string" ? sp.id : "";
  let detail: SupplierDetail | null = null;
  const selected = rows.find((s) => s.id === selectedId);
  if (selected) {
    const reviewer = canReviewRatings(user);
    const [links, allRatings, rfps] = await Promise.all([
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
        isReviewer={canReviewRatings(user)}
        language={user.language}
      />
    </div>
  );
}
