import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

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
      <LoginForm />
    </div>
  );
}
