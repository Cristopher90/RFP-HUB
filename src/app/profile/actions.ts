"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";

export type ProfileFormInput = {
  language: string;
  timezone: string;
  currency: string;
};

const SUPPORTED_LANGUAGES = ["es", "en"];

export async function updateOwnProfile(
  input: ProfileFormInput,
): Promise<{ error: string } | undefined> {
  if (!SUPPORTED_LANGUAGES.includes(input.language)) {
    return { error: "Idioma no soportado." };
  }
  if (!input.timezone.trim()) {
    return { error: "La zona horaria es obligatoria." };
  }
  if (!input.currency.trim()) {
    return { error: "La moneda es obligatoria." };
  }

  const data = {
    language: input.language,
    timezone: input.timezone.trim(),
    currency: input.currency.trim().toUpperCase(),
  };

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data });
  } else {
    const supplierUser = await getCurrentSupplierUser();
    if (!supplierUser) return { error: "Sesión no encontrada." };
    await prisma.supplierUser.update({ where: { id: supplierUser.id }, data });
  }

  revalidatePath("/", "layout");
}
