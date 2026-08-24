import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ApprovalsPage() {
  await requireRole("ADMIN");

  const workflows = await prisma.approvalWorkflow.findMany({
    orderBy: { createdAt: "desc" },
    include: { templates: true, levels: true },
  });

  function stageSummary(count: number) {
    if (count === 0) return "No requerida";
    return `${count} nivel${count === 1 ? "" : "es"}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <div className="mt-1 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Procesos de aprobación
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Aprobación en 2 etapas (publicar y adjudicar), asignable a una o
            varias plantillas.
          </p>
        </div>
        <Link
          href="/admin/approvals/new"
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          + Nuevo proceso
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          Todavía no hay procesos de aprobación configurados.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Proceso</th>
                <th className="px-5 py-3">Publicar</th>
                <th className="px-5 py-3">Adjudicar</th>
                <th className="px-5 py-3">Plantillas</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workflows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/approvals/${w.id}`}
                      className="font-medium text-slate-900 hover:text-violet-600"
                    >
                      {w.name}
                    </Link>
                    {w.description && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {w.description}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {stageSummary(
                      w.levels.filter((l) => l.stage === "PUBLISH").length,
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {stageSummary(
                      w.levels.filter((l) => l.stage === "AWARD").length,
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {w.templates.length}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        w.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {w.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/approvals/${w.id}`}
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
      )}
    </div>
  );
}
