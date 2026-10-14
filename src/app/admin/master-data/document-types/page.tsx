import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { DocumentTypesForm } from "./DocumentTypesForm";

export default async function DocumentTypesPage({ searchParams }: PageProps<"/admin/master-data/document-types">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).supplierDocs;
  const [types, viewGroups] = effectiveClientId
    ? await Promise.all([
        prisma.supplierDocumentType.findMany({ where: { clientId: effectiveClientId }, orderBy: { name: "asc" } }),
        loadViewGroups(effectiveClientId),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.typesTitle}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.typesSubtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <DocumentTypesForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            viewGroups={viewGroups.map((g) => ({ id: g.id, name: g.name }))}
            initial={types.map((t) => ({
              id: t.id,
              name: t.name,
              hasDates: t.hasDates,
              viewGroupIds: t.viewGroupIds,
              active: t.active,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
