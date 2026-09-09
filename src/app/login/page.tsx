import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const [user, supplierUser] = await Promise.all([
    getCurrentUser(),
    getCurrentSupplierUser(),
  ]);
  if (user) redirect("/");
  if (supplierUser) redirect("/supplier");

  const [users, supplierUsers] = await Promise.all([
    prisma.user.findMany({
      include: { client: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplierUser.findMany({
      include: { supplierDirectory: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center px-6 py-16">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-500 text-base shadow-sm shadow-violet-600/30">
          🔨
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          <span className="text-violet-600">RFP.HUB</span>
        </h1>
        <p className="text-sm text-slate-500">Inicia sesión para continuar</p>
      </div>
      <LoginForm
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          lastName: u.lastName,
          email: u.email,
          role: u.role,
          clientDescription: u.client?.description ?? null,
        }))}
        supplierUsers={supplierUsers.map((u) => ({
          id: u.id,
          name: u.name,
          lastName: u.lastName,
          email: u.email,
          companyName: u.supplierDirectory.companyName,
        }))}
      />
    </div>
  );
}
