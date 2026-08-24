import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { UserForm } from "../UserForm";

export default async function NewUserPage() {
  await requireRole("ADMIN");

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
        <UserForm />
      </div>
    </div>
  );
}
