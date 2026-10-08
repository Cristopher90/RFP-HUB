"use server";

import { prisma } from "@/lib/prisma";
import {
  currentPrefOwnerId,
  readUserPref,
  MAX_PREF_KEY_LENGTH,
  MAX_PREF_VALUE_LENGTH,
} from "@/lib/userPrefs";

// Per-user UI preferences (column layout, grouping, list filters), stored in
// the database so they follow the person across browsers and devices.
export async function loadUserPref(key: string): Promise<string | null> {
  const userId = await currentPrefOwnerId();
  if (!userId || !key || key.length > MAX_PREF_KEY_LENGTH) return null;
  return readUserPref(userId, key);
}

export async function saveUserPref(key: string, value: string): Promise<void> {
  const userId = await currentPrefOwnerId();
  if (!userId || !key || key.length > MAX_PREF_KEY_LENGTH) return;
  if (value.length > MAX_PREF_VALUE_LENGTH) return;
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value },
    update: { value },
  });
}
