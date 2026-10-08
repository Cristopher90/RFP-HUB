import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { getDictionary } from "@/i18n/getDictionary";
import { normalizeRfpMapping, type HeaderMapping, type LinesMapping } from "@/lib/requestFields";
import { RequestTemplateForm } from "../RequestTemplateForm";

export default async function EditRequestTemplatePage({
  params,
  searchParams,
}: PageProps<"/admin/request-templates/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { scope } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).requestTemplatesPage;

  const template = await prisma.requestImportTemplate.findUnique({ where: { id } });
  if (!template) notFound();
  if (!scope.isSuperAdmin && template.clientId !== scope.user.clientId) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/admin/request-templates?clientId=${template.clientId}`}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {d.backToList}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{template.name}</h1>
      <div className="mt-8">
        <RequestTemplateForm
          key={template.id}
          targetClientId={template.clientId}
          initial={{
            id: template.id,
            name: template.name,
            headerSheet: template.headerSheet,
            linesSheet: template.linesSheet,
            headerMapping: template.headerMapping as HeaderMapping,
            linesMapping: template.linesMapping as LinesMapping,
            rfpMapping: template.rfpMapping ? normalizeRfpMapping(template.rfpMapping) : null,
          }}
        />
      </div>
    </div>
  );
}
