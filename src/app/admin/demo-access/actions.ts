"use server";

import { revalidatePath } from "next/cache";
import { requireClientScope } from "@/lib/clientScope";
import { isProductionEnv } from "@/lib/appEnv";
import { setDemoAccessEnabled } from "@/lib/appSettings";

// Super Administrador only, and never in production, where the demo shortcut
// stays off no matter what.
export async function saveDemoAccess(enabled: boolean): Promise<{ error: string | null }> {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) return { error: "forbidden" };
  if (isProductionEnv()) return { error: "production" };
  await setDemoAccessEnabled(enabled);
  revalidatePath("/admin/demo-access");
  revalidatePath("/login");
  return { error: null };
}
