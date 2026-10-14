import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { TemplateForm } from "../TemplateForm";
import { templateInitial } from "../templateInitial";
import { getDictionary } from "@/i18n/getDictionary";
import { loadCustomFields } from "@/lib/customFields";
import { loadViewGroups } from "@/lib/viewGroupsServer";

export default async function NewTemplatePage({
  searchParams,
}: PageProps<"/admin/templates/new">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

  const [commodities, regions] = effectiveClientId
    ? await Promise.all([
        prisma.commodity.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { description: "asc" },
        }),
        prisma.region.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { description: "asc" },
        }),
      ])
    : [[], []];

  const customFilterFields = effectiveClientId
    ? (await loadCustomFields(effectiveClientId, "RFP_HEAD")).filter((f) => f.templateFilter)
    : [];

  const viewGroups = effectiveClientId ? await loadViewGroups(effectiveClientId) : [];
  const documentTypes = effectiveClientId
    ? await prisma.supplierDocumentType.findMany({ where: { clientId: effectiveClientId, active: true }, orderBy: { name: "asc" } })
    : [];
  const customHeaderFields = effectiveClientId ? await loadCustomFields(effectiveClientId, "RFP_HEAD") : [];

  // "Copiar" on the templates list: start from another template of the same client.
  const dictionary = getDictionary(scope.user.language);
  const copySource =
    effectiveClientId && typeof sp.copyFrom === "string"
      ? await prisma.rfpTemplate.findFirst({
          where: { id: sp.copyFrom, clientId: effectiveClientId },
          include: { items: { orderBy: { order: "asc" } }, questions: { orderBy: { order: "asc" } } },
        })
      : null;
  const copyInitial = copySource
    ? (() => {
        const base = templateInitial(copySource);
        return {
          ...base,
          name: `${base.name} ${dictionary.adminDashboard.copySuffix}`,
          // Brand-new rows: they must not point at the original's rows.
          items: base.items.map((i) => ({ ...i, id: undefined })),
          questions: base.questions.map((q) => ({ ...q, id: undefined })),
        };
      })()
    : undefined;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/templates" className="text-sm text-slate-500 hover:text-slate-700">
        &larr; {dictionary.adminDashboard.backToTemplates}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Nueva plantilla base
      </h1>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          {copySource && (
            <p className="mb-4 rounded-md bg-violet-50 px-4 py-3 text-sm text-violet-800">
              {dictionary.adminDashboard.copyingFrom.replace("{name}", copySource.name)}
            </p>
          )}
          <TemplateForm
            key={copySource?.id ?? "new"}
            initial={copyInitial}
            commodities={commodities}
            regions={regions}
            targetClientId={effectiveClientId}
            customFilterFields={customFilterFields}
            viewGroups={viewGroups.map((g) => ({ id: g.id, name: g.name }))}
            customHeaderFields={customHeaderFields}
            documentTypes={documentTypes.map((d) => ({ id: d.id, name: d.name }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          Selecciona un cliente para crear la plantilla.
        </p>
      )}
    </div>
  );
}
