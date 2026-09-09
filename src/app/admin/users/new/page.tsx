import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const [groups, clients] = await Promise.all([
    prisma.approvalGroup.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    scope.isSuperAdmin
      ? prisma.client.findMany({ orderBy: { description: "asc" } })
      : Promise.resolve([]),
  ]);

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
          clients={clients}
          actorIsSuperAdmin={scope.isSuperAdmin}
        />
      </div>
    </div>
  );
}
