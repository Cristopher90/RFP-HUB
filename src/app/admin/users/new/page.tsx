import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  await requireRole("ADMIN");
  const groups = await prisma.approvalGroup.findMany({
    orderBy: { description: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/users"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Usuarios
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Nuevo usuario
      </h1>
      <div className="mt-8">
        <UserForm
          groups={groups.map((g) => ({ id: g.id, description: g.description }))}
        />
      </div>
    </div>
  );
}
