import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { TemplateForm } from "../TemplateForm";

export default async function NewTemplatePage({
  searchParams,
}: PageProps<"/admin/templates/new">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

  const [commodities, regions] = effectiveClientId
    ? await Promise.all([
        prisma.commodity.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { description: "asc" },
        }),
        prisma.region.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { description: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Nueva plantilla base
      </h1>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <TemplateForm
            commodities={commodities}
            regions={regions}
            targetClientId={effectiveClientId}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          Selecciona un cliente para crear la plantilla.
        </p>
      )}
    </div>
  );
}
