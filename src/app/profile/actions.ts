"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { CURRENCIES } from "@/lib/profileOptions";
import { isColorMode, isGlassBackground, isTheme, isUiStyle, normalizeGlass } from "@/lib/themes";
import { getDictionary } from "@/i18n/getDictionary";

export type ProfileFormInput = {
  language: string;
  timezone: string;
  currency: string;
  theme: string;
  colorMode: string;
  uiStyle?: string; // interface style
  uiGlass?: number; // glass style: panel opacity, 0 to 100
  uiBackground?: string; // glass style: background preset or custom colors
};

const SUPPORTED_LANGUAGES = ["es", "en"];

export async function updateOwnProfile(
  input: ProfileFormInput,
): Promise<{ error: string } | undefined> {
  const user = await getCurrentUser();
  const supplierUser = user ? null : await getCurrentSupplierUser();
  const activeSession = user ?? supplierUser;
  const dictionary = getDictionary(activeSession?.language ?? "es");

  if (!activeSession) return { error: dictionary.profileActions.sessionNotFound };
  if (!SUPPORTED_LANGUAGES.includes(input.language)) {
    return { error: dictionary.profileActions.unsupportedLanguage };
  }
  if (!Intl.supportedValuesOf("timeZone").includes(input.timezone.trim())) {
    return { error: dictionary.profileActions.invalidTimezone };
  }
  if (!CURRENCIES.includes(input.currency.trim().toUpperCase())) {
    return { error: dictionary.profileActions.invalidCurrency };
  }

  if (!isTheme(input.theme) || !isColorMode(input.colorMode)) {
    return { error: dictionary.profileActions.invalidTheme };
  }

  const data = {
    theme: input.theme,
    colorMode: input.colorMode,
    language: input.language,
    timezone: input.timezone.trim(),
    currency: input.currency.trim().toUpperCase(),
    ...(input.uiStyle && isUiStyle(input.uiStyle) ? { uiStyle: input.uiStyle } : {}),
    ...(input.uiGlass !== undefined ? { uiGlass: normalizeGlass(input.uiGlass) } : {}),
    ...(input.uiBackground && isGlassBackground(input.uiBackground) ? { uiBackground: input.uiBackground } : {}),
  };

  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { ...data, modifiedAt: new Date() } });
  } else {
    await prisma.supplierUser.update({ where: { id: supplierUser!.id }, data });
  }

  revalidatePath("/", "layout");
}
