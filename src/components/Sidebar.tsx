import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LEVEL } from "@/lib/roleLabels";

export async function Sidebar() {
  const user = await getCurrentUser();

  if (!user) return null;

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white/60 sm:block">
      <nav className="sticky top-[73px] flex flex-col gap-1 px-3 py-6 text-sm font-medium text-slate-600">
        <Link
          href="/"
          className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900"
        >
          RFPs
        </Link>
        {ROLE_LEVEL[user.role] >= ROLE_LEVEL.CLIENT_ADMIN && (
          <Link
            href="/admin"
            className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900"
          >
            Configuración
          </Link>
        )}
        {user.role === "ADMIN" && (
          <Link
            href="/admin/system-tables"
            className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900"
          >
            Tablas del sistema
          </Link>
        )}
      </nav>
    </aside>
  );
}
