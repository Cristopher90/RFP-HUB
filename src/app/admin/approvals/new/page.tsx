import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApprovalWorkflowForm } from "../ApprovalWorkflowForm";

export default async function NewApprovalWorkflowPage() {
  await requireRole("ADMIN");

  const [templates, users, groups] = await Promise.all([
    prisma.rfpTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.approvalGroup.findMany({ orderBy: { description: "asc" } }),
  ]);

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
      <div className="mt-8">
        <ApprovalWorkflowForm
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          groups={groups.map((g) => ({ id: g.id, description: g.description }))}
        />
      </div>
    </div>
  );
}
