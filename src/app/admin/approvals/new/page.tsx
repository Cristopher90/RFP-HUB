import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { ApprovalWorkflowForm } from "../ApprovalWorkflowForm";

export default async function NewApprovalWorkflowPage({
  searchParams,
}: PageProps<"/admin/approvals/new">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } =
    await requireMasterDataScope(sp);

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
        &larr; Procesos de aprobación
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Nuevo proceso de aprobación
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
          Selecciona un cliente para crear el proceso.
        </p>
      )}
    </div>
  );
}
