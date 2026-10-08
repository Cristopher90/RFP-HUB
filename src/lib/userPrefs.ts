import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";

export const MAX_PREF_KEY_LENGTH = 100;
export const MAX_PREF_VALUE_LENGTH = 20_000;

// The id of whoever is signed in (internal user or supplier contact), or null.
export async function currentPrefOwnerId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return user.id;
  const supplierUser = await getCurrentSupplierUser();
  return supplierUser?.id ?? null;
}

export async function readUserPref(userId: string, key: string): Promise<string | null> {
  const row = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key } },
    select: { value: true },
  });
  return row?.value ?? null;
}
