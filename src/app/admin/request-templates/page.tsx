import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";

export default async function RequestTemplatesPage({
  searchParams,
}: PageProps<"/admin/request-templates">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).requestTemplatesPage;
  const query = effectiveClientId ? `?clientId=${effectiveClientId}` : "";

  const templates = effectiveClientId
    ? await prisma.requestImportTemplate.findMany({
        where: { clientId: effectiveClientId },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <div className="mt-1 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
        {effectiveClientId && (
          <Link
            href={`/admin/request-templates/new${query}`}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
          >
            {d.newTemplate}
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{d.name}</th>
                <th className="px-5 py-3">{d.sheets}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                    {d.none}
                  </td>
                </tr>
              )}
              {templates.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{tpl.name}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {tpl.headerSheet} / {tpl.linesSheet}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/request-templates/${tpl.id}${query}`}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      {d.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
