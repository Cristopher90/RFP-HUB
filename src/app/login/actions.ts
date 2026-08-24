"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionCookie, verifyPassword } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/enums";

export async function login(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return { error: "Ingresa correo y contraseña." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Credenciales inválidas." };
  }

  await createSessionCookie(user.id);
  redirect("/");
}

export async function quickLogin(role: UserRole) {
  const user = await prisma.user.findFirst({ where: { role } });
  if (!user) return;
  await createSessionCookie(user.id);
  redirect("/");
}
