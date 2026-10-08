import Link from "next/link";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { RequestTemplateForm } from "../RequestTemplateForm";

export default async function NewRequestTemplatePage({
  searchParams,
}: PageProps<"/admin/request-templates/new">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).requestTemplatesPage;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/admin/request-templates${effectiveClientId ? `?clientId=${effectiveClientId}` : ""}`}
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {d.backToList}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.newTitle}</h1>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <RequestTemplateForm key={effectiveClientId} targetClientId={effectiveClientId} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
