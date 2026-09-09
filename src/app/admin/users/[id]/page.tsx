import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { UserForm } from "../UserForm";

export default async function EditUserPage({
  params,
}: PageProps<"/admin/users/[id]">) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const { id } = await params;

  const [user, groups, clients] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { approvalGroups: true } }),
    prisma.approvalGroup.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    scope.isSuperAdmin
      ? prisma.client.findMany({ orderBy: { description: "asc" } })
      : Promise.resolve([]),
  ]);
  if (!user) notFound();
  if (!scope.isSuperAdmin && user.clientId !== scope.user.clientId) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/users"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        &larr; Usuarios
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Editar usuario &middot; {user.name} {user.lastName}
      </h1>
      <div className="mt-8">
        <UserForm
          userId={user.id}
          initial={{
            name: user.name,
            lastName: user.lastName ?? "",
            clientId: user.clientId,
            email: user.email,
            companyCode: user.companyCode ?? "",
            plant: user.plant ?? "",
            costCenter: user.costCenter ?? "",
            role: user.role,
            allowFreeTextItems: user.allowFreeTextItems,
            approvalGroups: user.approvalGroups.map((g) => ({
              approvalGroupId: g.approvalGroupId,
              limit: String(g.limit),
            })),
          }}
          groups={groups.map((g) => ({ id: g.id, description: g.description }))}
          clients={clients}
          actorIsSuperAdmin={scope.isSuperAdmin}
        />
      </div>
    </div>
  );
}
