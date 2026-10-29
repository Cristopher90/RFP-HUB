import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { TemplatesTable } from "./TemplatesTable";

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
        <TemplatesTable
          rows={templates.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            clientId: t.clientId,
            clientLabel: `${t.client.icon ? `${t.client.icon} ` : ""}${t.client.description}`,
            matchKind: t.matchKind,
            matchCommodity: t.matchCommodity,
            matchRegion: t.matchRegion,
            items: t.items.length,
            questions: t.questions.length,
            active: t.active,
          }))}
        />
      )}
    </div>
  );
}
