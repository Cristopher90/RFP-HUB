import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { UserForm } from "../UserForm";
import { getDictionary } from "@/i18n/getDictionary";
import { loadViewGroups } from "@/lib/viewGroupsServer";
import { loadCustomFields } from "@/lib/customFields";

export default async function NewUserPage() {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const dictionary = getDictionary(scope.user.language);
  const [groups, buyerGroups, clients, clientUsers] = await Promise.all([
    prisma.approvalGroup.findMany({
      where: scope.where,
      orderBy: { description: "asc" },
    }),
    prisma.buyerGroup.findMany({ where: scope.where, orderBy: { name: "asc" } }),
    scope.isSuperAdmin
      ? prisma.client.findMany({ orderBy: { description: "asc" } })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { ...scope.where, role: { not: "ADMIN" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, lastName: true, clientId: true },
    }),
  ]);


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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/admin/users"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.userForm.backToUsers}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {dictionary.userForm.newUserTitle}
      </h1>
      <div className="mt-8">
        <UserForm
          groups={groups.map((g) => ({ id: g.id, description: g.description, clientId: g.clientId }))}
          buyerGroups={buyerGroups.map((g) => ({ id: g.id, name: g.name, clientId: g.clientId }))}
          clients={clients}
          actorIsSuperAdmin={scope.isSuperAdmin}
          userFieldsByClient={userFieldsByClient}
          viewGroupsByClient={viewGroupsByClient}
          supervisorOptions={clientUsers.map((u) => ({
            id: u.id,
            name: `${u.name} ${u.lastName ?? ""}`.trim(),
            clientId: u.clientId,
          }))}
        />
      </div>
    </div>
  );
}
