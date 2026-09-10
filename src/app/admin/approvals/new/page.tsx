import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { ApprovalWorkflowForm } from "../ApprovalWorkflowForm";
import { getDictionary } from "@/i18n/getDictionary";

export default async function NewApprovalWorkflowPage({
  searchParams,
}: PageProps<"/admin/approvals/new">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);

  const [templates, users, groups] = effectiveClientId
    ? await Promise.all([
        prisma.rfpTemplate.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { name: "asc" },
        }),
        prisma.approvalGroup.findMany({
          where: { clientId: effectiveClientId },
          orderBy: { description: "asc" },
        }),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/approvals"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.approvalWorkflowPage.backToList}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.approvalWorkflowPage.newTitle}
      </h1>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId ? (
        <div className="mt-8">
          <ApprovalWorkflowForm
            targetClientId={effectiveClientId}
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              lastName: u.lastName ?? "",
              email: u.email,
            }))}
            groups={groups.map((g) => ({ id: g.id, description: g.description }))}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">
          {dictionary.approvalWorkflowPage.selectClient}
        </p>
      )}
    </div>
  );
}
