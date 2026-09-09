import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { ItemCatalogForm } from "./ItemCatalogForm";

export default async function ItemCatalogPage({
  searchParams,
}: PageProps<"/admin/master-data/items">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

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
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Catálogo de artículos
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Artículos disponibles para seleccionar al crear una RFP, con su
        último precio adjudicado como referencia histórica.
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
          Selecciona un cliente para ver y editar su catálogo de artículos.
        </p>
      )}
    </div>
  );
}
