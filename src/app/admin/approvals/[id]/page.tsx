import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { ApprovalWorkflowForm } from "../ApprovalWorkflowForm";
import type { ApprovalWorkflowInput, ApprovalLevelInput } from "../actions";

export default async function EditApprovalWorkflowPage({
  params,
}: PageProps<"/admin/approvals/[id]">) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const { id } = await params;

  const workflow = await prisma.approvalWorkflow.findUnique({
    where: { id },
    include: { levels: { orderBy: { order: "asc" } } },
  });
  if (!workflow) notFound();
  if (!scope.isSuperAdmin && workflow.clientId !== scope.user.clientId) {
    notFound();
  }

  const [templates, users, groups] = await Promise.all([
    prisma.rfpTemplate.findMany({
      where: { clientId: workflow.clientId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, approvalWorkflowId: true },
    }),
    prisma.user.findMany({
      where: { clientId: workflow.clientId },
      orderBy: { name: "asc" },
    }),
    prisma.approvalGroup.findMany({
      where: { clientId: workflow.clientId },
      orderBy: { description: "asc" },
    }),
  ]);

  const initial: ApprovalWorkflowInput = {
    name: workflow.name,
    description: workflow.description ?? "",
    active: workflow.active,
    levels: workflow.levels.map(
      (l): ApprovalLevelInput => ({
        stage: l.stage,
        mode: l.mode,
        userIds: l.userIds ? (JSON.parse(l.userIds) as string[]) : [],
        approvalGroupId: l.approvalGroupId ?? "",
        cumulative: l.cumulative,
      }),
    ),
    templateIds: templates
      .filter((t) => t.approvalWorkflowId === workflow.id)
      .map((t) => t.id),
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/approvals"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Procesos de aprobación
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {workflow.name}
      </h1>
      <div className="mt-8">
        <ApprovalWorkflowForm
          workflowId={workflow.id}
          initial={initial}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          groups={groups.map((g) => ({ id: g.id, description: g.description }))}
        />
      </div>
    </div>
  );
}
