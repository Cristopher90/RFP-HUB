"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The "Iniciar sesión" shortcut for signed-out visitors. The login page has
// its own sign-in button in the middle of the screen, so it is hidden there.
export function HeaderLoginLink({ label }: { label: string }) {
  if (usePathname() === "/login") return null;
  return (
    <nav className="text-sm font-medium text-slate-600">
      <Link
        href="/login"
        className="rounded-lg bg-violet-600 px-4 py-2 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
      >
        {label}
      </Link>
    </nav>
  );
}
