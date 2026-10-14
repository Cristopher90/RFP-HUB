import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { TemplateForm } from "../TemplateForm";
import { loadCustomFields } from "@/lib/customFields";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { deleteTemplate } from "../actions";
import { templateInitial } from "../templateInitial";

export default async function EditTemplatePage({
  params,
}: PageProps<"/admin/templates/[id]">) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const { id } = await params;

  const template = await prisma.rfpTemplate.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!template) notFound();
  if (!scope.isSuperAdmin && template.clientId !== scope.user.clientId) {
    notFound();
  }

  const [commodities, regions] = await Promise.all([
    prisma.commodity.findMany({
      where: { clientId: template.clientId },
      orderBy: { description: "asc" },
    }),
    prisma.region.findMany({
      where: { clientId: template.clientId },
      orderBy: { description: "asc" },
    }),
  ]);

  const customFilterFields = (await loadCustomFields(template.clientId, "RFP_HEAD")).filter(
    (f) => f.templateFilter,
  );

  const viewGroups = await loadViewGroups(template.clientId);
  const customHeaderFields = await loadCustomFields(template.clientId, "RFP_HEAD");
  const documentTypes = await prisma.supplierDocumentType.findMany({
    where: { clientId: template.clientId, active: true },
    orderBy: { name: "asc" },
  });

  const initial = templateInitial(template);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/templates"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            &larr; Plantillas
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Editar plantilla &middot; {template.name}
          </h1>
        </div>
        <form
          action={async () => {
            "use server";
            await deleteTemplate(template.id);
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar plantilla
          </button>
        </form>
      </div>
      <div className="mt-8">
        <TemplateForm
          templateId={template.id}
          initial={initial}
          commodities={commodities}
          regions={regions}
          customFilterFields={customFilterFields}
          viewGroups={viewGroups.map((g) => ({ id: g.id, name: g.name }))}
          customHeaderFields={customHeaderFields}
          documentTypes={documentTypes.map((d) => ({ id: d.id, name: d.name }))}
        />
      </div>
    </div>
  );
}
