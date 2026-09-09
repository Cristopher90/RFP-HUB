import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { MasterDataForm } from "../MasterDataForm";

export default async function ApprovalGroupsPage({
  searchParams,
}: PageProps<"/admin/master-data/approval-groups">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

  const groups = effectiveClientId
    ? await prisma.approvalGroup.findMany({
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
        Datos maestros &middot; Grupos de aprobación
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Estos grupos se asignan a usuarios y se usan en los procesos de
        aprobación por valor (modo &ldquo;Grupo&rdquo;).
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
            kind="approvalGroup"
            label="Grupos de aprobación"
            targetClientId={effectiveClientId}
            initial={groups.map((g) => ({
              clientKey: g.id,
              code: g.code,
              description: g.description,
              parentClientKey: g.parentId,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          Selecciona un cliente para ver y editar sus grupos de aprobación.
        </p>
      )}
    </div>
  );
}
