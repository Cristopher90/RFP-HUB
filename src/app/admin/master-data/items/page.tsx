import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { ItemCatalogForm } from "./ItemCatalogForm";
import { getDictionary } from "@/i18n/getDictionary";

export default async function ItemCatalogPage({
  searchParams,
}: PageProps<"/admin/master-data/items">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const [items, commodities] = effectiveClientId
    ? await Promise.all([
        prisma.itemCatalogEntry.findMany({
          where: { clientId: effectiveClientId },
          include: { catalogList: true },
          orderBy: [{ catalogList: { name: "asc" } }, { code: "asc" }],
        }),
        prisma.commodity.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { description: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.masterDataScreen.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.masterDataScreen.titlePrefix} &middot; {dictionary.itemCatalogPage.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.itemCatalogPage.subtitle}
      </p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <ItemCatalogForm
            key={effectiveClientId}
            commodities={commodities}
            targetClientId={effectiveClientId}
            isSuperAdmin={scope.isSuperAdmin}
            initial={items.map((i) => ({
              clientKey: i.id,
              catalogName: i.catalogList.name,
              code: i.code,
              name: i.name,
              description: i.description ?? "",
              unit: i.unit,
              commodity: i.commodity ?? "",
              lastPrice: i.lastPrice !== null ? String(i.lastPrice) : "",
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          {dictionary.itemCatalogPage.selectClient}
        </p>
      )}
    </div>
  );
}
