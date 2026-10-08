import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { normalizeRfpMapping } from "@/lib/requestFields";
import { RequestRfpMappingForm } from "./RequestRfpMappingForm";

export default async function RequestRfpMappingPage({
  searchParams,
}: PageProps<"/admin/request-rfp-mapping">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const d = getDictionary(scope.user.language).requestRfpMappingPage;

  const saved = effectiveClientId
    ? await prisma.requestRfpMapping.findUnique({ where: { clientId: effectiveClientId } })
    : null;

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
          <RequestRfpMappingForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            initial={normalizeRfpMapping(saved?.mapping)}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
