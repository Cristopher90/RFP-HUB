import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "../UserForm";

export default async function EditUserPage({
  params,
}: PageProps<"/admin/users/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

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
            client: user.client ?? "",
            email: user.email,
            companyCode: user.companyCode ?? "",
            plant: user.plant ?? "",
            costCenter: user.costCenter ?? "",
            role: user.role,
          }}
        />
      </div>
    </div>
  );
}
