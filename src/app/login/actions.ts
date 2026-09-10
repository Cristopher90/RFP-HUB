"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionCookie, verifyPassword } from "@/lib/auth";
import { createSupplierSessionCookie } from "@/lib/supplierAuth";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";

export async function login(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const dictionary = getDictionary((await getViewerPreferences()).language);
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return { error: dictionary.loginActions.enterEmailAndPassword };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: dictionary.loginActions.invalidCredentials };
  }

  await createSessionCookie(user.id);
  redirect("/");
}

export async function loginSupplier(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const dictionary = getDictionary((await getViewerPreferences()).language);
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return { error: dictionary.loginActions.enterEmailAndPassword };
  }

  const supplierUser = await prisma.supplierUser.findUnique({ where: { email } });
  if (!supplierUser || !verifyPassword(password, supplierUser.passwordHash)) {
    return { error: dictionary.loginActions.invalidCredentials };
  }

  await createSupplierSessionCookie(supplierUser.id);
  redirect("/supplier");
}

// Logs in directly as one specific chosen user/usuario de proveedor, to
// speed up manual testing — replaces the old role-only quick login, which
// just grabbed "the first user with this role" and couldn't target a
// particular account.
export async function quickLoginAsUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await createSessionCookie(user.id);
  redirect("/");
}

export async function quickLoginAsSupplierUser(supplierUserId: string) {
  const supplierUser = await prisma.supplierUser.findUnique({
    where: { id: supplierUserId },
  });
  if (!supplierUser) return;
  await createSupplierSessionCookie(supplierUser.id);
  redirect("/supplier");
}
