import { recordLoginEvent, type LoginMethod } from "@/lib/loginLog";
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

export async function createSupplierSessionCookie(supplierUserId: string, method: LoginMethod = "PASSWORD") {
  const store = await cookies();
  store.set(SUPPLIER_SESSION_COOKIE, supplierUserId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  const person = await prisma.supplierUser.update({
    where: { id: supplierUserId },
    data: { lastLoginAt: new Date() },
  });
  await recordLoginEvent({
    event: "LOGIN",
    kind: "SUPPLIER",
    method,
    userId: person.id,
    email: person.email,
    name: `${person.name} ${person.lastName}`.trim(),
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
    include: {
      links: {
        include: { supplierDirectory: true, client: true },
        orderBy: { invitedAt: "asc" },
      },
    },
  });
  return supplierUser;
});

type SupplierUserWithLinks = NonNullable<Awaited<ReturnType<typeof getCurrentSupplierUser>>>;

// The links that actually give access: only an accepted connection lets the
// person see a client's RFPs.
export function acceptedLinks(supplierUser: SupplierUserWithLinks) {
  return supplierUser.links.filter((l) => l.status === "ACCEPTED");
}

export function isSupplierAdmin(supplierUser: SupplierUserWithLinks) {
  return acceptedLinks(supplierUser).some((l) => l.isAdmin);
}

// Distinct company names across the accepted links, for the header.
export function companyNames(supplierUser: SupplierUserWithLinks): string {
  return [...new Set(acceptedLinks(supplierUser).map((l) => l.supplierDirectory.companyName))].join(", ");
}

export async function requireSupplierUser() {
  const supplierUser = await getCurrentSupplierUser();
  if (!supplierUser) redirect("/login");
  return supplierUser;
}
