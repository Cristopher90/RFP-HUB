"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth";
import { clearSupplierSessionCookie } from "@/lib/supplierAuth";

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}

export async function logoutSupplier() {
  await clearSupplierSessionCookie();
  redirect("/login");
}
