import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";

export default async function TemplatesPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);

  const templates = await prisma.rfpTemplate.findMany({
    where: scope.where,
    orderBy: { createdAt: "desc" },
    include: { items: true, questions: true, client: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; {dictionary.adminDashboard.backToConfig}
      </Link>
      <div className="mt-1 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.adminDashboard.templatesTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{dictionary.adminDashboard.templatesSubtitle}</p>
        </div>
        <Link
          href="/admin/templates/new"
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          {dictionary.adminDashboard.newTemplate}
        </Link>
      </div>
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {dictionary.adminDashboard.noTemplatesConfigured}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{dictionary.adminDashboard.templateHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.clientHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.conditionHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.itemsHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.questionsHeader}</th>
                <th className="px-5 py-3">{dictionary.adminDashboard.statusHeader}</th>
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
                            {dictionary.adminDashboard.commodityPrefix} {t.matchCommodity}
                          </span>
                        )}
                        {t.matchRegion && (
                          <span>{dictionary.adminDashboard.regionPrefix} {t.matchRegion}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">{dictionary.adminDashboard.anyRfp}</span>
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
                      {t.active ? dictionary.adminDashboard.active : dictionary.adminDashboard.inactive}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      {dictionary.adminDashboard.edit}
                    </Link>
                    <Link
                      href={`/admin/templates/new?copyFrom=${t.id}&clientId=${t.clientId}`}
                      className="ml-4 text-sm font-medium text-slate-500 hover:text-slate-700"
                    >
                      {dictionary.adminDashboard.copyTemplate}
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
