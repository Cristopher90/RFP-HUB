import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { UserForm } from "../UserForm";
import { getDictionary } from "@/i18n/getDictionary";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { loadCustomFields, readCustomValues } from "@/lib/customFields";

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

  // User-level custom fields, per client (only those clients that define any).
  const customClients = scope.isSuperAdmin
    ? clients
    : await prisma.client.findMany({ where: { id: scope.user.clientId ?? "" } });
  const userFieldsByClient: Record<string, { currency: string; fields: Awaited<ReturnType<typeof loadCustomFields>> }> = {};
  const viewGroupsByClient: Record<string, { id: string; name: string }[]> = {};
  for (const c of customClients) {
    const fields = await loadCustomFields(c.id, "USER");
    if (fields.length > 0) userFieldsByClient[c.id] = { currency: c.currency, fields };
    viewGroupsByClient[c.id] = (await loadViewGroups(c.id)).map((g) => ({ id: g.id, name: g.name }));
  }
  const userCustomValues = user.clientId
    ? ((await readCustomValues(user.clientId, "USER", [user.id])).get(user.id) ?? {})
    : {};

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
            canUseAssistant: user.canUseAssistant,
            canRateSuppliers: user.canRateSuppliers,
            canBlockSuppliers: user.canBlockSuppliers,
            viewGroupIds: user.viewGroupIds,
            seeUnassignedRequests: user.seeUnassignedRequests,
            seeMyRequests: user.seeMyRequests,
            seeAssignedRequests: user.seeAssignedRequests,
            seeAllRequests: user.seeAllRequests,
            customValues: userCustomValues,
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
          userFieldsByClient={userFieldsByClient}
          viewGroupsByClient={viewGroupsByClient}
        />
      </div>
    </div>
  );
}
