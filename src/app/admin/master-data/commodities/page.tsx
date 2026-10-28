import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { MasterDataForm } from "../MasterDataForm";
import { getDictionary } from "@/i18n/getDictionary";
import { loadViewGroups } from "@/lib/viewGroupsServer";

export default async function CommoditiesPage({
  searchParams,
}: PageProps<"/admin/master-data/commodities">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const commodities = effectiveClientId
    ? await prisma.commodity.findMany({
        where: { clientId: effectiveClientId },
        orderBy: { code: "asc" },
      })
    : [];

  const viewGroups = effectiveClientId ? await loadViewGroups(effectiveClientId) : [];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.masterDataScreen.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.masterDataScreen.titlePrefix} &middot; {dictionary.masterDataKind.commodity}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.masterDataScreen.commoditiesSubtitle}
      </p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <MasterDataForm
            key={effectiveClientId}
            kind="commodity"
            label={dictionary.masterDataKind.commodity}
            targetClientId={effectiveClientId}
            isSuperAdmin={scope.isSuperAdmin}
            viewGroups={viewGroups.map((g) => ({ id: g.id, name: g.name }))}
            initial={commodities.map((c) => ({
              clientKey: c.id,
              code: c.code,
              description: c.description,
              parentClientKey: c.parentId,
              selectable: c.selectable,
              viewGroupIds: c.viewGroupIds,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          {dictionary.masterDataScreen.selectClientPrefix} {dictionary.masterDataKind.commodity.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
