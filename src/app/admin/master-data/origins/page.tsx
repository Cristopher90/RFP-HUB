import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { MasterDataForm } from "../MasterDataForm";

export default async function OriginsPage({
  searchParams,
}: PageProps<"/admin/master-data/origins">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

  const origins = effectiveClientId
    ? await prisma.origin.findMany({
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
        Datos maestros &middot; Orígenes
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Estos valores alimentan el desplegable de Origen en la cabecera de la
        RFP (campo opcional, no visible para el proveedor).
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
            kind="origin"
            label="Orígenes"
            targetClientId={effectiveClientId}
            initial={origins.map((o) => ({
              clientKey: o.id,
              code: o.code,
              description: o.description,
              parentClientKey: o.parentId,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          Selecciona un cliente para ver y editar sus orígenes.
        </p>
      )}
    </div>
  );
}
