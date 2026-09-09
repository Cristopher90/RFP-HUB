import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { CollapsibleSection } from "@/components/CollapsibleSection";

export default async function AdminPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }

  const templates = await prisma.rfpTemplate.findMany({
    where: scope.where,
    orderBy: { createdAt: "desc" },
    include: { items: true, questions: true, client: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configuración &middot; Plantillas base de RFP
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define artículos y preguntas por defecto que se aplican
            automáticamente a las RFPs que coincidan con sus condiciones.
          </p>
        </div>
        <Link
          href="/admin/templates/new"
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          + Nueva plantilla
        </Link>
      </div>

      <CollapsibleSection
        title="Datos maestros"
        subtitle="Valores permitidos para los desplegables de Commodity y Región en las RFPs y plantillas, y el directorio de proveedores."
        storageKey="admin-hub-master-data"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/master-data/commodities"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Commodities
          </Link>
          <Link
            href="/admin/master-data/regions"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Regiones
          </Link>
          <Link
            href="/admin/master-data/suppliers"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Proveedores
          </Link>
          <Link
            href="/admin/master-data/origins"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Orígenes
          </Link>
          <Link
            href="/admin/master-data/approval-groups"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Grupos de aprobación
          </Link>
          <Link
            href="/admin/master-data/items"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Catálogo de artículos
          </Link>
          {scope.isSuperAdmin && (
            <Link
              href="/admin/master-data/clients"
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              Clientes
            </Link>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Procesos de aprobación"
        subtitle="Aprobación en 2 etapas (publicar y adjudicar), asignable a una o varias plantillas."
        storageKey="admin-hub-approvals"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/approvals"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Procesos de aprobación
          </Link>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Usuarios"
        subtitle="Cuentas de la organización y su grupo (Comprador, Comprador Senior, Administrador)."
        storageKey="admin-hub-users"
        className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Usuarios
          </Link>
        </div>
      </CollapsibleSection>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Todavía no hay plantillas configuradas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Plantilla</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Condición</th>
                <th className="px-5 py-3">Artículos</th>
                <th className="px-5 py-3">Preguntas</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="font-medium text-slate-900 hover:text-violet-600"
                    >
                      {t.name}
                    </Link>
                    {t.description && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.client.icon ? `${t.client.icon} ` : ""}
                    {t.client.description}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.matchCommodity || t.matchRegion ? (
                      <>
                        {t.matchCommodity && (
                          <span className="mr-2">
                            Commodity: {t.matchCommodity}
                          </span>
                        )}
                        {t.matchRegion && (
                          <span>Región: {t.matchRegion}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">Cualquier RFP</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.items.length}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {t.questions.length}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      Editar &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
