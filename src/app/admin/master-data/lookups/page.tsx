import { labelFor } from "@/lib/customFieldsShared";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { LookupsManager } from "./LookupsManager";

export default async function LookupsPage({ searchParams }: PageProps<"/admin/master-data/lookups">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).lookups;

  const lookups = effectiveClientId
    ? await prisma.lookup.findMany({
        where: { clientId: effectiveClientId },
        orderBy: { name: "asc" },
        include: { _count: { select: { values: true } }, fields: { select: { id: true, key: true, scope: true, labels: true } } },
      })
    : [];
  const selectedId =
    typeof sp.lookupId === "string" && lookups.some((l) => l.id === sp.lookupId) ? sp.lookupId : null;
  const [values, viewGroups] = effectiveClientId
    ? await Promise.all([
        selectedId
          ? prisma.lookupValue.findMany({
              where: { lookupId: selectedId },
              orderBy: [{ order: "asc" }, { code: "asc" }],
            })
          : Promise.resolve([]),
        loadViewGroups(effectiveClientId),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <LookupsManager
          key={`${effectiveClientId}-${selectedId ?? ""}`}
          clientId={effectiveClientId}
          lookups={lookups.map((l) => ({
            id: l.id,
            name: l.name,
            count: l._count.values,
            usedBy: l.fields.map((f) => f.key),
            usage: l.fields.map((f) => ({
              fieldId: f.id,
              key: f.key,
              scope: f.scope,
              label: labelFor((f.labels ?? {}) as Record<string, string>, scope.user.language, f.key),
            })),
          }))}
          selectedId={selectedId}
          canOpenFields={scope.isSuperAdmin}
          viewGroups={viewGroups.map((g) => ({ id: g.id, name: g.name }))}
          initialValues={values.map((v) => ({
            clientKey: v.id,
            code: v.code,
            description: v.description,
            descriptionEn: v.descriptionEn ?? "",
            parentClientKey: v.parentId,
            viewGroupIds: v.viewGroupIds,
          }))}
        />
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
