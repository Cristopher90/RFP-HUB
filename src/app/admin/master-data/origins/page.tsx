import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { MasterDataForm } from "../MasterDataForm";
import { getDictionary } from "@/i18n/getDictionary";

export default async function OriginsPage({
  searchParams,
}: PageProps<"/admin/master-data/origins">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const origins = effectiveClientId
    ? await prisma.origin.findMany({
        where: { clientId: effectiveClientId },
        orderBy: { code: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.masterDataScreen.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.masterDataScreen.titlePrefix} &middot; {dictionary.masterDataKind.origin}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.masterDataScreen.originsSubtitle}
      </p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <MasterDataForm
            key={effectiveClientId}
            kind="origin"
            label={dictionary.masterDataKind.origin}
            targetClientId={effectiveClientId}
            isSuperAdmin={scope.isSuperAdmin}
            initial={origins.map((o) => ({
              clientKey: o.id,
              code: o.code,
              description: o.description,
              parentClientKey: o.parentId,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          {dictionary.masterDataScreen.selectClientPrefix} {dictionary.masterDataKind.origin.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
