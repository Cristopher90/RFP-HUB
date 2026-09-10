import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { roleLabel } from "@/i18n/labels";
import { UserListFilter } from "./UserListFilter";

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

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">{dictionary.usersPage.name}</th>
              <th className="px-5 py-3">{dictionary.usersPage.client}</th>
              <th className="px-5 py-3">{dictionary.usersPage.email}</th>
              <th className="px-5 py-3">{dictionary.usersPage.company}</th>
              <th className="px-5 py-3">{dictionary.usersPage.plant}</th>
              <th className="px-5 py-3">{dictionary.usersPage.costCenter}</th>
              <th className="px-5 py-3">{dictionary.usersPage.group}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-medium text-slate-800">
                  {u.name} {u.lastName}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {u.client?.description || "—"}
                </td>
                <td className="px-5 py-4 text-slate-600">{u.email}</td>
                <td className="px-5 py-4 text-slate-600">
                  {u.companyCode || "—"}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {u.plant || "—"}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {u.costCenter || "—"}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {roleLabel(dictionary, u.role)}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-sm font-medium text-violet-600 hover:text-violet-700"
                  >
                    {dictionary.usersPage.edit}
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  {dictionary.usersPage.noMatches}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
