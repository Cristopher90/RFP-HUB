import "server-only";
import { prisma } from "@/lib/prisma";
import { isProductionEnv } from "@/lib/appEnv";

const DEMO_ACCESS_KEY = "demoAccess";

// The password-less "entra como usuario demo" shortcut on the login page.
// In production it is always off and the table isn't even read; elsewhere a
// Super Administrador can switch it (default: on, as it always was).
export async function demoAccessEnabled(): Promise<boolean> {
  if (isProductionEnv()) return false;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: DEMO_ACCESS_KEY } });
    return row?.value !== "off";
  } catch {
    // Table not migrated yet: keep the shortcut as it was.
    return true;
  }
}

export async function setDemoAccessEnabled(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: { key: DEMO_ACCESS_KEY },
    create: { key: DEMO_ACCESS_KEY, value: enabled ? "on" : "off" },
    update: { value: enabled ? "on" : "off" },
  });
}
