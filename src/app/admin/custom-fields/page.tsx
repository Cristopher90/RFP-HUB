import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { loadCustomFields, partitionName } from "@/lib/customFields";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { CustomFieldsManager } from "./CustomFieldsManager";

export default async function CustomFieldsPage({ searchParams }: PageProps<"/admin/custom-fields">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  if (!scope.isSuperAdmin) redirect("/admin");
  const d = getDictionary(scope.user.language).customFields;

  const client = effectiveClientId
    ? await prisma.client.findUnique({ where: { id: effectiveClientId } })
    : null;
  const fields = client ? await loadCustomFields(client.id, undefined, false) : [];

  const [lookupRows, viewGroups] = client
    ? await Promise.all([
        prisma.lookup.findMany({
          where: { clientId: client.id },
          orderBy: { name: "asc" },
          include: { _count: { select: { values: true } } },
        }),
        loadViewGroups(client.id),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      <div className="mt-6">
        <AdminClientSwitcher clients={clients} />
      </div>
      {client ? (
        <CustomFieldsManager
          key={client.id}
          client={{ id: client.id, code: client.code, description: client.description }}
          fields={fields}
          tableName={partitionName(client.id)}
          lookups={lookupRows.map((l) => ({ id: l.id, name: l.name, count: l._count.values }))}
          viewGroups={viewGroups.map((g) => ({ id: g.id, name: g.name }))}
        />
      ) : (
        <p className="mt-2 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
