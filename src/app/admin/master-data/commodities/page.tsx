import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { MasterDataForm } from "../MasterDataForm";

export default async function CommoditiesPage({
  searchParams,
}: PageProps<"/admin/master-data/commodities">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

  const commodities = effectiveClientId
    ? await prisma.commodity.findMany({
        where: { clientId: effectiveClientId },
        orderBy: { code: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Commodities
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Estos valores alimentan el desplegable de Commodity al crear una RFP
        o una plantilla.
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
            label="Commodities"
            targetClientId={effectiveClientId}
            initial={commodities.map((c) => ({
              clientKey: c.id,
              code: c.code,
              description: c.description,
              parentClientKey: c.parentId,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          Selecciona un cliente para ver y editar sus commodities.
        </p>
      )}
    </div>
  );
}
