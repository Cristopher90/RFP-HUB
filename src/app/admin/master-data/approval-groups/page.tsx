import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { MasterDataForm } from "../MasterDataForm";
import { getDictionary } from "@/i18n/getDictionary";

export default async function ApprovalGroupsPage({
  searchParams,
}: PageProps<"/admin/master-data/approval-groups">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const groups = effectiveClientId
    ? await prisma.approvalGroup.findMany({
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
        {dictionary.masterDataScreen.titlePrefix} &middot; {dictionary.masterDataKind.approvalGroup}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {dictionary.masterDataScreen.approvalGroupsSubtitle}
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
            kind="approvalGroup"
            label={dictionary.masterDataKind.approvalGroup}
            targetClientId={effectiveClientId}
            isSuperAdmin={scope.isSuperAdmin}
            initial={groups.map((g) => ({
              clientKey: g.id,
              code: g.code,
              description: g.description,
              parentClientKey: g.parentId,
            }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          {dictionary.masterDataScreen.selectClientPrefix} {dictionary.masterDataKind.approvalGroup.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
