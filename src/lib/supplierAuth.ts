import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// A second, parallel session for SupplierUser (portal login for a named
// contact at a supplier), completely separate from the internal User
// session in src/lib/auth.ts — a browser can hold both cookies at once,
// but each identifies a different kind of actor.
const SUPPLIER_SESSION_COOKIE = "session_supplier_user";

export async function createSupplierSessionCookie(supplierUserId: string) {
  const store = await cookies();
  store.set(SUPPLIER_SESSION_COOKIE, supplierUserId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSupplierSessionCookie() {
  const store = await cookies();
  store.delete(SUPPLIER_SESSION_COOKIE);
}

export const getCurrentSupplierUser = cache(async () => {
  const store = await cookies();
  const id = store.get(SUPPLIER_SESSION_COOKIE)?.value;
  if (!id) return null;
  const supplierUser = await prisma.supplierUser.findUnique({
    where: { id },
    include: { supplierDirectory: true, client: true },
  });
  return supplierUser;
});

export async function requireSupplierUser() {
  const supplierUser = await getCurrentSupplierUser();
  if (!supplierUser) redirect("/login");
  return supplierUser;
}
