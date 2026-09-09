import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import { prisma } from "@/lib/prisma";
import { SYSTEM_TABLES } from "@/lib/systemTables";

export default async function SystemTablesPage() {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");

  const counts = await Promise.all(
    SYSTEM_TABLES.map(async (t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (prisma as any)[t.model];
      const count: number = await delegate.count();
      return { ...t, count };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Tablas del sistema
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Vista de solo lectura de cada tabla de la base de datos, sin
        distinción de cliente. Solo el Super Administrador la ve.
      </p>
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Tabla</th>
              <th className="px-5 py-3">Filas</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {counts.map((t) => (
              <tr key={t.key} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  {t.label}
                </td>
                <td className="px-5 py-3 text-slate-600">{t.count}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/system-tables/${t.key}`}
                    className="text-sm font-medium text-violet-600 hover:text-violet-700"
                  >
                    Ver &rarr;
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
