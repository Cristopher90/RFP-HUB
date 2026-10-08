import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { BUYER_ROLES } from "@/lib/requestFields";
import { BuyerGroupsForm } from "./BuyerGroupsForm";

export default async function BuyerGroupsPage({
  searchParams,
}: PageProps<"/admin/buyer-groups">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const [groups, buyers] = effectiveClientId
    ? await Promise.all([
        prisma.buyerGroup.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { name: "asc" },
          include: { members: true },
        }),
        prisma.user.findMany({
          where: { clientId: effectiveClientId, role: { in: [...BUYER_ROLES] } },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {dictionary.buyerGroupsPage.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.buyerGroupsPage.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{dictionary.buyerGroupsPage.subtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <BuyerGroupsForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            buyers={buyers.map((u) => ({
              id: u.id,
              name: u.name,
              lastName: u.lastName ?? "",
              email: u.email,
            }))}
            initial={groups.map((g) => ({
              id: g.id,
              name: g.name,
              memberIds: g.members.map((m) => m.userId),
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{dictionary.buyerGroupsPage.selectClient}</p>
      )}
    </div>
  );
}
