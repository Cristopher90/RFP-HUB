"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { clearSupplierSessionCookie, getCurrentSupplierUser } from "@/lib/supplierAuth";
import { recordLoginEvent } from "@/lib/loginLog";

export async function logout() {
  const user = await getCurrentUser();
  if (user) {
    await recordLoginEvent({
      event: "LOGOUT",
      kind: "USER",
      userId: user.id,
      email: user.email,
      name: `${user.name} ${user.lastName ?? ""}`.trim(),
      clientId: user.clientId,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function logoutSupplier() {
  const person = await getCurrentSupplierUser();
  if (person) {
    await recordLoginEvent({
      event: "LOGOUT",
      kind: "SUPPLIER",
      userId: person.id,
      email: person.email,
      name: `${person.name} ${person.lastName}`.trim(),
    });
  }
  await clearSupplierSessionCookie();
  redirect("/login");
}
