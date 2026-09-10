import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { logout, logoutSupplier } from "@/lib/authActions";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";
import { roleLabel } from "@/i18n/labels";

export async function HeaderNav() {
  const user = await getCurrentUser();
  const preferences = await getViewerPreferences();
  const dictionary = getDictionary(preferences.language);

  if (!user) {
    const supplierUser = await getCurrentSupplierUser();
    if (supplierUser) {
      return (
        <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-slate-800">
              {supplierUser.name} {supplierUser.lastName}
            </p>
            <p className="text-xs text-slate-400">
              {supplierUser.supplierDirectory.companyName}
            </p>
          </div>
          <Link
            href="/profile"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
          >
            {dictionary.nav.myProfile}
          </Link>
          <form action={logoutSupplier}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
            >
              {dictionary.nav.logout}
            </button>
          </form>
        </nav>
      );
    }
    return (
      <nav className="text-sm font-medium text-slate-600">
        <Link
          href="/login"
          className="rounded-lg bg-violet-600 px-4 py-2 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          Iniciar sesión
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
      {user.role !== "APPROVER" && (
        <Link
          href="/rfps/new"
          className="rounded-lg bg-violet-600 px-4 py-2 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
        >
          Nueva RFP
        </Link>
      )}
      <div className="flex items-center gap-2 border-l border-slate-200 pl-5">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-slate-800">{user.name}</p>
          <p className="text-xs text-slate-400">{roleLabel(dictionary, user.role)}</p>
        </div>
        <Link
          href="/profile"
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          {dictionary.nav.myProfile}
        </Link>
        <form action={logout}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
          >
            {dictionary.nav.logout}
          </button>
        </form>
      </div>
    </nav>
  );
}
