import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalWorkflowForm } from "../ApprovalWorkflowForm";
import type { ApprovalWorkflowInput } from "../actions";

export default async function EditApprovalWorkflowPage({
  params,
}: PageProps<"/admin/approvals/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;

  const [workflow, templates, users] = await Promise.all([
    prisma.approvalWorkflow.findUnique({ where: { id } }),
    prisma.rfpTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, approvalWorkflowId: true },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!workflow) notFound();

  const initial: ApprovalWorkflowInput = {
    name: workflow.name,
    description: workflow.description ?? "",
    active: workflow.active,
    publishRequired: workflow.publishRequired,
    publishApproverMode: workflow.publishApproverMode,
    publishMinRole: workflow.publishMinRole,
    publishApproverUserIds: workflow.publishApproverUserIds
      ? (JSON.parse(workflow.publishApproverUserIds) as string[])
      : [],
    awardRequired: workflow.awardRequired,
    awardApproverMode: workflow.awardApproverMode,
    awardMinRole: workflow.awardMinRole,
    awardApproverUserIds: workflow.awardApproverUserIds
      ? (JSON.parse(workflow.awardApproverUserIds) as string[])
      : [],
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
        />
      </div>
    </div>
  );
}
