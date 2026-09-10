import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";

export default async function ApprovalsPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);

  const workflows = await prisma.approvalWorkflow.findMany({
    where: scope.where,
    orderBy: { createdAt: "desc" },
    include: { templates: true, levels: true },
  });

  function stageSummary(count: number) {
    if (count === 0) return dictionary.approvalsPage.notRequired;
    return `${count} ${count === 1 ? dictionary.approvalsPage.levelSingular : dictionary.approvalsPage.levelPlural}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.approvalsPage.backToSettings}
      </Link>
      <div className="mt-1 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dictionary.approvalsPage.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {dictionary.approvalsPage.subtitle}
          </p>
        </div>
        <Link
          href="/admin/approvals/new"
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          {dictionary.approvalsPage.newProcess}
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {dictionary.approvalsPage.noneConfigured}
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{dictionary.approvalsPage.process}</th>
                <th className="px-5 py-3">{dictionary.approvalsPage.publish}</th>
                <th className="px-5 py-3">{dictionary.approvalsPage.award}</th>
                <th className="px-5 py-3">{dictionary.approvalsPage.templates}</th>
                <th className="px-5 py-3">{dictionary.approvalsPage.status}</th>
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
                      {w.active ? dictionary.supplierDirectoryForm.active : dictionary.supplierDirectoryForm.inactive}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/approvals/${w.id}`}
                      className="text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      {dictionary.approvalsPage.edit}
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
