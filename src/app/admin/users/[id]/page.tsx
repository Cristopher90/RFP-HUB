import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { UserForm } from "../UserForm";
import { getDictionary } from "@/i18n/getDictionary";

export default async function EditUserPage({
  params,
}: PageProps<"/admin/users/[id]">) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);
  const { id } = await params;

  const [user, groups, buyerGroups, clients] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { approvalGroups: true, buyerGroupMemberships: true },
    }),
    prisma.approvalGroup.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    prisma.buyerGroup.findMany({ where: scope.where, orderBy: { name: "asc" } }),
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
        {dictionary.userForm.backToUsers}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.userForm.editUserTitle} {user.name} {user.lastName}
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
            canImportRequests: user.canImportRequests,
            canAssignRequests: user.canAssignRequests,
            canNoteOwn: user.canNoteOwn,
            canNoteTargeted: user.canNoteTargeted,
            canNoteAll: user.canNoteAll,
            seeUnassignedRequests: user.seeUnassignedRequests,
            seeMyRequests: user.seeMyRequests,
            seeAssignedRequests: user.seeAssignedRequests,
            seeAllRequests: user.seeAllRequests,
            buyerGroupIds: user.buyerGroupMemberships.map((m) => m.groupId),
            approvalGroups: user.approvalGroups.map((g) => ({
              approvalGroupId: g.approvalGroupId,
              limit: String(g.limit),
            })),
          }}
          groups={groups.map((g) => ({ id: g.id, description: g.description, clientId: g.clientId }))}
          buyerGroups={buyerGroups.map((g) => ({ id: g.id, name: g.name, clientId: g.clientId }))}
          clients={clients}
          actorIsSuperAdmin={scope.isSuperAdmin}
        />
      </div>
    </div>
  );
}
