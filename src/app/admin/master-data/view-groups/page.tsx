import Link from "next/link";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { ViewGroupsForm } from "./ViewGroupsForm";

export default async function ViewGroupsPage({ searchParams }: PageProps<"/admin/master-data/view-groups">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).viewGroups;
  const groups = effectiveClientId ? await loadViewGroups(effectiveClientId) : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
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
        <div className="mt-8">
          <ViewGroupsForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            initial={groups.map((g) => ({ id: g.id, name: g.name, description: g.description ?? "" }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
