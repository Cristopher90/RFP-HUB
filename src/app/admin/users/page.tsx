import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { roleLabel } from "@/i18n/labels";
import { UserListFilter } from "./UserListFilter";
import { UsersTable } from "./UsersTable";

export default async function UsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const scope = await requireClientScope();
  if (scope.user.role !== "ADMIN" && scope.user.role !== "CLIENT_ADMIN") {
    redirect("/");
  }
  const sp = await searchParams;
  const q =
    (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const dictionary = getDictionary(scope.user.language);

  const users = await prisma.user.findMany({
    where: scope.where,
    include: { client: true },
    orderBy: { name: "asc" },
  });
  const filtered = q
    ? users.filter((u) =>
        [
          u.name,
          u.lastName ?? "",
          u.client?.description ?? "",
          u.email,
          u.companyCode ?? "",
          u.plant ?? "",
          u.costCenter ?? "",
          roleLabel(dictionary, u.role),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : users;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        {dictionary.usersPage.backToSettings}
      </Link>
      <div className="mt-1 flex items-end justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.usersPage.title}</h1>
        <Link
          href="/admin/users/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          {dictionary.usersPage.newUser}
        </Link>
      </div>

      <div className="mt-6">
        <UserListFilter />
      </div>

      <div className="mt-4">
        <UsersTable
          rows={filtered.map((u) => ({
            id: u.id,
            name: `${u.name} ${u.lastName ?? ""}`.trim(),
            client: u.client?.description ?? "",
            email: u.email,
            company: u.companyCode ?? "",
            plant: u.plant ?? "",
            costCenter: u.costCenter ?? "",
            group: roleLabel(dictionary, u.role),
            createdAt: u.createdAt.toISOString(),
            modifiedAt: u.modifiedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
