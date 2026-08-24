import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MasterDataForm } from "../MasterDataForm";

export default async function ApprovalGroupsPage() {
  await requireRole("ADMIN");

  const groups = await prisma.approvalGroup.findMany({
    orderBy: { code: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Configuración
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Datos maestros &middot; Grupos de aprobación
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Estos grupos se asignan a usuarios y se usan en los procesos de
        aprobación por valor (modo &ldquo;Grupo&rdquo;).
      </p>
      <div className="mt-8">
        <MasterDataForm
          kind="approvalGroup"
          label="Grupos de aprobación"
          initial={groups.map((g) => ({
            clientKey: g.id,
            code: g.code,
            description: g.description,
            parentClientKey: g.parentId,
          }))}
        />
      </div>
    </div>
  );
}
